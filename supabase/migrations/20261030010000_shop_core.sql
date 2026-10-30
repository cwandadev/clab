-- =====================================================================
-- clab-shop — shop core (adapted from the MOA Mart blueprint)
--  * the database owns prices, totals, stock and payment state
--  * pawaPay results go through ONE function: apply_payment_result
--  * every stock change is logged; nothing about money is erased
-- =====================================================================

-- ---------- Orders: new columns ----------
alter table public.orders
  add column order_code            text unique,
  add column expires_at            timestamptz,
  add column delivery_notes        text,
  add column paid_amount_rwf       integer,
  add column refund_status         text check (refund_status in ('pending', 'completed', 'failed')),
  add column cancelled_reason      text,
  add column archived_at           timestamptz,
  add column hidden_by_customer_at timestamptz;

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed', 'expired'));

-- Human-friendly order code, e.g. CL-7K3P9Q (no 0/O/1/I to avoid misreading)
create or replace function public.gen_order_code()
returns text language plpgsql as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  code text;
begin
  loop
    code := 'CL-';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.orders where order_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.orders_set_code()
returns trigger language plpgsql as $$
begin
  if new.order_code is null then new.order_code := public.gen_order_code(); end if;
  return new;
end;
$$;
create trigger orders_set_code before insert on public.orders
  for each row execute function public.orders_set_code();

-- ---------- Notifications (in-app bell) ----------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,
  severity   text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create or replace function public.notify_user(_user uuid, _kind text, _severity text, _title text, _body text, _link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, severity, title, body, link)
  select _user, _kind, _severity, _title, _body, _link where _user is not null;
$$;

create or replace function public.notify_admins(_kind text, _severity text, _title text, _body text, _link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, severity, title, body, link)
  select user_id, _kind, _severity, _title, _body, _link from public.user_roles where role = 'admin';
$$;

-- ---------- Stock ledger ----------
create table public.stock_movements (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_id   uuid references public.orders(id) on delete set null,
  change     integer not null,
  stock_after integer not null,
  reason     text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

-- Every change to products.stock is logged. Stock functions set the reason;
-- anything else (an admin editing the product) is logged as a manual edit.
create or replace function public.log_stock_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock is distinct from old.stock then
    insert into public.stock_movements (product_id, order_id, change, stock_after, reason, created_by)
    values (
      new.id,
      nullif(current_setting('clab.stock_order', true), '')::uuid,
      new.stock - old.stock,
      new.stock,
      coalesce(nullif(current_setting('clab.stock_reason', true), ''), 'manual edit'),
      auth.uid()
    );
    if new.stock <= new.low_stock_threshold and old.stock > old.low_stock_threshold then
      perform public.notify_admins(
        case when new.stock = 0 then 'stock_out' else 'stock_low' end,
        case when new.stock = 0 then 'warning' else 'info' end,
        case when new.stock = 0 then 'Out of stock: ' else 'Running low: ' end || new.name,
        new.stock || ' left (alert at ' || new.low_stock_threshold || ')',
        '/admin/products/edit/' || new.id
      );
    end if;
  end if;
  return new;
end;
$$;
create trigger products_log_stock after update of stock on public.products
  for each row execute function public.log_stock_change();

-- Re-define the two stock functions so they label their movements.
create or replace function public.reserve_order_stock(_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  it record;
begin
  perform 1 from public.orders where id = _order_id and not stock_reserved for update;
  if not found then return; end if;

  perform set_config('clab.stock_order', _order_id::text, true);
  perform set_config('clab.stock_reason', 'order reserved', true);

  for it in select product_id, quantity, product_name from public.order_items
            where order_id = _order_id and product_id is not null loop
    update public.products set stock = stock - it.quantity
     where id = it.product_id and stock >= it.quantity;
    if not found then
      raise exception 'OUT_OF_STOCK: %', it.product_name;
    end if;
  end loop;

  update public.orders set stock_reserved = true where id = _order_id;
  perform set_config('clab.stock_order', '', true);
  perform set_config('clab.stock_reason', '', true);
end;
$$;

create or replace function public.release_order_stock(_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.orders where id = _order_id and stock_reserved for update;
  if not found then return; end if;

  perform set_config('clab.stock_order', _order_id::text, true);
  perform set_config('clab.stock_reason', 'order released', true);

  update public.products p set stock = p.stock + oi.quantity
    from public.order_items oi
   where oi.order_id = _order_id and oi.product_id = p.id;

  update public.orders set stock_reserved = false where id = _order_id;
  perform set_config('clab.stock_order', '', true);
  perform set_config('clab.stock_reason', '', true);
end;
$$;

-- ---------- Payment events and refunds ----------
create table public.payment_events (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  deposit_id    uuid not null,
  status        text not null,
  amount_rwf    numeric,
  currency      text,
  failure_code  text,
  raw           jsonb,
  created_at    timestamptz not null default now()
);
create index payment_events_deposit_idx on public.payment_events (deposit_id);
create index payment_events_order_idx on public.payment_events (order_id, created_at desc);

create table public.refunds (
  id           uuid primary key,  -- = pawaPay refundId, stored BEFORE calling pawaPay
  order_id     uuid not null references public.orders(id) on delete cascade,
  deposit_id   uuid not null,
  amount_rwf   integer not null,
  status       text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  failure_code text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index refunds_order_idx on public.refunds (order_id);

-- ---------- Rule: payment fields cannot be changed by a signed-in user ----------
-- Direct API updates run as role "authenticated". Our security-definer functions
-- (and the server's secret key) run as the owner, so they pass.
create or replace function public.orders_protect_payment_fields()
returns trigger language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;

  if new.subtotal_rwf      is distinct from old.subtotal_rwf
  or new.shipping_rwf      is distinct from old.shipping_rwf
  or new.total_rwf         is distinct from old.total_rwf
  or new.user_id           is distinct from old.user_id
  or new.payment_method    is distinct from old.payment_method
  or new.pawapay_deposit_id is distinct from old.pawapay_deposit_id
  or new.paid_at           is distinct from old.paid_at
  or new.paid_amount_rwf   is distinct from old.paid_amount_rwf
  or new.stock_reserved    is distinct from old.stock_reserved
  or new.expires_at        is distinct from old.expires_at
  or new.refund_status     is distinct from old.refund_status
  or new.order_code        is distinct from old.order_code then
    raise exception 'PAYMENT_FIELDS_LOCKED';
  end if;

  if new.status is distinct from old.status then
    -- cancelling must go through admin_cancel_order (returns stock, starts refund)
    if new.status in ('cancelled', 'expired', 'failed', 'pending') then
      raise exception 'USE_CANCEL_FUNCTION';
    end if;
    -- a mobile money order becomes paid only when pawaPay confirms it
    if new.status = 'paid' and old.payment_method = 'momo' then
      raise exception 'PAID_ONLY_BY_PROVIDER';
    end if;
    if old.status in ('pending', 'cancelled', 'expired', 'failed') and old.payment_method = 'momo' then
      raise exception 'ORDER_NOT_PAID';
    end if;
  end if;
  return new;
end;
$$;
create trigger orders_protect before update on public.orders
  for each row execute function public.orders_protect_payment_fields();

-- Tell the customer when their order moves forward (admin changes status).
create or replace function public.orders_notify_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('processing', 'shipped', 'delivered') then
    perform public.notify_user(new.user_id, 'order_' || new.status, 'info',
      'Order ' || new.order_code || ' is ' || new.status,
      case new.status
        when 'processing' then 'We are packing your order.'
        when 'shipped' then coalesce('Tracking: ' || new.tracking_number, 'It is on the way.')
        else 'Thank you for shopping with tieflab.' end,
      '/orders/' || new.id);
  end if;
  return new;
end;
$$;
create trigger orders_notify_status after update of status on public.orders
  for each row execute function public.orders_notify_status();

-- =====================================================================
-- Checkout: the browser sends product ids and quantities only.
-- =====================================================================
create or replace function public.shipping_fee_rwf(_city text, _subtotal integer, _pickup boolean)
returns integer language sql immutable as $$
  select case
    when _pickup then 0
    when lower(trim(_city)) like '%kigali%' then case when _subtotal >= 15000 then 0 else 2000 end
    else 8000
  end;
$$;

create or replace function public.create_checkout_order(
  _user_id uuid,
  _items jsonb,               -- [{ "product_id": uuid, "quantity": int }]
  _customer jsonb,            -- name, email, phone, city, address, notes
  _payment_method text,
  _pickup boolean,
  _anonymous boolean,
  _display_currency text
) returns table (order_id uuid, order_code text, total_rwf integer, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_order   public.orders%rowtype;
  v_sub     integer;
  v_lines   integer;
  v_found   integer;
  v_cart    jsonb;
begin
  if _payment_method not in ('momo', 'cash') then raise exception 'BAD_PAYMENT_METHOD'; end if;
  if jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then raise exception 'EMPTY_CART'; end if;

  perform public.release_expired_reservations();

  -- merge duplicate lines and validate quantities (no temp tables: safe to call twice in one transaction)
  select jsonb_agg(jsonb_build_object('product_id', product_id, 'quantity', quantity))
    into v_cart
    from (select (x->>'product_id')::uuid as product_id, sum((x->>'quantity')::int)::int as quantity
            from jsonb_array_elements(_items) x group by 1) t;
  if exists (select 1 from jsonb_to_recordset(v_cart) c(product_id uuid, quantity int)
              where quantity < 1 or quantity > 99) then raise exception 'BAD_QUANTITY'; end if;

  select count(*), count(p.id), coalesce(sum(p.price_rwf * c.quantity), 0)
    into v_lines, v_found, v_sub
    from jsonb_to_recordset(v_cart) c(product_id uuid, quantity int)
    left join public.products p on p.id = c.product_id and p.active;
  if v_found <> v_lines then raise exception 'PRODUCT_UNAVAILABLE'; end if;

  insert into public.orders (
    user_id, customer_name, customer_email, customer_phone, city, address, delivery_notes,
    subtotal_rwf, shipping_rwf, total_rwf, display_currency, status, payment_method,
    pickup_option, anonymous, expires_at
  ) values (
    _user_id,
    left(trim(_customer->>'name'), 120),
    left(trim(_customer->>'email'), 255),
    left(trim(_customer->>'phone'), 40),
    left(trim(coalesce(_customer->>'city', 'Kigali')), 80),
    left(trim(coalesce(_customer->>'address', '')), 400),
    left(trim(_customer->>'notes'), 500),
    v_sub,
    public.shipping_fee_rwf(_customer->>'city', v_sub, _pickup),
    v_sub + public.shipping_fee_rwf(_customer->>'city', v_sub, _pickup),
    coalesce(_display_currency, 'RWF'),
    'pending', _payment_method, _pickup, _anonymous,
    case when _payment_method = 'momo' then now() + interval '15 minutes' end
  ) returning * into v_order;

  insert into public.order_items (order_id, product_id, product_name, unit_price_rwf, quantity)
  select v_order.id, p.id, p.name, p.price_rwf, c.quantity
    from jsonb_to_recordset(v_cart) c(product_id uuid, quantity int)
    join public.products p on p.id = c.product_id;

  perform public.reserve_order_stock(v_order.id);   -- raises OUT_OF_STOCK, rolling everything back

  if _payment_method = 'cash' then
    perform public.notify_admins('order_new', 'info', 'New cash order ' || v_order.order_code,
      v_order.customer_name || ' · ' || v_order.total_rwf || ' RWF', '/admin/orders?o=' || v_order.id);
  end if;

  return query select v_order.id, v_order.order_code, v_order.total_rwf, v_order.expires_at;
end;
$$;

-- Store the depositId BEFORE calling pawaPay (their consistency rule).
create or replace function public.start_payment(_order_id uuid, _user_id uuid, _deposit_id uuid, _provider text, _phone text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
begin
  select * into o from public.orders where id = _order_id for update;
  if not found or o.user_id is distinct from _user_id then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.payment_method <> 'momo' then raise exception 'NOT_MOMO'; end if;
  if o.status <> 'pending' then raise exception 'ORDER_NOT_PAYABLE'; end if;
  if o.expires_at < now() then raise exception 'ORDER_EXPIRED'; end if;

  update public.orders
     set pawapay_deposit_id = _deposit_id, payment_provider = _provider,
         payer_phone = _phone, payment_failure = null
   where id = _order_id;
  insert into public.payment_events (order_id, deposit_id, status, amount_rwf, currency)
  values (_order_id, _deposit_id, 'INITIATED', o.total_rwf, 'RWF');
  return o.total_rwf;
end;
$$;

-- The ONLY place a deposit result changes an order. Safe to call many times.
create or replace function public.apply_payment_result(
  _deposit_id uuid, _status text, _amount numeric, _currency text, _failure_code text, _raw jsonb
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
  o public.orders%rowtype;
  v_late boolean := false;
begin
  select order_id into v_order_id from public.payment_events where deposit_id = _deposit_id limit 1;
  if v_order_id is null then return 'unknown_deposit'; end if;

  -- one row per (deposit, final status) is enough
  if not exists (select 1 from public.payment_events where deposit_id = _deposit_id and status = _status) then
    insert into public.payment_events (order_id, deposit_id, status, amount_rwf, currency, failure_code, raw)
    values (v_order_id, _deposit_id, _status, _amount, _currency, _failure_code, _raw);
  end if;

  select * into o from public.orders where id = v_order_id for update;

  if _status = 'COMPLETED' then
    if o.status in ('paid', 'processing', 'shipped', 'delivered') then
      if o.pawapay_deposit_id = _deposit_id then return 'already_paid'; end if;
      perform public.notify_admins('payment_duplicate', 'critical', 'Paid twice: ' || o.order_code,
        'A second payment of ' || _amount || ' ' || _currency || ' arrived. Refund it.', '/admin/orders?o=' || o.id);
      return 'duplicate';
    end if;

    if _currency is distinct from 'RWF' or _amount is distinct from o.total_rwf::numeric then
      update public.orders set payment_failure = 'AMOUNT_MISMATCH' where id = o.id;
      perform public.notify_admins('payment_mismatch', 'critical', 'Amount mismatch: ' || o.order_code,
        'Received ' || _amount || ' ' || coalesce(_currency, '?') || ', expected ' || o.total_rwf || ' RWF.',
        '/admin/orders?o=' || o.id);
      return 'mismatch';
    end if;

    if o.status in ('expired', 'cancelled', 'failed') then
      v_late := true;
      begin
        perform public.reserve_order_stock(o.id);
      exception when others then
        perform public.notify_admins('payment_late', 'critical', 'Late payment, no stock: ' || o.order_code,
          'Paid after the order expired and the items are gone. Refund it.', '/admin/orders?o=' || o.id);
        return 'late_no_stock';
      end;
    end if;

    update public.orders
       set status = 'paid', paid_at = now(), paid_amount_rwf = _amount::integer,
           pawapay_deposit_id = _deposit_id, expires_at = null, payment_failure = null,
           cancelled_reason = null
     where id = o.id;

    perform public.notify_user(o.user_id, 'order_paid', 'info', 'Payment received',
      'Order ' || o.order_code || ' is confirmed.', '/orders/' || o.id);
    perform public.notify_admins('order_paid', case when v_late then 'warning' else 'info' end,
      case when v_late then 'Late payment accepted: ' else 'New paid order ' end || o.order_code,
      o.customer_name || ' · ' || o.total_rwf || ' RWF', '/admin/orders?o=' || o.id);
    return 'paid';

  elsif _status = 'FAILED' then
    if o.status = 'pending' and o.pawapay_deposit_id = _deposit_id then
      update public.orders set payment_failure = coalesce(_failure_code, 'UNSPECIFIED_FAILURE') where id = o.id;
    end if;
    return 'failed';
  end if;

  return 'pending';
end;
$$;

-- Unpaid mobile money orders give their stock back after 15 minutes.
create or replace function public.release_expired_reservations()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  for r in select id from public.orders
            where status = 'pending' and payment_method = 'momo' and expires_at < now()
            for update skip locked loop
    perform public.release_order_stock(r.id);
    update public.orders set status = 'expired', cancelled_reason = 'Not paid within 15 minutes' where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Customer cancels an order that was never paid.
create or replace function public.cancel_my_unpaid_order(_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
begin
  select * into o from public.orders where id = _order_id for update;
  if not found or o.user_id is distinct from auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status <> 'pending' then raise exception 'ORDER_NOT_CANCELLABLE'; end if;
  perform public.release_order_stock(o.id);
  update public.orders set status = 'cancelled', cancelled_reason = 'Cancelled by customer', expires_at = null
   where id = o.id;
end;
$$;

-- Admin cancels any open order. Returns the deposit to refund, if one was paid.
create or replace function public.admin_cancel_order(_order_id uuid, _reason text)
returns table (refund_deposit_id uuid, refund_amount_rwf integer)
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_paid boolean;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'NOT_ADMIN'; end if;
  select * into o from public.orders where id = _order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status in ('cancelled', 'expired', 'failed', 'delivered') then raise exception 'ORDER_NOT_CANCELLABLE'; end if;

  v_paid := o.payment_method = 'momo' and o.paid_at is not null;
  perform public.release_order_stock(o.id);
  update public.orders
     set status = 'cancelled', expires_at = null,
         cancelled_reason = coalesce(nullif(trim(_reason), ''), 'Cancelled by the shop'),
         refund_status = case when v_paid then 'pending' else refund_status end
   where id = o.id;

  perform public.notify_user(o.user_id, 'order_cancelled', 'warning', 'Order ' || o.order_code || ' was cancelled',
    case when v_paid then 'Your refund is on its way to your mobile money wallet.' else coalesce(_reason, '') end,
    '/orders/' || o.id);

  if v_paid then
    return query select o.pawapay_deposit_id, o.paid_amount_rwf;
  end if;
end;
$$;

create or replace function public.apply_refund_result(_refund_id uuid, _status text, _failure_code text, _raw jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  r public.refunds%rowtype;
  v_new text;
begin
  select * into r from public.refunds where id = _refund_id for update;
  if not found then return 'unknown_refund'; end if;
  v_new := case _status when 'COMPLETED' then 'completed' when 'FAILED' then 'failed' else 'pending' end;
  if r.status = v_new then return v_new; end if;
  if r.status = 'completed' then return 'completed'; end if;

  update public.refunds set status = v_new, failure_code = _failure_code, updated_at = now() where id = r.id;
  update public.orders set refund_status = v_new where id = r.order_id;
  insert into public.payment_events (order_id, deposit_id, status, amount_rwf, currency, failure_code, raw)
  values (r.order_id, r.deposit_id, 'REFUND_' || _status, r.amount_rwf, 'RWF', _failure_code, _raw);

  if v_new = 'failed' then
    perform public.notify_admins('refund_failed', 'critical', 'Refund failed',
      coalesce(_failure_code, 'Unknown reason') || '. Retry from the order.', '/admin/orders?o=' || r.order_id);
  elsif v_new = 'completed' then
    perform public.notify_user((select user_id from public.orders where id = r.order_id), 'refund_done', 'info',
      'Refund sent', r.amount_rwf || ' RWF was returned to your wallet.', '/orders/' || r.order_id);
  end if;
  return v_new;
end;
$$;

-- ---------- Soft delete ----------
create or replace function public.hide_my_order(_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders set hidden_by_customer_at = now()
   where id = _order_id and user_id = auth.uid()
     and status in ('delivered', 'cancelled', 'expired', 'failed')
     and coalesce(refund_status, '') <> 'pending';
  if not found then raise exception 'ORDER_NOT_HIDEABLE'; end if;
end;
$$;

create or replace function public.admin_archive_order(_order_id uuid, _archive boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'NOT_ADMIN'; end if;
  update public.orders set archived_at = case when _archive then now() end
   where id = _order_id
     and (not _archive or (status in ('delivered', 'cancelled', 'expired', 'failed')
                           and coalesce(refund_status, '') <> 'pending'));
  if not found then raise exception 'ORDER_NOT_ARCHIVABLE'; end if;
end;
$$;

-- ---------- Support chat helpers ----------
create or replace function public.chat_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  prev record;
begin
  select is_from_admin, created_at into prev from public.chat_messages
   where user_id = new.user_id and created_at < new.created_at order by created_at desc limit 1;

  if new.is_from_admin then
    perform public.notify_user(new.user_id, 'chat_reply', 'info', 'Support replied', left(new.message, 140), '/account#chat-section');
  elsif prev is null or prev.is_from_admin or prev.created_at < now() - interval '30 minutes' then
    -- notify once per conversation turn, not on every message
    perform public.notify_admins('chat_new', 'info', 'New support message',
      left(new.message, 140), '/admin/chats?u=' || new.user_id);
  end if;
  return null;
end;
$$;
create trigger chat_after_insert after insert on public.chat_messages
  for each row execute function public.chat_after_insert();

-- Customers: at most 8 messages per minute.
create or replace function public.chat_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.is_from_admin and (
    select count(*) from public.chat_messages
     where user_id = new.user_id and not is_from_admin and created_at > now() - interval '1 minute') >= 8 then
    raise exception 'RATE_LIMITED';
  end if;
  return new;
end;
$$;
create trigger chat_rate_limit before insert on public.chat_messages
  for each row execute function public.chat_rate_limit();

create or replace function public.admin_chat_threads()
returns table (user_id uuid, display_name text, email text, avatar_url text,
               last_message text, last_at timestamptz, needs_reply boolean, total integer)
language sql stable security definer set search_path = public as $$
  select distinct on (m.user_id)
         m.user_id, p.display_name, p.email, p.avatar_url,
         m.message, m.created_at, not m.is_from_admin,
         (select count(*)::int from public.chat_messages x where x.user_id = m.user_id)
    from public.chat_messages m
    join public.profiles p on p.id = m.user_id
   where public.has_role(auth.uid(), 'admin')
   order by m.user_id, m.created_at desc;
$$;

-- ---------- Analytics (numbers computed in the database) ----------
create or replace function public.analytics_overview(_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
  v_since timestamptz := date_trunc('day', now()) - make_interval(days => greatest(_days, 1) - 1);
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'NOT_ADMIN'; end if;

  select jsonb_build_object(
    'today', jsonb_build_object(
      'orders',  (select count(*) from orders where created_at >= date_trunc('day', now())),
      'revenue', (select coalesce(sum(total_rwf), 0) from orders where paid_at >= date_trunc('day', now()) and coalesce(refund_status, '') <> 'completed'
                    or (payment_method = 'cash' and status = 'delivered' and updated_at >= date_trunc('day', now())))
    ),
    'action', jsonb_build_object(
      'to_dispatch',    (select count(*) from orders where archived_at is null and (status = 'paid' or (payment_method = 'cash' and status = 'pending'))),
      'processing',     (select count(*) from orders where archived_at is null and status = 'processing'),
      'awaiting_payment', (select count(*) from orders where status = 'pending' and payment_method = 'momo'),
      'refunds_pending', (select count(*) from orders where refund_status = 'pending'),
      'chats_waiting',  (select count(*) from (
                           select distinct on (user_id) is_from_admin from chat_messages order by user_id, created_at desc
                         ) t where not t.is_from_admin),
      'low_stock',      (select count(*) from products where active and stock > 0 and stock <= low_stock_threshold),
      'out_of_stock',   (select count(*) from products where active and stock = 0)
    ),
    'period', jsonb_build_object(
      'days', _days,
      'revenue', (select coalesce(sum(total_rwf), 0) from orders where paid_at >= v_since and coalesce(refund_status, '') <> 'completed'),
      'paid_orders', (select count(*) from orders where paid_at >= v_since and coalesce(refund_status, '') <> 'completed'),
      'customers', (select count(distinct user_id) from orders where paid_at >= v_since and coalesce(refund_status, '') <> 'completed'),
      'avg_order', (select coalesce(round(avg(total_rwf)), 0) from orders where paid_at >= v_since and coalesce(refund_status, '') <> 'completed')
    ),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'orders', coalesce(x.n, 0), 'revenue', coalesce(x.rev, 0)) order by d), '[]'::jsonb)
                from generate_series(v_since, date_trunc('day', now()), interval '1 day') d
                left join (select date_trunc('day', paid_at) dd, count(*) n, sum(total_rwf) rev
                             from orders where paid_at >= v_since and coalesce(refund_status, '') <> 'completed' group by 1) x on x.dd = d),
    'top_products', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                       select oi.product_name as name, sum(oi.quantity)::int as units, sum(oi.quantity * oi.unit_price_rwf)::int as revenue
                         from order_items oi join orders o on o.id = oi.order_id
                        where o.paid_at >= v_since and coalesce(o.refund_status, '') <> 'completed'
                        group by oi.product_name order by units desc limit 5) t),
    'status_counts', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (
                        select status, count(*) n from orders where created_at >= v_since group by status) s)
  ) into v;
  return v;
end;
$$;

-- =====================================================================
-- Grants and RLS
-- =====================================================================
grant select, insert, update, delete on public.notifications, public.stock_movements, public.payment_events, public.refunds to authenticated;
grant all on public.notifications, public.stock_movements, public.payment_events, public.refunds to service_role;

alter table public.notifications   enable row level security;
alter table public.stock_movements enable row level security;
alter table public.payment_events  enable row level security;
alter table public.refunds         enable row level security;

create policy "notifications: own read" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications: own mark read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: own delete" on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create policy "stock_movements: admin read" on public.stock_movements for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "payment_events: admin read" on public.payment_events for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "refunds: own or admin read" on public.refunds for select to authenticated
  using (public.has_role(auth.uid(), 'admin')
         or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- customers no longer see orders they removed from their list (the shop still does)
drop policy "orders: own or admin read" on public.orders;
create policy "orders: own or admin read" on public.orders for select to authenticated
  using ((user_id = auth.uid() and hidden_by_customer_at is null) or public.has_role(auth.uid(), 'admin'));

-- function permissions: server-only vs signed-in
do $$
declare f text;
begin
  foreach f in array array[
    'gen_order_code()', 'orders_set_code()', 'log_stock_change()', 'orders_protect_payment_fields()',
    'orders_notify_status()', 'chat_after_insert()', 'chat_rate_limit()',
    'notify_user(uuid, text, text, text, text, text)', 'notify_admins(text, text, text, text, text)',
    'create_checkout_order(uuid, jsonb, jsonb, text, boolean, boolean, text)',
    'start_payment(uuid, uuid, uuid, text, text)',
    'apply_payment_result(uuid, text, numeric, text, text, jsonb)',
    'apply_refund_result(uuid, text, text, jsonb)',
    'release_expired_reservations()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;

  foreach f in array array[
    'cancel_my_unpaid_order(uuid)', 'admin_cancel_order(uuid, text)', 'hide_my_order(uuid)',
    'admin_archive_order(uuid, boolean)', 'admin_chat_threads()', 'analytics_overview(integer)',
    'shipping_fee_rwf(text, integer, boolean)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;
grant execute on function public.shipping_fee_rwf(text, integer, boolean) to anon;

alter publication supabase_realtime add table public.notifications;

-- =====================================================================
-- Expiry job: every minute (Supabase Cron / pg_cron)
-- =====================================================================
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('release-expired-reservations', '* * * * *', 'select public.release_expired_reservations()');

-- ---------- Profile fields the account page already uses ----------
alter table public.profiles
  add column if not exists phone_country_code text default '+250',
  add column if not exists location_country   text default 'Rwanda',
  add column if not exists billing_address    text,
  add column if not exists billing_code       text;
