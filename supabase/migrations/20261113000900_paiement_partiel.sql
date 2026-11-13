-- ============================================================================
-- Migration : paiement partiel (partiel = acompte + reste à charge du client)
-- - ajoute la valeur 'partiel' à l'enum mode_paiement
-- - ajoute ventes.reste_a_payer (total - montant_paye) avec backfill
-- - met à jour le trigger de recalcul pour ne plus écraser montant_paye
--   en mode partiel et pour maintenir reste_a_payer
-- - met à jour la vue v_stats_clients (total_verse, crédit = reste à payer)
-- ============================================================================

-- 1. Nouveau mode de paiement
alter type public.mode_paiement add value if not exists 'partiel';

-- 2. Colonne reste à payer sur la vente
alter table public.ventes
  add column if not exists reste_a_payer integer not null default 0;

-- Backfill : comptant → 0, crédit → total, cohérent avec montant_paye existant
update public.ventes
   set reste_a_payer = greatest(total - montant_paye, 0)
 where reste_a_payer = 0 and total <> montant_paye;

-- 3. Trigger : recalcule total/cout_total sans détruire l'acompte partiel,
--    et maintient reste_a_payer = total - montant_payeeffectif
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

  update public.ventes v set
    montant_paye = case
      when mode_paiement = 'comptant' then v.total
      when mode_paiement = 'partiel' then least(greatest(coalesce(v.montant_paye, 0), 0), v.total)
      else 0
    end,
    reste_a_payer = greatest(v.total - case
      when mode_paiement = 'comptant' then v.total
      when mode_paiement = 'partiel' then least(greatest(coalesce(v.montant_paye, 0), 0), v.total)
      else 0
    end, 0)
  where v.id = v_id;

  return null;
end;
$$;

-- 4. Lecture de la nouvelle colonne (le SELECT global reste par colonnes)
grant select (reste_a_payer) on public.ventes to authenticated;

-- 5. Vue stats clients : + total réellement versé via les ventes,
--    total_credit = montants mis à crédit (crédit + reste des partiels)
--    (DROP + CREATE : OR REPLACE ne permet pas d'insérer une colonne au milieu)
drop view if exists public.v_stats_clients;
create view public.v_stats_clients as
select
  c.id as client_id,
  coalesce(sum(v.total), 0)::bigint                                       as total_ventes,
  coalesce(sum(v.montant_paye), 0)::bigint                                as total_verse,
  coalesce(sum(v.total) filter (where v.mode_paiement = 'comptant'), 0)::bigint as total_comptant,
  coalesce(sum(v.reste_a_payer), 0)::bigint                               as total_credit,
  coalesce((
    select sum(r.montant) from public.remboursements r where r.client_id = c.id
  ), 0)::bigint                                                           as total_rembourse
from public.clients c
left join public.ventes v on v.client_id = c.id
group by c.id;

grant select on public.v_stats_clients to authenticated;
