-- ============================================================================
-- Migration : catalogue visuel + caisse + stock
-- Ajoute les champs produits/ventes nécessaires sans supprimer les données.
-- ============================================================================

-- Produits : catalogue visuel, stock et seuil d'alerte
alter table public.produits
  add column if not exists categorie text,
  add column if not exists photo_url text,
  add column if not exists description text,
  add column if not exists stock integer check (stock >= 0),
  add column if not exists seuil_alerte integer not null default 0 check (seuil_alerte >= 0),
  add column if not exists unite text not null default 'unité';

-- Ventes : moyen de paiement détaillé, montant reçu et monnaie
alter table public.ventes
  add column if not exists moyen_paiement text,
  add column if not exists montant_recu integer,
  add column if not exists monnaie_rendue integer not null default 0;

alter table public.ventes
  drop constraint if exists ventes_moyen_paiement_check;
alter table public.ventes
  add constraint ventes_moyen_paiement_check
  check (moyen_paiement is null or moyen_paiement in ('especes','tmoney','flooz','carte','mixte'));

-- Lecture des nouveaux champs par les utilisateurs connectés
-- (le coût de production reste protégé par les privilèges existants)
grant select (categorie, photo_url, description, stock, seuil_alerte, unite)
  on public.produits to authenticated;
grant select (moyen_paiement, montant_recu, monnaie_rendue)
  on public.ventes to authenticated;

-- Stock : déduction unique côté serveur, plancher à 0
create or replace function public.decrementer_stock(p_produit_id uuid, p_quantite integer)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.produits
     set stock = greatest(stock - greatest(coalesce(p_quantite, 0), 0), 0)
   where id = p_produit_id
     and stock is not null;
end;
$$;

create or replace function public.ajuster_stock(p_produit_id uuid, p_delta integer)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.produits
     set stock = greatest(stock + coalesce(p_delta, 0), 0)
   where id = p_produit_id
     and stock is not null;
end;
$$;

grant execute on function public.decrementer_stock(uuid, integer) to authenticated;
grant execute on function public.ajuster_stock(uuid, integer) to authenticated;

-- Bucket public pour les photos produits (les URLs restent stables)
insert into storage.buckets (id, name, public)
values ('produits', 'produits', true)
on conflict (id) do nothing;

drop policy if exists produits_storage_select on storage.objects;
create policy produits_storage_select on storage.objects
  for select using (bucket_id = 'produits');

drop policy if exists produits_storage_insert on storage.objects;
create policy produits_storage_insert on storage.objects
  for insert with check (bucket_id = 'produits' and auth.uid() is not null);

drop policy if exists produits_storage_update on storage.objects;
create policy produits_storage_update on storage.objects
  for update using (bucket_id = 'produits' and auth.uid() is not null);

drop policy if exists produits_storage_delete on storage.objects;
create policy produits_storage_delete on storage.objects
  for delete using (bucket_id = 'produits' and auth.uid() is not null);
