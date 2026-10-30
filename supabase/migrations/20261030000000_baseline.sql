-- =====================================================================
-- tieflab / clab-shop — clean baseline schema
-- Replaces the 13 old Lovable migrations. Prices are whole RWF.
-- =====================================================================

-- ---------- Roles ----------
create type public.app_role as enum ('admin', 'user');

-- ---------- Profiles ----------
create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text,
  display_name         text,
  first_name           text,
  last_name            text,
  avatar_url           text,
  phone                text,
  location_city        text,
  location_address     text,
  language_preference  text not null default 'en',
  theme_preference     text not null default 'light',
  currency_preference  text not null default 'RWF',
  created_at           timestamptz not null default now()
);

create table public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- New auth user -> profile + 'user' role (covers email and Google sign-ups)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name',
             new.raw_user_meta_data->>'full_name',
             split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Products ----------
create table public.products (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name                 text not null,
  description          text,
  category             text not null,
  price_rwf            integer not null check (price_rwf >= 0),
  compare_at_price_rwf integer check (compare_at_price_rwf >= 0),
  stock                integer not null default 0 check (stock >= 0),
  low_stock_threshold  integer not null default 10 check (low_stock_threshold >= 0),
  image_url            text,
  spec_1               text,
  spec_2               text,
  weight_grams         numeric,
  product_type         text not null default 'physical' check (product_type in ('physical', 'digital_circuit')),
  active               boolean not null default true,
  created_at           timestamptz not null default now()
);
create index products_category_idx on public.products (category);

create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url        text not null,
  alt_text   text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id);

-- ---------- Orders ----------
create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete set null,
  customer_name       text not null,
  customer_email      text not null,
  customer_phone      text,
  city                text not null,
  address             text not null,
  subtotal_rwf        integer not null check (subtotal_rwf >= 0),
  shipping_rwf        integer not null default 0 check (shipping_rwf >= 0),
  total_rwf           integer not null check (total_rwf >= 0),
  display_currency    text not null default 'RWF',
  status              text not null default 'pending'
                      check (status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed')),
  payment_method      text not null default 'momo' check (payment_method in ('momo', 'cash')),
  pickup_option       boolean not null default false,
  anonymous           boolean not null default false,
  -- pawaPay
  pawapay_deposit_id  uuid unique,
  payment_provider    text,           -- e.g. MTN_MOMO_RWA, AIRTEL_RWA
  payer_phone         text,           -- MSISDN, e.g. 250783456789
  payment_failure     text,
  paid_at             timestamptz,
  -- fulfilment
  stock_reserved      boolean not null default false,
  tracking_number     text,
  carrier             text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index orders_user_idx   on public.orders (user_id);
create index orders_status_idx on public.orders (status);

create table public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  product_id     uuid references public.products(id) on delete set null,
  product_name   text not null,
  unit_price_rwf integer not null check (unit_price_rwf >= 0),
  quantity       integer not null check (quantity > 0)
);
create index order_items_order_idx on public.order_items (order_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- Atomic stock reservation: all items or nothing. Raises if any item is short.
create or replace function public.reserve_order_stock(_order_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  it record;
begin
  perform 1 from public.orders where id = _order_id and not stock_reserved for update;
  if not found then return; end if;  -- unknown order, or already reserved

  for it in select product_id, quantity, product_name from public.order_items
            where order_id = _order_id and product_id is not null loop
    update public.products set stock = stock - it.quantity
     where id = it.product_id and stock >= it.quantity;
    if not found then
      raise exception 'OUT_OF_STOCK: %', it.product_name;
    end if;
  end loop;

  update public.orders set stock_reserved = true where id = _order_id;
end;
$$;

-- Give reserved stock back (failed payment, cancelled order). Idempotent.
create or replace function public.release_order_stock(_order_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform 1 from public.orders where id = _order_id and stock_reserved for update;
  if not found then return; end if;

  update public.products p set stock = p.stock + oi.quantity
    from public.order_items oi
   where oi.order_id = _order_id and oi.product_id = p.id;

  update public.orders set stock_reserved = false where id = _order_id;
end;
$$;

-- ---------- Reviews ----------
create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  rating     integer not null check (rating between 1 and 5),
  comment    text,
  photo_url  text,
  link_url   text,
  upvotes    integer not null default 0,
  downvotes  integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index reviews_product_idx on public.reviews (product_id);

create table public.review_votes (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references public.reviews(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  vote_type  integer not null check (vote_type in (1, -1)),
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

-- Keep upvotes/downvotes in sync with review_votes
create or replace function public.sync_review_votes()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  rid uuid := coalesce(new.review_id, old.review_id);
begin
  update public.reviews set
    upvotes   = (select count(*) from public.review_votes where review_id = rid and vote_type = 1),
    downvotes = (select count(*) from public.review_votes where review_id = rid and vote_type = -1)
  where id = rid;
  return null;
end;
$$;

create trigger review_votes_sync
  after insert or update or delete on public.review_votes
  for each row execute function public.sync_review_votes();

-- ---------- Support chat ----------
create table public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade, -- the customer thread
  message         text not null,
  is_from_admin   boolean not null default false,
  attachment_path text,  -- object path in the private chat-attachments bucket
  created_at      timestamptz not null default now()
);
create index chat_messages_user_idx on public.chat_messages (user_id, created_at);

-- =====================================================================
-- Grants
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;

grant select on public.products, public.product_images, public.reviews, public.review_votes to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

revoke execute on function public.has_role(uuid, public.app_role) from public;
grant  execute on function public.has_role(uuid, public.app_role) to anon, authenticated, service_role;

revoke execute on function public.handle_new_user()                from public, anon, authenticated;
revoke execute on function public.reserve_order_stock(uuid)         from public, anon, authenticated;
revoke execute on function public.release_order_stock(uuid)         from public, anon, authenticated;
revoke execute on function public.sync_review_votes()               from public, anon, authenticated;
grant  execute on function public.reserve_order_stock(uuid) to service_role;
grant  execute on function public.release_order_stock(uuid) to service_role;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.user_roles     enable row level security;
alter table public.products       enable row level security;
alter table public.product_images enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.reviews        enable row level security;
alter table public.review_votes   enable row level security;
alter table public.chat_messages  enable row level security;

-- profiles
create policy "profiles: own or admin read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "profiles: own update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- user_roles (writes only via service role in server functions)
create policy "roles: own read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- products / images
create policy "products: public read active" on public.products for select
  using (active or public.has_role(auth.uid(), 'admin'));
create policy "products: admin write" on public.products for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "product_images: public read" on public.product_images for select using (true);
create policy "product_images: admin write" on public.product_images for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- orders: customers only read; creation and payment updates go through the server (service role)
create policy "orders: own or admin read" on public.orders for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "orders: admin update" on public.orders for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "order_items: own or admin read" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
                 and (o.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))));

-- reviews
create policy "reviews: public read" on public.reviews for select using (true);
create policy "reviews: own insert" on public.reviews for insert to authenticated
  with check (user_id = auth.uid());
create policy "reviews: own update" on public.reviews for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reviews: own or admin delete" on public.reviews for delete to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "votes: public read" on public.review_votes for select using (true);
create policy "votes: own insert" on public.review_votes for insert to authenticated
  with check (user_id = auth.uid());
create policy "votes: own update" on public.review_votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "votes: own delete" on public.review_votes for delete to authenticated
  using (user_id = auth.uid());

-- chat
create policy "chat: own thread or admin read" on public.chat_messages for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "chat: customer writes own thread" on public.chat_messages for insert to authenticated
  with check (user_id = auth.uid() and not is_from_admin);
create policy "chat: admin replies" on public.chat_messages for insert to authenticated
  with check (is_from_admin and public.has_role(auth.uid(), 'admin'));

-- Realtime for live chat
alter publication supabase_realtime add table public.chat_messages;

-- =====================================================================
-- Storage
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images',   'product-images',   true,  5242880,  array['image/jpeg','image/png','image/webp','image/gif']),
  ('profile-pictures', 'profile-pictures', true,  2097152,  array['image/jpeg','image/png','image/webp']),
  ('review-photos',    'review-photos',    true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('chat-attachments', 'chat-attachments', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf','text/plain'])
on conflict (id) do nothing;

-- product-images: public read, admin write
create policy "product-images read" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "product-images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));
create policy "product-images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));
create policy "product-images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));

-- profile-pictures & review-photos: public read, owner writes inside <uid>/ folder
create policy "user-media read" on storage.objects for select
  using (bucket_id in ('profile-pictures', 'review-photos'));
create policy "user-media own insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('profile-pictures', 'review-photos')
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "user-media own update" on storage.objects for update to authenticated
  using (bucket_id in ('profile-pictures', 'review-photos')
         and (storage.foldername(name))[1] = auth.uid()::text);
create policy "user-media own delete" on storage.objects for delete to authenticated
  using (bucket_id in ('profile-pictures', 'review-photos')
         and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(), 'admin')));

-- chat-attachments: PRIVATE. Customer reads/writes own folder; admins read and write all.
create policy "chat-attachments read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(), 'admin')));
create policy "chat-attachments insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments'
              and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(), 'admin')));
create policy "chat-attachments admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-attachments' and public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- Seed sample products (sample RWF prices)
-- =====================================================================
insert into public.products (slug, name, description, category, price_rwf, stock, spec_1, spec_2) values
('arduino-uno-r4',           'Arduino Uno R4',               'Industry standard microcontroller for prototyping. USB-C, pre-soldered headers.', 'Microcontrollers', 32000,  42,   'ATmega328P', 'USB-C'),
('raspberry-pi-5-8gb',       'Raspberry Pi 5 (8GB)',         'Single-board computer with quad-core ARM Cortex-A76 CPU.',                         'Microcontrollers', 104000, 12,   '8GB RAM', 'Quad-core'),
('resistor-pack-10k',        'Precision Resistor Pack 10kΩ', 'Metal film resistors, low noise. Pack of 50 units.',                                'Components',       5500,   250,  '10KΩ', '±1% Tol'),
('led-rgb-5mm',              '5mm RGB Diffused LED',         'Common cathode RGB LED with diffused lens. Pack of 25.',                           'Lighting',         8800,   1240, '5mm', 'Common Cathode'),
('snake-led-strip',          'Luma-Snake Flexible LED 1m',   'Continuous COB illumination, 320 LEDs per meter, zero hotspots.',                  'Lighting',         18900,  88,   '5.0V', '320 LED/m'),
('futuristic-bulb-void',     'Void Bulb v1',                 'Futuristic filament-style LED bulb. E27 socket, dimmable.',                        'Lighting',         23400,  36,   'E27 / 2200K', 'Dimmable'),
('t12-soldering-station',    'T12 Soldering Station',        'Rapid heat-up digital controller with ESD-safe handle.',                           'Tools',            115700, 18,   '75W', '450°C Max'),
('precision-screwdriver-h6', 'H6 Precision Driver Set',      '24 S2-steel bits with aluminum handle, magnetic case.',                            'Tools',            54600,  64,   '24 bits', 'Magnetic'),
('lipo-battery-2000',        'LiPo Cell 3.7V 2000mAh',       'Single-cell lithium polymer battery with JST connector.',                          'Power',            11600,  412,  '3.7V', '2000mAh'),
('power-supply-30v',         'Bench Power Supply 30V 5A',    'Adjustable laboratory DC power supply with digital readout.',                      'Power',            154700, 9,    '0-30V', '5A Max'),
('pcb-prototype-board',      'Double-sided Prototype PCB',   'FR4 fiberglass prototype board, 7x9cm, 2.54mm pitch.',                             'PCBs',             4200,   530,  '7x9cm', 'FR4'),
('neodymium-magnet-pack',    'Neodymium Magnet Pack',        'N52 grade 8mm disc magnets, pack of 20.',                                          'Components',       9800,   180,  'N52', '8mm Disc'),
('diode-1n4007',             '1N4007 Rectifier Diode Pack',  'General purpose 1A rectifier diodes, pack of 100.',                                'Components',       4600,   880,  '1A', '1000V'),
('capacitor-pack-mixed',     'Electrolytic Capacitor Kit',   'Mixed values 1µF–470µF, 24 values, 240 pieces.',                                   'Components',       14300,  145,  '1µF-470µF', '240pcs'),
('digital-microscope',       'USB Digital Microscope 1000x', 'For SMD soldering and PCB inspection. 1000x zoom, HD sensor.',                     'Tools',            84500,  22,   '1000x', 'USB-C');
