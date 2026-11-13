-- ============================================================================
--  GestiPain — Schéma Supabase complet
--  Gestion de boulangerie (prototype) — PostgreSQL / Supabase
-- ----------------------------------------------------------------------------
--  À exécuter dans Supabase → SQL Editor (une seule fois, sur un projet vide).
--  Contient : types, tables, triggers métier, vues et politiques RLS.
--
--  RÈGLE MÉTIER (calculée côté application, voir src/lib/utils.ts) :
--    BÉNÉFICE = VENTES − COÛT DE PRODUCTION DES PRODUITS VENDUS
--               − DÉPENSES − PERTES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Types énumérés
-- ---------------------------------------------------------------------------
do $$ begin
  create type role_app as enum ('proprietaire', 'employe');
exception when duplicate_object then null; end $$;

do $$ begin
  create type type_client as enum ('detail', 'revendeur');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mode_paiement as enum ('comptant', 'credit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type statut_commande as enum ('a_preparer', 'prete', 'livree', 'annulee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type motif_perte as enum ('perte', 'reduction', 'don');
exception when duplicate_object then null; end $$;

do $$ begin
  create type categorie_depense as enum ('farine', 'energie', 'main_oeuvre', 'transport', 'autres');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Profils utilisateurs (rôle applicatif rattaché à auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profils (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  nom          text not null default '',
  role         role_app not null default 'employe',
  created_at   timestamptz not null default now()
);

-- Création automatique du profil à l'inscription
create or replace function public.creer_profil_automatique()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profils (id, email, nom, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nom', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::role_app, 'employe')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.creer_profil_automatique();

-- Helpers RLS (SECURITY DEFINER pour éviter la récursion sur profils)
create or replace function public.mon_role()
returns text
language sql stable security definer set search_path = public
as $$ select role::text from public.profils where id = auth.uid(); $$;

create or replace function public.est_proprietaire()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select role = 'proprietaire' from public.profils where id = auth.uid()), false); $$;

create or replace function public.est_actif()
returns boolean
language sql stable security definer set search_path = public
as $$ select auth.uid() is not null; $$;

-- ---------------------------------------------------------------------------
-- 3. Tables métier
-- ---------------------------------------------------------------------------

-- 3.1 Produits
create table if not exists public.produits (
  id              uuid primary key default gen_random_uuid(),
  nom             text not null,
  prix_detail     integer not null check (prix_detail >= 0),
  prix_revendeur  integer not null check (prix_revendeur >= 0),
  cout_production integer not null check (cout_production >= 0),
  actif           boolean not null default true,
  created_at      timestamptz not null default now()
);

-- 3.2 Clients
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  telephone   text,
  type        type_client not null default 'detail',
  created_at  timestamptz not null default now()
);

-- 3.3 Ventes (une ligne d'en-tête par ticket)
create table if not exists public.ventes (
  id            uuid primary key default gen_random_uuid(),
  date          date not null default current_date,
  type_client   type_client not null,
  mode_paiement mode_paiement not null,
  client_id     uuid references public.clients(id) on delete set null,
  total         integer not null default 0,
  cout_total    integer not null default 0,   -- coût de production figé des produits vendus
  montant_paye  integer not null default 0,   -- encaissé le jour J (0 si crédit)
  note          text,
  user_id       uuid not null default auth.uid() references auth.users(id),
  created_at    timestamptz not null default now(),
  -- un crédit exige un client
  constraint credit_avec_client check (mode_paiement = 'comptant' or client_id is not null)
);

create table if not exists public.ventes_lignes (
  id            uuid primary key default gen_random_uuid(),
  vente_id      uuid not null references public.ventes(id) on delete cascade,
  produit_id    uuid references public.produits(id) on delete set null,
  produit_nom   text not null,               -- figé (historique stable)
  quantite      integer not null check (quantite > 0),
  prix_unitaire integer not null check (prix_unitaire >= 0),
  cout_unitaire integer not null default 0 check (cout_unitaire >= 0)
);
create index if not exists idx_ventes_lignes_vente on public.ventes_lignes(vente_id);

-- Recalcul automatique des totaux d'une vente à partir de ses lignes
create or replace function public.recalculer_totaux_vente()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := coalesce(new.vente_id, old.vente_id);
begin
  update public.ventes v set
    total = coalesce((select sum(l.quantite * l.prix_unitaire) from public.ventes_lignes l where l.vente_id = v_id), 0),
    cout_total = coalesce((select sum(l.quantite * l.cout_unitaire) from public.ventes_lignes l where l.vente_id = v_id), 0)
  where v.id = v_id;

  update public.ventes set montant_paye = case when mode_paiement = 'comptant' then total else 0 end
  where id = v_id;

  return null;
end;
$$;

drop trigger if exists trg_recalcul_vente on public.ventes_lignes;
create trigger trg_recalcul_vente
  after insert or update or delete on public.ventes_lignes
  for each row execute function public.recalculer_totaux_vente();

-- 3.4 Remboursements (crédits)
create table if not exists public.remboursements (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  montant    integer not null check (montant > 0),
  date       date not null default current_date,
  note       text,
  user_id    uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

-- 3.5 Précommandes / livraisons
create table if not exists public.commandes (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  date_livraison date not null,
  adresse        text,
  statut         statut_commande not null default 'a_preparer',
  note           text,
  vente_id       uuid references public.ventes(id) on delete set null, -- vente créée à la livraison
  user_id        uuid not null default auth.uid() references auth.users(id),
  created_at     timestamptz not null default now()
);
create index if not exists idx_commandes_date on public.commandes(date_livraison);

create table if not exists public.commandes_lignes (
  id            uuid primary key default gen_random_uuid(),
  commande_id   uuid not null references public.commandes(id) on delete cascade,
  produit_id    uuid references public.produits(id) on delete set null,
  produit_nom   text not null,
  quantite      integer not null check (quantite > 0),
  prix_unitaire integer not null check (prix_unitaire >= 0)
);
create index if not exists idx_commandes_lignes_cmd on public.commandes_lignes(commande_id);

-- 3.6 Production quotidienne
create table if not exists public.productions (
  id         uuid primary key default gen_random_uuid(),
  date       date not null default current_date,
  produit_id uuid references public.produits(id) on delete set null,
  produit_nom text not null,
  quantite   integer not null check (quantite >= 0),
  user_id    uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_productions_date on public.productions(date);

-- 3.7 Invendus et pertes
create table if not exists public.invendus (
  id         uuid primary key default gen_random_uuid(),
  date       date not null default current_date,
  produit_id uuid references public.produits(id) on delete set null,
  produit_nom text not null,
  quantite   integer not null check (quantite > 0),
  valeur_perdue integer not null default 0,
  motif      motif_perte not null default 'perte',
  note       text,
  user_id    uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_invendus_date on public.invendus(date);

-- 3.8 Dépenses
create table if not exists public.depenses (
  id         uuid primary key default gen_random_uuid(),
  date       date not null default current_date,
  categorie  categorie_depense not null default 'autres',
  montant    integer not null check (montant >= 0),
  note       text,
  user_id    uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_depenses_date on public.depenses(date);

-- ---------------------------------------------------------------------------
-- 4. Vues utilitaires
-- ---------------------------------------------------------------------------

-- Solde dû par client = somme des ventes à crédit − somme des remboursements
-- security_invoker : les vues respectent les politiques RLS des tables sous-jacentes
create or replace view public.v_soldes_clients
with (security_invoker = true) as
select
  c.id,
  c.nom,
  c.telephone,
  c.type,
  coalesce((select sum(v.total) from public.ventes v
            where v.client_id = c.id and v.mode_paiement = 'credit'), 0)::int
  - coalesce((select sum(r.montant) from public.remboursements r
              where r.client_id = c.id), 0)::int as solde_du
from public.clients c;

-- Bilan journalier (le calcul du bénéfice reprend la règle métier)
-- Vue de bilan : SECURITY DEFINER (elle lit les coûts) + réservée au propriétaire
create or replace view public.v_bilan_journalier as
select
  d.jour,
  coalesce(v.total_ventes, 0)  as total_ventes,
  coalesce(v.cout_total, 0)    as cout_production,
  coalesce(v.comptant, 0)      as ventes_comptant,
  coalesce(v.credit, 0)        as credit_accorde,
  coalesce(r.montant, 0)       as remboursements,
  coalesce(dep.montant, 0)     as depenses,
  coalesce(i.perte, 0)         as pertes,
  -- BÉNÉFICE = ventes − coût production − dépenses − pertes
  coalesce(v.total_ventes, 0) - coalesce(v.cout_total, 0)
    - coalesce(dep.montant, 0) - coalesce(i.perte, 0) as benefice
from (
  select distinct date as jour from public.ventes
  union select distinct date from public.depenses
  union select distinct date from public.invendus
) d
left join (
  select date,
         sum(total) as total_ventes,
         sum(cout_total) as cout_total,
         sum(case when mode_paiement = 'comptant' then total else 0 end) as comptant,
         sum(case when mode_paiement = 'credit' then total else 0 end) as credit
  from public.ventes group by date
) v on v.date = d.jour
left join (
  select date, sum(montant) as montant from public.remboursements group by date
) r on r.date = d.jour
left join (
  select date, sum(montant) as montant from public.depenses group by date
) dep on dep.date = d.jour
left join (
  select date, sum(valeur_perdue) as perte from public.invendus group by date
) i on i.date = d.jour
where public.est_proprietaire();

-- ---------------------------------------------------------------------------
-- 5. Sécurité — Row Level Security
--    Propriétaire : tout.   Employé : saisie ventes / crédits / commandes /
--    invendus + lecture produits actifs. Aucun accès aux dépenses, à la
--    production, aux réglages produits ni aux vues de bilan.
-- ---------------------------------------------------------------------------
alter table public.profils          enable row level security;
alter table public.produits         enable row level security;
alter table public.clients          enable row level security;
alter table public.ventes           enable row level security;
alter table public.ventes_lignes    enable row level security;
alter table public.remboursements   enable row level security;
alter table public.commandes        enable row level security;
alter table public.commandes_lignes enable row level security;
alter table public.productions      enable row level security;
alter table public.invendus         enable row level security;
alter table public.depenses         enable row level security;

-- --- profils
drop policy if exists p_profils_select on public.profils;
-- Tout utilisateur connecté peut lire les profils : nécessaire pour afficher
-- l'auteur (nom/e-mail) des opérations dans l'historique et les bilans.
create policy p_profils_select on public.profils
  for select using (public.est_actif());

drop policy if exists p_profils_update_self on public.profils;
create policy p_profils_update_self on public.profils
  for update using (id = auth.uid())
  with check (id = auth.uid() and role::text = public.mon_role());

drop policy if exists p_profils_admin on public.profils;
create policy p_profils_admin on public.profils
  for all using (public.est_proprietaire()) with check (public.est_proprietaire());

-- --- produits : lecture par tous les connectés (l'employé doit voir les prix),
--     écriture réservée au propriétaire.
drop policy if exists p_produits_select on public.produits;
create policy p_produits_select on public.produits
  for select using (public.est_actif());

drop policy if exists p_produits_ecriture on public.produits;
create policy p_produits_ecriture on public.produits
  for all using (public.est_proprietaire()) with check (public.est_proprietaire());

-- --- clients : l'employé crée des fiches et consulte les soldes (crédits)
drop policy if exists p_clients_select on public.clients;
create policy p_clients_select on public.clients for select using (public.est_actif());
drop policy if exists p_clients_insert on public.clients;
create policy p_clients_insert on public.clients for insert with check (public.est_actif());
drop policy if exists p_clients_update on public.clients;
create policy p_clients_update on public.clients for update using (public.est_actif());
drop policy if exists p_clients_delete on public.clients;
create policy p_clients_delete on public.clients for delete using (public.est_proprietaire());

-- --- ventes : saisie autorisée aux deux rôles, modification/suppression au propriétaire
drop policy if exists p_ventes_select on public.ventes;
create policy p_ventes_select on public.ventes for select using (public.est_actif());
drop policy if exists p_ventes_insert on public.ventes;
create policy p_ventes_insert on public.ventes for insert with check (public.est_actif() and user_id = auth.uid());
drop policy if exists p_ventes_update on public.ventes;
create policy p_ventes_update on public.ventes for update using (public.est_proprietaire());
drop policy if exists p_ventes_delete on public.ventes;
create policy p_ventes_delete on public.ventes for delete using (public.est_proprietaire());

drop policy if exists p_ventes_lignes_select on public.ventes_lignes;
create policy p_ventes_lignes_select on public.ventes_lignes for select using (public.est_actif());
drop policy if exists p_ventes_lignes_insert on public.ventes_lignes;
create policy p_ventes_lignes_insert on public.ventes_lignes for insert with check (
  exists (select 1 from public.ventes v where v.id = vente_id and (v.user_id = auth.uid() or public.est_proprietaire()))
);
drop policy if exists p_ventes_lignes_admin on public.ventes_lignes;
create policy p_ventes_lignes_admin on public.ventes_lignes for all using (public.est_proprietaire());

-- --- remboursements : saisie par les deux rôles
drop policy if exists p_remb_select on public.remboursements;
create policy p_remb_select on public.remboursements for select using (public.est_actif());
drop policy if exists p_remb_insert on public.remboursements;
create policy p_remb_insert on public.remboursements for insert with check (public.est_actif() and user_id = auth.uid());
drop policy if exists p_remb_admin on public.remboursements;
create policy p_remb_admin on public.remboursements for all using (public.est_proprietaire());

-- --- commandes / lignes
drop policy if exists p_cmd_select on public.commandes;
create policy p_cmd_select on public.commandes for select using (public.est_actif());
drop policy if exists p_cmd_insert on public.commandes;
create policy p_cmd_insert on public.commandes for insert with check (public.est_actif() and user_id = auth.uid());
drop policy if exists p_cmd_update on public.commandes;
create policy p_cmd_update on public.commandes for update using (public.est_actif());
drop policy if exists p_cmd_delete on public.commandes;
create policy p_cmd_delete on public.commandes for delete using (public.est_proprietaire());

drop policy if exists p_cmdl_select on public.commandes_lignes;
create policy p_cmdl_select on public.commandes_lignes for select using (public.est_actif());
drop policy if exists p_cmdl_insert on public.commandes_lignes;
create policy p_cmdl_insert on public.commandes_lignes for insert with check (public.est_actif());
drop policy if exists p_cmdl_admin on public.commandes_lignes;
create policy p_cmdl_admin on public.commandes_lignes for all using (public.est_proprietaire());

-- --- invendus : saisie par les deux rôles
drop policy if exists p_invendus_select on public.invendus;
create policy p_invendus_select on public.invendus for select using (public.est_actif());
drop policy if exists p_invendus_insert on public.invendus;
create policy p_invendus_insert on public.invendus for insert with check (public.est_actif() and user_id = auth.uid());
drop policy if exists p_invendus_admin on public.invendus;
create policy p_invendus_admin on public.invendus for all using (public.est_proprietaire());

-- --- productions : RÉSERVÉ AU PROPRIÉTAIRE (non listé dans les droits employé)
drop policy if exists p_prod_all on public.productions;
create policy p_prod_all on public.productions
  for all using (public.est_proprietaire()) with check (public.est_proprietaire());

-- --- dépenses : RÉSERVÉ AU PROPRIÉTAIRE (masquées à l'employé)
drop policy if exists p_dep_all on public.depenses;
create policy p_dep_all on public.depenses
  for all using (public.est_proprietaire()) with check (public.est_proprietaire());

-- ---------------------------------------------------------------------------
-- 5 bis. Confidentiel : les coûts de production (donc les bénéfices) ne sont
--        lisibles QUE par le propriétaire, même via une requête directe.
--        RLS est « ligne » : on complète par des privilèges de colonnes, et
--        l'employé — qui doit créer des ventes — n'envoie jamais de coût :
--        il est calculé en base (trigger + vue propriétaire).
-- ---------------------------------------------------------------------------

-- a) Ventes : l'employé ne peut pas lire cout_total
revoke select on public.ventes from authenticated;
grant select (id, date, type_client, mode_paiement, client_id, total,
              montant_paye, note, user_id, created_at)
  on public.ventes to authenticated;

-- b) Lignes de vente : ni cout_unitaire ni accès en écriture directe au coût
revoke select on public.ventes_lignes from authenticated;
grant select (id, vente_id, produit_id, produit_nom, quantite, prix_unitaire)
  on public.ventes_lignes to authenticated;

-- c) Le coût unitaire est TOUJOURS recopié depuis la fiche produit par la base.
create or replace function public.remplir_cout_unitaire()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.cout_unitaire := coalesce(
    (select p.cout_production from public.produits p where p.id = new.produit_id), 0);
  return new;
end;
$$;

drop trigger if exists trg_cout_unitaire on public.ventes_lignes;
create trigger trg_cout_unitaire
  before insert or update of produit_id, quantite on public.ventes_lignes
  for each row execute function public.remplir_cout_unitaire();

-- d) Produits : le coût de production n'est pas lisible par l'employé
revoke select on public.produits from authenticated;
grant select (id, nom, prix_detail, prix_revendeur, actif, created_at)
  on public.produits to authenticated;

-- e) Vues réservées au propriétaire (SECURITY DEFINER + filtre de rôle)
create or replace view public.v_couts_ventes as
select v.id as vente_id, v.cout_total
from public.ventes v
where public.est_proprietaire();

create or replace view public.v_couts_produits as
select p.id as produit_id, p.cout_production
from public.produits p
where public.est_proprietaire();

grant select on public.v_couts_ventes to authenticated;
grant select on public.v_couts_produits to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Données de démonstration (optionnel)
--    Les comptes de test doivent d'abord être créés dans
--    Authentication → Users (voir README), puis exécuter le bloc ci-dessous.
--    Il rattache les données au propriétaire de démonstration.
-- ---------------------------------------------------------------------------
-- Voir supabase/seed.sql pour le jeu de données de démonstration.
