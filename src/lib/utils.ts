// ============================================================================
// utils.ts — Formatage, dates et calculs métier
// ----------------------------------------------------------------------------
// RÈGLE DE CALCUL DU BÉNÉFICE (documentée, utilisée partout dans l'app)
//
//   BÉNÉFICE = VENTES − COÛT DE PRODUCTION DES PRODUITS VENDUS − DÉPENSES − PERTES
//
//   • VENTES      = somme des totaux des ventes de la période (comptant + crédit).
//                   Une vente à crédit compte dans le chiffre d'affaires le jour
//                   de la vente, pas le jour du remboursement.
//   • COÛT PROD.  = somme (quantité × coût de production unitaire) figée sur
//                   chaque ligne de vente au moment de la vente.
//   • DÉPENSES    = dépenses saisies sur la période (farine, énergie, ...).
//   • PERTES      = valeur des invendus de la période (quantité × prix de vente).
//   • Le remboursement d'un crédit n'est PAS un produit : c'est un encaissement
//     d'une vente déjà comptée (il n'entre donc pas dans le bénéfice).
//
//   Encaissé (trésorerie) = montant payé comptant + remboursements reçus.
//   Crédit accordé        = total des ventes à crédit de la période.
// ============================================================================

export const FCFA = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' FCFA'

export const FCFAcourt = (n: number) => {
  const v = Math.round(n || 0)
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (Math.abs(v) >= 1_000) return Math.round(v / 1000) + 'k'
  return String(v)
}

/** Date locale au format YYYY-MM-DD (jamais UTC pour éviter les décalages) */
export const toISODate = (d: Date = new Date()): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const j = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${j}`
}

export const aujourdhui = () => toISODate()
export const demain = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toISODate(d)
}

export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export const formatDateFR = (iso: string) => {
  if (!iso) return '—'
  const d = new Date((iso.length > 10 ? iso : iso + 'T00:00:00'))
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const formatDateLongueFR = (iso: string) => {
  const d = new Date((iso.length > 10 ? iso : iso + 'T00:00:00'))
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export const formatHeure = (isoDateTime: string) => {
  const d = new Date(isoDateTime)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Libellé court "lun. 13" pour les graphiques */
export const formatJourCourt = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })

/** Début de semaine (lundi) */
export const debutSemaine = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  const jour = (d.getDay() + 6) % 7 // lundi = 0
  d.setDate(d.getDate() - jour)
  return toISODate(d)
}

export const debutMois = (iso: string) => iso.slice(0, 8) + '01'
export const finMois = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return toISODate(fin)
}
export const moisPrecedent = (iso: string) => {
  const d = new Date(iso.slice(0, 8) + '01T00:00:00')
  d.setMonth(d.getMonth() - 1)
  return toISODate(d)
}

export const NOM_MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
export const libelleMois = (iso: string) => {
  const d = new Date(iso.slice(0, 7) + '-01T00:00:00')
  return `${NOM_MOIS[d.getMonth()]} ${d.getFullYear()}`
}

/** Génère une liste de dates ISO entre deux bornes incluses */
export const plageDates = (debut: string, fin: string): string[] => {
  const out: string[] = []
  let cur = debut
  let garde = 0
  while (cur <= fin && garde++ < 400) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

export const uid = () =>
  'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9)

/**
 * Bilan agrégé sur une période [debut, fin] (bornes ISO incluses).
 * Implémentation exacte de la règle de bénéfice ci-dessus.
 */
export function calculerBilan(
  data: {
    ventes: { date: string; total: number; cout_total: number; montant_paye: number; mode_paiement: string }[]
    remboursements: { date: string; montant: number }[]
    depenses: { date: string; montant: number }[]
    invendus: { date: string; valeur_perdue: number }[]
  },
  debut: string,
  fin: string,
) {
  const dans = (d: string) => d >= debut && d <= fin
  const ventes = data.ventes.filter((v) => dans(v.date))
  const totalVentes = ventes.reduce((s, v) => s + v.total, 0)
  const coutProduction = ventes.reduce((s, v) => s + v.cout_total, 0)
  const ventesComptant = ventes
    .filter((v) => v.mode_paiement === 'comptant')
    .reduce((s, v) => s + v.total, 0)
  const creditAccorde = ventes
    .filter((v) => v.mode_paiement === 'credit')
    .reduce((s, v) => s + v.total, 0)
  const encaisseVentes = ventes.reduce((s, v) => s + v.montant_paye, 0)
  const remboursementsRecus = data.remboursements
    .filter((r) => dans(r.date))
    .reduce((s, r) => s + r.montant, 0)
  const totalDepenses = data.depenses.filter((d) => dans(d.date)).reduce((s, d) => s + d.montant, 0)
  const valeurPertes = data.invendus
    .filter((i) => dans(i.date))
    .reduce((s, i) => s + i.valeur_perdue, 0)

  // >>> BÉNÉFICE = ventes − coût production − dépenses − pertes
  const benefice = totalVentes - coutProduction - totalDepenses - valeurPertes

  return {
    totalVentes,
    coutProduction,
    ventesComptant,
    creditAccorde,
    encaisse: encaisseVentes + remboursementsRecus,
    encaisseVentes,
    remboursementsRecus,
    depenses: totalDepenses,
    pertes: valeurPertes,
    benefice,
    marge: totalVentes > 0 ? (benefice / totalVentes) * 100 : 0,
    nbVentes: ventes.length,
  }
}
