-- ============================================================================
-- Migration : rétablir la confidentialité des colonnes de coût
-- La migration précédente a accordé SELECT au niveau table sur ventes et
-- ventes_lignes, ce qui exposait cout_total / cout_unitaire aux employés.
-- On revient à des privilèges SELECT limités aux colonnes non sensibles
-- (les GRANT SELECT (colonnes) existants sont conservés).
-- Les droits INSERT/UPDATE/DELETE accordés précédemment sont inchangés.
-- ============================================================================

revoke select on public.ventes, public.ventes_lignes, public.produits
  from authenticated;
