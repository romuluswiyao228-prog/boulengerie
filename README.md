# 🥖 GestiPain — Gestion de boulangerie (prototype)

Application web **mobile-first** de gestion interne pour une boulangerie artisanale :
le propriétaire fabrique et vend au détail et à des revendeurs, un employé saisit
les opérations au comptoir, le propriétaire consulte les bilans.

- **Stack** : React 19 + Vite + TypeScript + Tailwind CSS 4 · Supabase (auth, base, rôles) · Recharts · devise **FCFA**
- **Aucun paiement en ligne** — outil de gestion interne uniquement.
- **Deux modes** : connecté à Supabase (`.env` renseigné) ou **mode démo** avec données
  locales (aucune configuration) pour présenter le prototype.

---

## 🚀 Lancement

```bash
# 1. Dépendances
npm install

# 2. Démarrage (mode DÉMO, sans backend)
npm run dev
# → http://localhost:5173
```

### Comptes de test (mode démo)

| Rôle | E-mail | Mot de passe | Accès |
|------|--------|--------------|-------|
| **Propriétaire** | `proprietaire@boulangerie.tg` | `demo1234` | tout : bilans, dépenses, production, produits, utilisateurs |
| **Employé** | `employe@boulangerie.tg` | `demo1234` | ventes, crédits, commandes, invendus |

Sur l'écran de connexion, il suffit de cliquer sur une carte de compte pour pré-remplir
le formulaire, puis **Se connecter**.

> En mode démo, les données (60 jours de ventes, clients, crédits, commandes,
> production, invendus, dépenses) vivent dans le navigateur (`localStorage`).
> Le propriétaire peut les réinitialiser depuis **Utilisateurs → Réinitialiser les données démo**.

---

## 🔗 Brancher Supabase (persistance réelle)

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécutez le contenu de [`supabase/schema.sql`](supabase/schema.sql)
   (tables, triggers métier, vues, **politiques RLS**, privilèges de colonnes).
3. Créez les comptes de test dans **Authentication → Users → Add user**
   (cochez *Auto Confirm User*) :
   - `proprietaire@boulangerie.tg` / `demo1234`
   - `employe@boulangerie.tg` / `demo1234`
4. (Optionnel) Exécutez [`supabase/seed.sql`](supabase/seed.sql) pour charger les
   données de démonstration. Le script attribue les rôles et insère produits,
   clients, ventes, crédits, commandes, production, invendus et dépenses.
5. Copiez `.env.example` en `.env` et renseignez vos clés :

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

6. `npm run dev` — l'application bascule automatiquement sur Supabase
   (supprimez `.env` pour revenir au mode démo).

### Rôle lors de la création d'un compte

Le profil est créé automatiquement par un trigger. Le rôle par défaut est **employé**.
Pour créer directement un propriétaire, renseignez les *User metadata* à la création :

```json
{ "nom": "Kokou ADJOVI", "role": "proprietaire" }
```

Sinon, un propriétaire peut élever un compte depuis **Utilisateurs**.

---

## 📐 Règle de calcul du bénéfice

Formule unique, implémentée dans [`src/lib/utils.ts`](src/lib/utils.ts) (`calculerBilan`)
et documentée en tête de fichier, ainsi que dans la vue SQL `v_bilan_journalier` :

```
BÉNÉFICE = VENTES − COÛT DE PRODUCTION DES PRODUITS VENDUS − DÉPENSES − PERTES
```

- **Ventes** : total des tickets de la période, comptant **et** crédit (une vente à
  crédit compte le jour de la vente, pas le jour du remboursement).
- **Coût de production** : `quantité × coût de production unitaire`, figé sur chaque
  ligne au moment de la vente (historique stable si un prix change).
- **Dépenses** : farine, énergie, main-d'œuvre, transport, autres.
- **Pertes** : invendus valorisés (`quantité × prix de vente détail`).
- Indicateurs complémentaires : **Encaissé** = montant comptant + remboursements reçus ;
  **Crédit accordé** = total des ventes à crédit. Un remboursement **n'est pas** un
  produit : il alimente la trésorerie, pas le bénéfice.

---

## 🧩 Modules et droits

| Module | Propriétaire | Employé |
|---|---|---|
| Produits (lecture des prix) | ✅ | ✅ |
| Produits : création, prix, coûts, actif/inactif | ✅ | ❌ |
| Ventes (détail/revendeur, comptant/crédit) | ✅ | ✅ |
| Historique filtrable (date, produit, client, employé) | ✅ | ✅ |
| Clients & crédits (remboursements partiels/totaux) | ✅ | ✅ |
| Précommandes / livraisons (→ vente) | ✅ | ✅ |
| Production quotidienne | ✅ | ❌ |
| Invendus & pertes | ✅ | ✅ |
| Dépenses | ✅ | ❌ |
| Tableau de bord & bénéfices | ✅ | ❌ |
| Utilisateurs | ✅ | ❌ |

Les droits sont appliqués à **trois niveaux** :

1. **Interface** : entrées de navigation et boutons masqués, page « Accès réservé ».
2. **Données** : l'employé ne reçoit jamais les colonnes de coût (requêtes partielles).
3. **Base** : RLS Supabase + privilèges de colonnes (voir ci-dessous).

---

## 🔒 Sécurité Supabase (RLS)

Dans [`supabase/schema.sql`](supabase/schema.sql) :

- `profils` : rôle (`proprietaire` / `employe`) rattaché à `auth.users`, créé par trigger.
- Helpers SQL : `est_proprietaire()`, `mon_role()`, `est_actif()` (SECURITY DEFINER).
- **Ventes, lignes, remboursements, commandes, invendus** : lecture et **saisie**
  autorisées aux deux rôles, modification/suppression réservée au propriétaire ;
  chaque ligne stocke `user_id` (auteur de l'opération) et `created_at` (horodatage).
- **Dépenses** et **production** : policies `for all` réservées au propriétaire →
  un employé ne lit ni n'écrit ces tables (0 ligne renvoyée).
- **Coûts de production** (donc bénéfices) : RLS ne gère que les *lignes*, donc
  `cout_production` / `cout_total` sont protégés par **privilèges de colonnes** :
  `GRANT SELECT (colonnes autorisées)` pour le rôle `authenticated`. Les coûts ne
  remontent que via les vues `v_couts_produits` et `v_couts_ventes`, filtrées par
  `est_proprietaire()`.
- **Intégrité des coûts** : l'application n'envoie jamais de coût. Un trigger base
  (`remplir_cout_unitaire`) recopie le coût unitaire depuis la fiche produit, et un
  trigger sur `ventes_lignes` recalcule `total`, `cout_total` et `montant_paye`.
- Vues `v_soldes_clients` et `v_bilan_journalier` en `security_invoker`
  (la seconde est en revanche réservée au propriétaire, car elle lit les coûts).

Toutes les opérations enregistrent **l'utilisateur** (`user_id`, `auth.uid()`) et
**l'horodatage** (`created_at`, `now()`).

---

## 🗂️ Structure du projet

```
boulangerie/
├── supabase/
│   ├── schema.sql              # tables, triggers, vues, RLS, privilèges
│   └── seed.sql                # données de démonstration Supabase
├── src/
│   ├── lib/
│   │   ├── types.ts            # modèle de données + libellés FR
│   │   ├── utils.ts            # dates, formatage FCFA, calculerBilan() (formule bénéfice)
│   │   ├── api.ts              # accès données Supabase + mode démo (localStorage)
│   │   ├── demoData.ts         # génération déterministe du jeu de démonstration
│   │   ├── supabase.ts         # client Supabase (null si non configuré)
│   │   └── store.tsx           # contexte global (session, profil, données)
│   ├── components/
│   │   ├── Layout.tsx          # sidebar desktop + barre basse mobile (selon rôle)
│   │   └── ui.tsx              # boutons, champs, modales, compteurs, étiquettes
│   └── pages/
│       ├── Connexion.tsx
│       ├── TableauDeBord.tsx   # jour / semaine / mois + graphiques Recharts
│       ├── Ventes.tsx          # saisie rapide + barre d'action fixe mobile
│       ├── Historique.tsx      # filtres date / produit / client / employé
│       ├── Credits.tsx         # fiches clients, soldes, remboursements
│       ├── Commandes.tsx       # précommandes → livraison → vente
│       ├── Produits.tsx
│       ├── Production.tsx
│       ├── Invendus.tsx
│       ├── Depenses.tsx
│       └── Utilisateurs.tsx
├── index.html
└── vite.config.ts
```

---

## 🧑‍🍳 Ergonomie « comptoir »

- Gros boutons tactiles, produits ajoutés en un appui, quantités `−/+` (pas de 5
  pour les revendeurs).
- Prix appliqué automatiquement selon le type de client (détail / revendeur).
- Sur mobile, **barre d'action fixe** : total, bascule comptant/crédit, validation.
- Navigation basse mobile (Vente, Précommande, Pertes, Crédits, Plus) ;
  sidebar complète sur ordinateur.
- Validation d'une vente en 3 gestes : produit → mode de paiement → encaisser.

## 🛠️ Commandes

```bash
npm run dev       # développement (mode démo si pas de .env)
npm run build     # build de production (tsc + vite)
npm run preview   # prévisualisation du build
```

## Limites connues (prototype)

- En mode démo, le rôle est appliqué côté client (par conception).
- Pas de gestion multi-boulangeries, pas de paiement en ligne, pas d'impression
  de ticket : hors périmètre du prototype.
