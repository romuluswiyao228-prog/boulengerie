-- ============================================================================
-- Migration : droits d'écriture manquants pour les utilisateurs connectés
-- Les politiques RLS existent déjà et filtrent par rôle ; il manquait les
-- privilèges de table (GRANT) pour le rôle `authenticated`.
-- Sans cela : "permission denied for table ..." à l'insertion.
-- ============================================================================

-- Tables métier : CRUD complet.
-- La sécurité reste assurée par les politiques RLS (employé/propriétaire).
grant select, insert, update, delete on
  public.clients,
  public.ventes,
  public.ventes_lignes,
  public.remboursements,
  public.commandes,
  public.commandes_lignes,
  public.productions,
  public.invendus,
  public.depenses,
  public.profils
to authenticated;

-- Produits : écriture autorisée (INSERT/UPDATE/DELETE).
-- La lecture reste volontairement limitée par colonnes :
-- `cout_production` n'est pas sélectionnable par l'employé
-- (les grants SELECT par colonnes existants sont conservés).
grant insert, update, delete on public.produits to authenticated;
