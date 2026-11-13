-- ============================================================================
-- Migration : réaccorder les privilèges SELECT par colonnes
-- La migration 20261113000600 a révoqué SELECT au niveau table, ce qui a aussi
-- effacé les privilèges SELECT par colonne (attacl) sur produits, ventes et
-- ventes_lignes — sans eux, même une lecture de colonnes autorisées est refusée.
-- On réaccorde exactement les mêmes colonnes qu'à l'origine :
-- les colonnes de coût (cout_production, cout_total, cout_unitaire)
-- restent illisibles pour le rôle `authenticated`.
-- ============================================================================

-- Produits : tout sauf cout_production
grant select (id, nom, prix_detail, prix_revendeur, categorie, photo_url,
              description, stock, seuil_alerte, unite, actif, created_at)
  on public.produits to authenticated;

-- Ventes : tout sauf cout_total
grant select (id, date, type_client, mode_paiement, client_id, total,
              montant_paye, moyen_paiement, montant_recu, monnaie_rendue,
              note, user_id, created_at)
  on public.ventes to authenticated;

-- Lignes de vente : tout sauf cout_unitaire
grant select (id, vente_id, produit_id, produit_nom, quantite, prix_unitaire)
  on public.ventes_lignes to authenticated;
