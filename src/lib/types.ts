// ============================================================================
// Types du domaine — GestiPain
// ============================================================================

export type Role = 'proprietaire' | 'employe'
export type TypeClient = 'detail' | 'revendeur'
export type ModePaiement = 'comptant' | 'credit' | 'partiel'
export type MoyenPaiement = 'especes' | 'tmoney' | 'flooz' | 'carte' | 'mixte'
export type StatutCommande = 'a_preparer' | 'prete' | 'livree' | 'annulee'
export type MotifPerte = 'perte' | 'reduction' | 'don'
export type CategorieDepense =
  | 'farine'
  | 'energie'
  | 'main_oeuvre'
  | 'transport'
  | 'autres'

export interface CategorieProduit {
  id: string
  nom: string
  actif: boolean
  created_at: string
}

export interface Produit {
  id: string
  nom: string
  prix_detail: number
  prix_revendeur: number
  cout_production: number
  categorie?: string | null
  photo_url?: string | null
  description?: string | null
  stock?: number | null
  seuil_alerte?: number | null
  unite?: string | null
  actif: boolean
  created_at: string
}

export interface StatsClient {
  total_ventes: number
  total_verse: number
  total_comptant: number
  total_credit: number
  total_rembourse: number
}

export interface Client {
  id: string
  nom: string
  telephone: string | null
  type: TypeClient
  /** Solde dû (dette) en FCFA — maintenu par les crédits et les remboursements */
  solde_du: number
  /** Agrégats SQL (vue v_stats_clients) — absent en mode démo */
  stats?: StatsClient
  created_at: string
}

export interface LigneVente {
  id: string
  vente_id: string
  produit_id: string
  produit_nom: string
  quantite: number
  prix_unitaire: number
  cout_unitaire: number
}

export interface Vente {
  id: string
  /** ISO date (YYYY-MM-DD) de l'opération — clé de tous les bilans */
  date: string
  type_client: TypeClient
  mode_paiement: ModePaiement
  client_id: string | null
  client_nom: string | null
  total: number
  /** Coût de production des produits vendus (figé au moment de la vente) */
  cout_total: number
  /** Montant effectivement encaissé le jour de la vente (0 si crédit) */
  montant_paye: number
  /** Part du total restant à charge du client (crédit ou partiel) */
  reste_a_payer?: number
  moyen_paiement?: MoyenPaiement | null
  montant_recu?: number | null
  monnaie_rendue?: number | null
  note: string | null
  user_id: string
  user_email: string
  created_at: string
  lignes: LigneVente[]
}

export interface Remboursement {
  id: string
  client_id: string
  client_nom: string
  montant: number
  date: string
  note: string | null
  user_id: string
  user_email: string
  created_at: string
}

export interface LigneCommande {
  id: string
  commande_id: string
  produit_id: string
  produit_nom: string
  quantite: number
  prix_unitaire: number
}

export interface Commande {
  id: string
  client_id: string
  client_nom: string
  date_livraison: string
  adresse: string | null
  statut: StatutCommande
  note: string | null
  total: number
  vente_id: string | null
  user_id: string
  user_email: string
  created_at: string
  lignes: LigneCommande[]
}

export interface Production {
  id: string
  date: string
  produit_id: string
  produit_nom: string
  quantite: number
  user_id: string
  user_email: string
  created_at: string
}

export interface Invendu {
  id: string
  date: string
  produit_id: string
  produit_nom: string
  quantite: number
  /** valeur perdue = quantité × prix de vente (détail par défaut) */
  valeur_perdue: number
  motif: MotifPerte
  note: string | null
  user_id: string
  user_email: string
  created_at: string
}

export interface Depense {
  id: string
  date: string
  categorie: CategorieDepense
  montant: number
  note: string | null
  user_id: string
  user_email: string
  created_at: string
}

export interface Profil {
  id: string
  email: string
  nom: string
  role: Role
}

export interface AppData {
  categories: CategorieProduit[]
  produits: Produit[]
  clients: Client[]
  ventes: Vente[]
  remboursements: Remboursement[]
  commandes: Commande[]
  productions: Production[]
  invendus: Invendu[]
  depenses: Depense[]
}

// --- Libellés FR -------------------------------------------------------------

export const LIBELLE_TYPE_CLIENT: Record<TypeClient, string> = {
  detail: 'Détail',
  revendeur: 'Revendeur',
}

export const LIBELLE_PAIEMENT: Record<ModePaiement, string> = {
  comptant: 'Comptant',
  credit: 'Crédit',
  partiel: 'Partiel',
}

export const LIBELLE_MOYEN_PAIEMENT: Record<MoyenPaiement, string> = {
  especes: 'Espèces',
  tmoney: 'TMoney',
  flooz: 'Flooz',
  carte: 'Carte bancaire',
  mixte: 'Paiement mixte',
}

export const CATEGORIES_PRODUITS_DEFAUT = [
  'Baguettes',
  'Pains ordinaires',
  'Pains spéciaux',
  'Croissants',
  'Chocolatines',
  'Gâteaux',
  'Biscuits',
  'Viennoiseries',
  'Boissons',
  'Autres',
] as const

export const LIBELLE_STATUT: Record<StatutCommande, string> = {
  a_preparer: 'À préparer',
  prete: 'Prête',
  livree: 'Livrée',
  annulee: 'Annulée',
}

export const LIBELLE_MOTIF: Record<MotifPerte, string> = {
  perte: 'Perte',
  reduction: 'Réduction',
  don: 'Don',
}

export const LIBELLE_CATEGORIE: Record<CategorieDepense, string> = {
  farine: 'Farine',
  energie: 'Énergie',
  main_oeuvre: "Main-d'œuvre",
  transport: 'Transport',
  autres: 'Autres',
}
