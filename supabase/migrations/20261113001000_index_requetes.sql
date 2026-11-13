-- Index sur les colonnes filtrées ou jointes fréquemment
-- (recherches par client, jointures produit, tris par date de création)

create index if not exists idx_ventes_client on public.ventes(client_id);
create index if not exists idx_ventes_created on public.ventes(created_at desc);
create index if not exists idx_ventes_lignes_produit on public.ventes_lignes(produit_id);
create index if not exists idx_remboursements_client on public.remboursements(client_id);
create index if not exists idx_commandes_client on public.commandes(client_id);
create index if not exists idx_commandes_lignes_produit on public.commandes_lignes(produit_id);
create index if not exists idx_productions_produit on public.productions(produit_id);
create index if not exists idx_invendus_produit on public.invendus(produit_id);
create index if not exists idx_produits_created on public.produits(created_at);
