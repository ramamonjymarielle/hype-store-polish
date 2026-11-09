-- Synchronisation temps réel : catalogue et commandes partagés entre tous les appareils.
-- Sans cette publication, les abonnements postgres_changes du site ne reçoivent aucun événement.
alter table public.products replica identity full;
alter table public.orders replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products') then
    alter publication supabase_realtime add table public.products;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;