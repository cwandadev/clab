-- =====================================================================
-- Round 2: reviews on the product page, and "people also bought"
-- Safe to run twice (every object is replaced or guarded).
-- =====================================================================

-- Only customers who received the product can review it (one review each, already unique).
create or replace function public.has_received_product(_user uuid, _product uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o join public.order_items oi on oi.order_id = o.id
     where o.user_id = _user and oi.product_id = _product and o.status = 'delivered'
  );
$$;
revoke execute on function public.has_received_product(uuid, uuid) from public, anon;
grant  execute on function public.has_received_product(uuid, uuid) to authenticated, service_role;

drop policy if exists "reviews: own insert" on public.reviews;
create policy "reviews: own insert" on public.reviews for insert to authenticated
  with check (user_id = auth.uid() and public.has_received_product(auth.uid(), product_id));

-- Public review list. Profiles are private (RLS), so names are exposed here in a safe form only:
-- first name + last initial, and the profile photo. Never email or phone.
create or replace function public.product_reviews(_product_id uuid)
returns table (
  id uuid, rating integer, comment text, photo_url text, link_url text,
  upvotes integer, downvotes integer, created_at timestamptz,
  author text, author_avatar text, is_mine boolean, my_vote integer
)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.comment, r.photo_url, r.link_url, r.upvotes, r.downvotes, r.created_at,
         coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || left(coalesce(p.last_name, ''), 1)
                              || case when coalesce(p.last_name, '') <> '' then '.' else '' end), ''),
                  nullif(split_part(coalesce(p.display_name, ''), ' ', 1), ''), 'Customer') as author,
         p.avatar_url,
         coalesce(r.user_id = auth.uid(), false),
         (select v.vote_type from public.review_votes v where v.review_id = r.id and v.user_id = auth.uid())
    from public.reviews r
    left join public.profiles p on p.id = r.user_id
   where r.product_id = _product_id
   order by (r.upvotes - r.downvotes) desc, r.created_at desc
   limit 200;
$$;
grant execute on function public.product_reviews(uuid) to anon, authenticated, service_role;

-- Average and count per product (for the product page and, later, the cards).
create or replace view public.product_ratings with (security_invoker = true) as
  select product_id, round(avg(rating)::numeric, 1) as average, count(*)::integer as count
    from public.reviews group by product_id;
grant select on public.product_ratings to anon, authenticated, service_role;

-- "People also bought": products that appear in the same PAID orders. Only counts, never who.
create or replace function public.also_bought(_product_id uuid, _limit integer default 8)
returns table (product_id uuid, together integer)
language sql stable security definer set search_path = public as $$
  select oi2.product_id, count(distinct oi1.order_id)::integer as together
    from public.order_items oi1
    join public.orders o on o.id = oi1.order_id
         and o.status in ('paid', 'processing', 'shipped', 'delivered')
         and coalesce(o.refund_status, '') <> 'completed'
    join public.order_items oi2 on oi2.order_id = oi1.order_id and oi2.product_id <> oi1.product_id
    join public.products p on p.id = oi2.product_id and p.active
   where oi1.product_id = _product_id
   group by oi2.product_id
   order by together desc, max(p.stock) desc
   limit least(greatest(_limit, 1), 24);
$$;
grant execute on function public.also_bought(uuid, integer) to anon, authenticated, service_role;
