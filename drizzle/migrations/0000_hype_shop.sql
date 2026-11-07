create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- The shop owner's account becomes admin automatically
create or replace function public.grant_owner_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'ramamonjymarielle@gmail.com' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created_owner after insert on auth.users
for each row execute function public.grant_owner_admin();

create table public.products (
  id integer primary key,
  data jsonb not null,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "public read products" on public.products for select to anon, authenticated using (true);
create policy "admin insert products" on public.products for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "admin update products" on public.products for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admin delete products" on public.products for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create sequence public.order_no_seq start 2401;

create table public.orders (
  id bigint generated always as identity primary key,
  no text not null unique,
  created_at timestamptz not null default now(),
  name text not null,
  whatsapp text not null,
  address text not null,
  notes text not null default '',
  zone text not null default 'ville',
  delivery_fee integer not null default 3000,
  items jsonb not null,
  pay_mode text not null,
  subtotal integer not null,
  paid integer not null,
  balance integer not null,
  total integer not null,
  mvola_ref text not null,
  status text not null default 'En attente de paiement'
);
grant select, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "admin read orders" on public.orders for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admin update orders" on public.orders for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admin delete orders" on public.orders for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Customers place orders through this function: prices and stock come from the catalog
create or replace function public.place_order(
  _name text, _whatsapp text, _address text, _notes text, _zone text,
  _pay_mode text, _mvola_ref text, _items jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  it jsonb; prod jsonb; col jsonb; ci int; sz text; q int; price int;
  lines jsonb := '[]'::jsonb; subtotal int := 0; fee int; paid int; o public.orders;
  stock int;
begin
  if length(trim(_name)) < 3 or _whatsapp !~ '^03[23478][0-9]{7}$' or length(trim(_address)) < 8
     or _pay_mode not in ('50','100') or _zone not in ('ville','peripherie')
     or jsonb_array_length(_items) = 0 or jsonb_array_length(_items) > 30 then
    raise exception 'Commande invalide';
  end if;
  fee := case when _zone = 'peripherie' then 4000 else 3000 end;

  for it in select * from jsonb_array_elements(_items) loop
    ci := (it->>'c')::int; sz := nullif(it->>'s',''); q := (it->>'q')::int;
    if q is null or q < 1 or q > 20 then raise exception 'Quantité invalide'; end if;
    select data into prod from public.products where id = (it->>'id')::int for update;
    if prod is null or coalesce((prod->>'visible')::boolean, true) = false then raise exception 'Article indisponible'; end if;
    col := prod->'colors'->ci;
    if col is null then raise exception 'Couleur indisponible'; end if;
    if jsonb_typeof(col->'st') = 'object' then
      stock := coalesce((col->'st'->>sz)::int, 0);
      if stock < q then raise exception 'Stock insuffisant pour %', prod->>'name'; end if;
      prod := jsonb_set(prod, array['colors', ci::text, 'st', sz], to_jsonb(stock - q));
    else
      stock := coalesce((col->>'st')::int, 0);
      if stock < q then raise exception 'Stock insuffisant pour %', prod->>'name'; end if;
      prod := jsonb_set(prod, array['colors', ci::text, 'st'], to_jsonb(stock - q));
    end if;
    update public.products set data = prod, updated_at = now() where id = (it->>'id')::int;
    price := coalesce(nullif(col->>'p','')::int, (prod->>'price')::int);
    subtotal := subtotal + price * q;
    lines := lines || jsonb_build_object('id', (it->>'id')::int, 'name', prod->>'name', 'color', col->>'n',
      'colorHex', col->>'h', 'size', sz, 'price', price, 'q', q);
  end loop;

  paid := case when _pay_mode = '50' then round(subtotal / 2.0) else subtotal end;
  insert into public.orders(no, name, whatsapp, address, notes, zone, delivery_fee, items, pay_mode, subtotal, paid, balance, total, mvola_ref)
  values ('HP-' || nextval('public.order_no_seq'), trim(_name), _whatsapp, trim(_address), coalesce(trim(_notes),''), _zone, fee, lines,
    _pay_mode, subtotal, paid, subtotal + fee - paid, subtotal + fee, trim(_mvola_ref))
  returning * into o;
  return to_jsonb(o);
end $$;
grant execute on function public.place_order(text,text,text,text,text,text,text,jsonb) to anon, authenticated;

insert into public.products(id, sort, data) values
(1, 1, '{"id":1,"name":"Hoodie Oversize HYPE \"Red Emblem\"","category":"Hoodies","price":95000,"descr":"Coton lourd 450 GSM coupe boxy oversize. Broderie poitrine HYPE rouge sang, finitions bords-côtes renforcés. Série limitée Antananarivo.","badge":"DROP","visible":true,"sizes":["S","M","L","XL"],"colors":[{"n":"Noir Onyx","h":"#0A0A0A","i":["/images/hype_hoodie_black_1793613616909.jpg"],"st":{"S":3,"M":5,"L":4,"XL":2}},{"n":"Gris Cendre","h":"#555555","i":["/images/hype_hoodie_black_1793613616909.jpg"],"st":{"S":2,"M":3,"L":2,"XL":1}}]}'),
(2, 2, '{"id":2,"name":"T-Shirt Heavy Drop \"Urban Architecture\"","category":"T-shirts","price":55000,"descr":"T-shirt streetwear coupe large épaules tombantes en jersey 280 GSM peigné. Sérigraphie haute densité poitrine, col montant épais indéformable.","badge":"BEST SELLERS","visible":true,"sizes":["S","M","L","XL","XXL"],"colors":[{"n":"Charbon","h":"#18181B","i":["/images/hype_tshirt_urban_1793613618017.jpg"],"st":{"S":4,"M":6,"L":5,"XL":3,"XXL":2}},{"n":"Blanc Pur","h":"#FFFFFF","i":["/images/hype_tshirt_urban_1793613618017.jpg"],"st":{"S":3,"M":4,"L":3,"XL":1,"XXL":1}}]}'),
(3, 3, '{"id":3,"name":"Sac Tactical Crossbody HYPE","category":"Sacs","price":68000,"descr":"Sac bandoulière technique en nylon balistique déperlant. Boucles rapides noir mat, sangle tissée ajustable, compartiments zippés sécurisés.","badge":"DISPONIBLE DE SUITE","visible":true,"sizes":[],"colors":[{"n":"Noir Mat","h":"#0A0A0A","i":["/images/hype_tactical_bag_1793613618720.jpg"],"st":6},{"n":"Kaki Militaire","h":"#3B4D3C","i":["/images/hype_tactical_bag_1793613618720.jpg"],"st":4}]}'),
(4, 4, '{"id":4,"name":"Casquette 6-Panel \"Stay Ahead\"","category":"Casquettes","price":42000,"original_price":55000,"descr":"Casquette structurée 6 panneaux en sergé de coton épais. Broderie ton sur ton en relief à l’avant, boucle métallique de serrage à l’arrière.","badge":"PROMOTION","visible":true,"sizes":[],"colors":[{"n":"Noir Ton sur Ton","h":"#0A0A0A","i":["/images/hype_cap_street_1793613618946.jpg"],"st":8}]}');