drop policy if exists "public read product images" on storage.objects;
drop policy if exists "admin insert product images" on storage.objects;
drop policy if exists "admin update product images" on storage.objects;
drop policy if exists "admin delete product images" on storage.objects;

create policy "public read product images" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "admin insert product images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));
create policy "admin update product images" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));
create policy "admin delete product images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));

-- 2) Stock : uniquement pour les articles « DISPONIBLE DE SUITE ». Les autres sont sur commande (pas de stock).
create or replace function public.place_order(
  _name text, _whatsapp text, _address text, _notes text, _zone text,
  _pay_mode text, _mvola_ref text, _items jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  it jsonb; prod jsonb; col jsonb; ci int; sz text; q int; price int;
  lines jsonb := '[]'::jsonb; subtotal int := 0; fee int; paid int; o public.orders;
  stock int; has_stock boolean;
begin
  if length(trim(_name)) < 3 or _whatsapp !~ '^03[23478][0-9]{7}$' or length(trim(_address)) < 8
     or _pay_mode not in ('50','100') or _zone not in ('ville','peripherie')
     or jsonb_array_length(_items) = 0 or jsonb_array_length(_items) > 30 then
    raise exception 'Commande invalide';
  end if;
  fee := case when _zone = 'peripherie' then 4000 else 3000 end;

  for it in select * from jsonb_array_elements(_items) loop
    ci := (it->>'c')::int; sz := nullif(it->>'s',''); q := (it->>'q')::int;
    if q is null or q < 1 or q > 99 then raise exception 'Quantité invalide'; end if;
    select data into prod from public.products where id = (it->>'id')::int for update;
    if prod is null or coalesce((prod->>'visible')::boolean, true) = false then raise exception 'Article indisponible'; end if;
    col := prod->'colors'->ci;
    if col is null then raise exception 'Couleur indisponible'; end if;

    has_stock := upper(trim(coalesce(prod->>'badge', ''))) = 'DISPONIBLE DE SUITE';
    if has_stock then
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
    end if;

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