-- ============================================================================
--  GestiPain — Jeu de données de démonstration pour Supabase
-- ----------------------------------------------------------------------------
--  À exécuter APRÈS schema.sql.
--
--  IMPORTANT — créez d'abord les deux comptes de test dans
--  Authentication → Users → Add user (cochez « Auto Confirm User ») :
--     proprietaire@boulangerie.tg   /  demo1234
--     employe@boulangerie.tg        /  demo1234
--
--  Puis renseignez leurs e-mails dans les variables ci-dessous si besoin,
--  et exécutez ce script. Il :
--    1. attribue les rôles dans public.profils,
--    2. insère produits, clients, ventes, crédits, commandes, productions,
--       invendus et dépenses sur les 30 derniers jours.
-- ============================================================================

do $seed$
declare
  v_owner_email text := 'proprietaire@boulangerie.tg';
  v_employe_email text := 'employe@boulangerie.tg';
  v_owner uuid;
  v_employe uuid;
  v_pain uuid; v_baguette uuid; v_tradition uuid;
  v_croissant uuid; v_choco uuid; v_brioche uuid;
  v_c1 uuid; v_c2 uuid; v_c3 uuid; v_c4 uuid; v_c5 uuid;
  v_vente uuid;
  v_jour date;
  i integer;
begin
  -- 1. Rôles ---------------------------------------------------------------
  select id into v_owner from public.profils where email = v_owner_email;
  select id into v_employe from public.profils where email = v_employe_email;

  if v_owner is null then
    raise exception 'Compte introuvable : %. Créez-le dans Authentication → Users.', v_owner_email;
  end if;

  update public.profils set role = 'proprietaire', nom = 'Kokou ADJOVI' where id = v_owner;
  if v_employe is not null then
    update public.profils set role = 'employe', nom = 'Kafui AMOUZOU' where id = v_employe;
  else
    v_employe := v_owner;
  end if;

  -- 2. Produits ------------------------------------------------------------
  delete from public.ventes_lignes;
  delete from public.ventes;
  delete from public.commandes_lignes;
  delete from public.commandes;
  delete from public.remboursements;
  delete from public.invendus;
  delete from public.productions;
  delete from public.depenses;
  delete from public.clients;
  delete from public.produits;

  insert into public.produits (nom, prix_detail, prix_revendeur, cout_production, actif)
  values ('Pain de mie', 500, 400, 260, true) returning id into v_pain;
  insert into public.produits (nom, prix_detail, prix_revendeur, cout_production, actif)
  values ('Baguette', 200, 150, 95, true) returning id into v_baguette;
  insert into public.produits (nom, prix_detail, prix_revendeur, cout_production, actif)
  values ('Pain traditionnel', 300, 230, 140, true) returning id into v_tradition;
  insert into public.produits (nom, prix_detail, prix_revendeur, cout_production, actif)
  values ('Croissant', 150, 100, 70, true) returning id into v_croissant;
  insert into public.produits (nom, prix_detail, prix_revendeur, cout_production, actif)
  values ('Pain au chocolat', 200, 150, 100, true) returning id into v_choco;
  insert into public.produits (nom, prix_detail, prix_revendeur, cout_production, actif)
  values ('Brioche', 400, 320, 190, true) returning id into v_brioche;
  insert into public.produits (nom, prix_detail, prix_revendeur, cout_production, actif)
  values ('Gâteau au yaourt', 1000, 800, 520, false);

  -- 3. Clients -------------------------------------------------------------
  insert into public.clients (nom, telephone, type) values ('Kossi AGBEKO', '+228 90 12 34 56', 'revendeur') returning id into v_c1;
  insert into public.clients (nom, telephone, type) values ('Boutique Adjo', '+228 91 22 33 44', 'revendeur') returning id into v_c2;
  insert into public.clients (nom, telephone, type) values ('Afi MENSAH', '+228 92 55 66 77', 'detail') returning id into v_c3;
  insert into public.clients (nom, telephone, type) values ('Kiosque Nadège', '+228 93 44 55 66', 'revendeur') returning id into v_c4;
  insert into public.clients (nom, telephone, type) values ('Restaurant Le Baobab', '+228 97 11 22 33', 'revendeur') returning id into v_c5;

  -- 4. Ventes / remboursements / production / invendus / dépenses (30 jours) -
  for i in 0..29 loop
    v_jour := current_date - i;

    -- Production du matin
    insert into public.productions (date, produit_id, produit_nom, quantite, user_id) values
      (v_jour, v_baguette,   'Baguette',          200 + (i * 7) % 60, v_owner),
      (v_jour, v_pain,       'Pain de mie',        70 + (i * 5) % 30, v_owner),
      (v_jour, v_tradition,  'Pain traditionnel',  80 + (i * 3) % 20, v_owner),
      (v_jour, v_croissant,  'Croissant',          50 + (i * 4) % 20, v_owner);

    -- 8 à 11 tickets par jour
    for j in 1..(8 + (i % 4)) loop
      insert into public.ventes (date, type_client, mode_paiement, client_id, user_id, note)
      values (
        v_jour,
        case when (i + j) % 3 = 0 then 'revendeur'::type_client else 'detail'::type_client end,
        case when (i + j) % 7 = 0 then 'credit'::mode_paiement else 'comptant'::mode_paiement end,
        case when (i + j) % 7 = 0 then (case when (i + j) % 2 = 0 then v_c1 else v_c4 end) else null end,
        case when (i + j) % 2 = 0 then v_employe else v_owner end,
        null
      ) returning id into v_vente;

      insert into public.ventes_lignes (vente_id, produit_id, produit_nom, quantite, prix_unitaire)
      values (v_vente, v_baguette, 'Baguette', 40 + j * 8,
              case when (i + j) % 3 = 0 then 150 else 200 end);

      insert into public.ventes_lignes (vente_id, produit_id, produit_nom, quantite, prix_unitaire)
      values (v_vente, v_pain, 'Pain de mie', 6 + j * 2,
              case when (i + j) % 3 = 0 then 400 else 500 end);

      insert into public.ventes_lignes (vente_id, produit_id, produit_nom, quantite, prix_unitaire)
      values (v_vente, v_croissant, 'Croissant', 8 + j, 150);

      if (i + j) % 4 = 0 then
        insert into public.ventes_lignes (vente_id, produit_id, produit_nom, quantite, prix_unitaire)
        values (v_vente, v_brioche, 'Brioche', 4 + j, 400);
      end if;
    end loop;

    -- Remboursements
    if i % 4 = 0 then
      insert into public.remboursements (client_id, montant, date, note, user_id)
      values (v_c1, 2000, v_jour, 'Remboursement partiel', v_employe);
    end if;

    -- Invendus
    if i % 3 = 0 then
      insert into public.invendus (date, produit_id, produit_nom, quantite, valeur_perdue, motif, user_id)
      values (v_jour, v_pain, 'Pain de mie', 4, 2000, 'perte', v_employe);
    end if;

    -- Dépenses
    if i % 5 = 0 then
      insert into public.depenses (date, categorie, montant, note, user_id)
      values (v_jour, 'farine', 25000, 'Sac de 50 kg', v_owner);
    end if;
    if i % 7 = 0 then
      insert into public.depenses (date, categorie, montant, note, user_id)
      values (v_jour, 'main_oeuvre', 30000, 'Salaire hebdomadaire', v_owner);
    end if;
  end loop;

  -- 5. Précommandes (dont demain) -----------------------------------------
  insert into public.commandes (client_id, date_livraison, adresse, statut, note, user_id)
  values (v_c5, current_date + 1, 'Rue des Palmiers, quartier Bè', 'a_preparer', 'Pain bien cuit', v_employe)
  returning id into v_vente;

  insert into public.commandes_lignes (commande_id, produit_id, produit_nom, quantite, prix_unitaire)
  values (v_vente, v_baguette, 'Baguette', 80, 150),
         (v_vente, v_tradition, 'Pain traditionnel', 40, 230);

  insert into public.commandes (client_id, date_livraison, adresse, statut, note, user_id)
  values (v_c4, current_date + 1, 'Marché Assigamé, allée 4', 'prete', null, v_employe)
  returning id into v_vente;

  insert into public.commandes_lignes (commande_id, produit_id, produit_nom, quantite, prix_unitaire)
  values (v_vente, v_brioche, 'Brioche', 30, 320);

  raise notice 'Données de démonstration insérées avec succès.';
end $seed$;
