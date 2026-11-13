-- ============================================================================
-- Migration : statistiques agrégées par client
-- Vue en lecture seule : totaux des ventes (comptant + crédit) et des
-- remboursements, groupés par client. Alimente les pages
-- « Clients & crédits » et « Historique ».
-- Il n'existe pas de statut « annulée » sur les ventes : rien à exclure.
-- ============================================================================

create or replace view public.v_stats_clients as
select
  c.id as client_id,
  coalesce(sum(v.total), 0)::bigint                                    as total_ventes,
  coalesce(sum(v.total) filter (where v.mode_paiement = 'comptant'), 0)::bigint as total_comptant,
  coalesce(sum(v.total) filter (where v.mode_paiement = 'credit'), 0)::bigint  as total_credit,
  coalesce((
    select sum(r.montant) from public.remboursements r where r.client_id = c.id
  ), 0)::bigint                                                        as total_rembourse
from public.clients c
left join public.ventes v on v.client_id = c.id
group by c.id;

grant select on public.v_stats_clients to authenticated;
