-- Catégories du catalogue produits
create table if not exists public.categories_produits (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null unique,
  actif      boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.categories_produits enable row level security;

drop policy if exists p_categories_select on public.categories_produits;
create policy p_categories_select on public.categories_produits
  for select using (public.est_actif());

drop policy if exists p_categories_ecriture on public.categories_produits;
create policy p_categories_ecriture on public.categories_produits
  for all using (public.est_proprietaire()) with check (public.est_proprietaire());

grant select, insert, update, delete on public.categories_produits to authenticated;

insert into public.categories_produits (nom) values
  ('Baguettes'),
  ('Pains ordinaires'),
  ('Pains spéciaux'),
  ('Croissants'),
  ('Chocolatines'),
  ('Gâteaux'),
  ('Biscuits'),
  ('Viennoiseries'),
  ('Boissons')
on conflict (nom) do nothing;
