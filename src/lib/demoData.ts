// ============================================================================
// demoData.ts — Jeu de données de démonstration (généré de façon déterministe)
// Utilisé quand aucune clé Supabase n'est configurée (mode démo local).
// ============================================================================
import type {
  AppData, Client, Commande, Depense, Invendu, Produit, Production,
  Remboursement, Vente, LigneVente,
} from './types'
import { addDays, toISODate } from './utils'

// PRNG déterministe (mulberry32) → mêmes données à chaque chargement
function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PRODUITS_BASE: Omit<Produit, 'id' | 'created_at'>[] = [
  { nom: 'Pain de mie', prix_detail: 500, prix_revendeur: 400, cout_production: 260, actif: true },
  { nom: 'Baguette', prix_detail: 200, prix_revendeur: 150, cout_production: 95, actif: true },
  { nom: 'Pain traditionnel', prix_detail: 300, prix_revendeur: 230, cout_production: 140, actif: true },
  { nom: 'Croissant', prix_detail: 150, prix_revendeur: 100, cout_production: 70, actif: true },
  { nom: 'Pain au chocolat', prix_detail: 200, prix_revendeur: 150, cout_production: 100, actif: true },
  { nom: 'Brioche', prix_detail: 400, prix_revendeur: 320, cout_production: 190, actif: true },
  { nom: 'Gâteau au yaourt', prix_detail: 1000, prix_revendeur: 800, cout_production: 520, actif: false },
]

const CLIENTS_BASE: Omit<Client, 'id' | 'created_at' | 'solde_du'>[] = [
  { nom: 'Kossi AGBEKO', telephone: '+228 90 12 34 56', type: 'revendeur' },
  { nom: 'Boutique Adjo', telephone: '+228 91 22 33 44', type: 'revendeur' },
  { nom: 'Afi MENSAH', telephone: '+228 92 55 66 77', type: 'detail' },
  { nom: 'Kiosque Nadège', telephone: '+228 93 44 55 66', type: 'revendeur' },
  { nom: 'Yao KOUASSI', telephone: '+228 96 77 88 99', type: 'detail' },
  { nom: 'Restaurant Le Baobab', telephone: '+228 97 11 22 33', type: 'revendeur' },
  { nom: 'Mawuli DOSSEH', telephone: '+228 98 33 44 55', type: 'detail' },
]

export const EMPLOYES_DEMO = [
  { id: 'u-proprietaire', email: 'proprietaire@boulangerie.tg', nom: 'Kokou ADJOVI', role: 'proprietaire' as const, mot_de_passe: 'demo1234' },
  { id: 'u-employe', email: 'employe@boulangerie.tg', nom: 'Kafui AMOUZOU', role: 'employe' as const, mot_de_passe: 'demo1234' },
]

export function creerDonneesDemo(): AppData {
  const rnd = mulberry32(20261113)
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
  const entre = (a: number, b: number) => Math.floor(rnd() * (b - a + 1)) + a

  const now = new Date()
  const produits: Produit[] = PRODUITS_BASE.map((p, i) => ({
    ...p,
    id: `p${i + 1}`,
    created_at: addDays(toISODate(now), -180) + 'T08:00:00.000Z',
  }))
  const clients: Client[] = CLIENTS_BASE.map((c, i) => ({
    ...c,
    id: `c${i + 1}`,
    solde_du: 0,
    created_at: addDays(toISODate(now), -180) + 'T08:00:00.000Z',
  }))

  // Produits plus vendus que d'autres (réalisme d'une boulangerie de quartier)
  const POIDS: Record<string, number> = {
    Baguette: 30, 'Pain de mie': 22, 'Pain traditionnel': 20,
    Croissant: 12, 'Pain au chocolat': 10, Brioche: 6,
  }
  let pickProduit = (filtre: (p: Produit) => boolean = () => true) => {
    const liste = produits.filter((p) => filtre(p) && p.actif)
    const total = liste.reduce((s, p) => s + (POIDS[p.nom] ?? 5), 0)
    let t = rnd() * total
    for (const p of liste) {
      t -= POIDS[p.nom] ?? 5
      if (t <= 0) return p
    }
    return liste[0]
  }


  const ventes: Vente[] = []
  const productions: Production[] = []
  const invendus: Invendu[] = []
  const remboursements: Remboursement[] = []
  const depenses: Depense[] = []
  const commandes: Commande[] = []

  const employes = EMPLOYES_DEMO
  const auteurs = () => {
    // L'employé saisit la majorité des opérations, le propriétaire aussi
    const e = rnd() < 0.7 ? employes[1] : employes[0]
    return { user_id: e.id, user_email: e.email }
  }

  // 60 derniers jours de ventes (hors dimanche pour les 3 dernières semaines)
  for (let i = 62; i >= 0; i--) {
    const date = addDays(toISODate(now), -i)
    const jour = new Date(date + 'T00:00:00').getDay()
    if (jour === 0 && i > 21) continue

    // Production du matin
    for (const p of produits.filter((x) => x.actif)) {
      const base = p.nom === 'Baguette' ? 260 : p.nom.startsWith('Pain') ? 90 : 60
      const quantite = entre(Math.round(base * 0.7), Math.round(base * 1.25))
      productions.push({
        id: `pr-${date}-${p.id}`,
        date,
        produit_id: p.id,
        produit_nom: p.nom,
        quantite,
        ...auteurs(),
        created_at: date + 'T06:10:00.000Z',
      })
    }

    // Ventes de la journée : 6 à 14 tickets
    const nbTickets = entre(6, 14)
    let heure = 6
    for (let k = 0; k < nbTickets; k++) {
      heure = Math.min(19, heure + entre(0, 2))
      const typeClient = rnd() < 0.45 ? 'revendeur' : 'detail'
      const modePaiement = rnd() < (typeClient === 'revendeur' ? 0.45 : 0.12) ? 'credit' : 'comptant'
      const client = typeClient === 'revendeur'
        ? pick(clients.filter((c) => c.type === 'revendeur'))
        : rnd() < 0.3 ? pick(clients.filter((c) => c.type === 'detail')) : null

      const lignes: LigneVente[] = []
      const nbLignes = entre(1, 3)
      const utilises = new Set<string>()
      for (let l = 0; l < nbLignes; l++) {
        const p = pickProduit((x) => !utilises.has(x.id))
        if (!p) continue
        utilises.add(p.id)
        const qte = typeClient === 'revendeur' ? entre(10, 60) : entre(1, 5)
        lignes.push({
          id: `l-${date}-${k}-${l}`,
          vente_id: `v-${date}-${k}`,
          produit_id: p.id,
          produit_nom: p.nom,
          quantite: qte,
          prix_unitaire: typeClient === 'revendeur' ? p.prix_revendeur : p.prix_detail,
          cout_unitaire: p.cout_production,
        })
      }
      if (!lignes.length) continue
      const total = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)
      const coutTotal = lignes.reduce((s, l) => s + l.quantite * l.cout_unitaire, 0)
      const v: Vente = {
        id: `v-${date}-${k}`,
        date,
        type_client: typeClient,
        mode_paiement: modePaiement,
        client_id: modePaiement === 'credit' ? client?.id ?? clients[0].id : client?.id ?? null,
        client_nom: modePaiement === 'credit' ? client?.nom ?? clients[0].nom : client?.nom ?? null,
        total,
        cout_total: coutTotal,
        montant_paye: modePaiement === 'comptant' ? total : 0,
        note: null,
        ...auteurs(),
        created_at: `${date}T${String(heure).padStart(2, '0')}:${String(entre(0, 59)).padStart(2, '0')}:00.000Z`,
        lignes,
      }
      ventes.push(v)
      if (modePaiement === 'credit' && v.client_id) {
        const c = clients.find((x) => x.id === v.client_id)!
        c.solde_du += total
      }
    }

    // Invendus / pertes du soir (à partir d'il y a 3 jours max)
    if (i <= 40) {
      const p = pickProduit()
      const q = entre(2, 18)
      const motif = pick(['perte', 'reduction', 'don'] as const)
      invendus.push({
        id: `i-${date}`,
        date,
        produit_id: p.id,
        produit_nom: p.nom,
        quantite: q,
        valeur_perdue: q * p.prix_detail,
        motif,
        note: null,
        ...auteurs(),
        created_at: date + 'T20:30:00.000Z',
      })
    }

    // Dépenses (pas tous les jours)
    if (rnd() < 0.5) {
      const cat = pick(['farine', 'energie', 'transport', 'autres'] as const)
      depenses.push({
        id: `d-${date}`,
        date,
        categorie: cat,
        montant: cat === 'farine' ? entre(18000, 45000) : cat === 'energie' ? entre(5000, 15000) : entre(2000, 9000),
        note: cat === 'farine' ? 'Sac de 50 kg' : null,
        ...auteurs(),
        created_at: date + 'T09:00:00.000Z',
      })
    }
    if (jour === 6) {
      depenses.push({
        id: `d-mo-${date}`,
        date,
        categorie: 'main_oeuvre',
        montant: entre(25000, 35000),
        note: 'Salaire hebdomadaire aide-boulanger',
        ...auteurs(),
        created_at: date + 'T18:00:00.000Z',
      })
    }

    // Remboursements de crédits
    if (i <= 30 && rnd() < 0.55) {
      const c = pick(clients.filter((x) => x.solde_du > 0))
      if (c) {
        const montant = Math.min(c.solde_du, Math.round((entre(1, 6) * 1000) / 500) * 500)
        if (montant > 0) {
          c.solde_du -= montant
          remboursements.push({
            id: `r-${date}-${c.id}`,
            client_id: c.id,
            client_nom: c.nom,
            montant,
            date,
            note: rnd() < 0.3 ? 'Remboursement partiel' : null,
            ...auteurs(),
            created_at: date + 'T17:00:00.000Z',
          })
        }
      }
    }
  }

  // Commandes : passées, du jour et de demain
  const statuts = ['livree', 'a_preparer', 'prete', 'annulee'] as const
  for (let k = 0; k < 6; k++) {
    const offset = k < 2 ? -3 + k : k - 1
    const dl = addDays(toISODate(now), offset)
    const client = pick(clients)
    const lignes = [pick(produits.filter((p) => p.actif)), pick(produits.filter((p) => p.actif))]
      .filter((p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx)
      .map((p, idx) => ({
        id: `cl-${k}-${idx}`,
        commande_id: `cmd-${k}`,
        produit_id: p.id,
        produit_nom: p.nom,
        quantite: entre(5, 40),
        prix_unitaire: client.type === 'revendeur' ? p.prix_revendeur : p.prix_detail,
      }))
    commandes.push({
      id: `cmd-${k}`,
      client_id: client.id,
      client_nom: client.nom,
      date_livraison: dl,
      adresse: client.type === 'revendeur' ? 'Marché Assigamé, allée 4' : null,
      statut: offset < 0 ? statuts[0] : offset === 0 ? statuts[k % 2 === 0 ? 1 : 2] : statuts[1],
      note: k === 0 ? 'Livrer avant 7h' : null,
      total: lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0),
      vente_id: offset < 0 ? null : null,
      ...auteurs(),
      created_at: addDays(dl, -1) + 'T15:00:00.000Z',
      lignes,
    })
  }

  // Une commande de demain supplémentaire, garantie
  {
    const dl = addDays(toISODate(now), 1)
    const client = clients[5]
    const p1 = produits[1]
    const p2 = produits[2]
    commandes.push({
      id: 'cmd-demain',
      client_id: client.id,
      client_nom: client.nom,
      date_livraison: dl,
      adresse: 'Rue des Palmiers, quartier Bè',
      statut: 'a_preparer',
      note: 'Pain bien cuit',
      total: 80 * p1.prix_revendeur + 40 * p2.prix_revendeur,
      vente_id: null,
      ...auteurs(),
      created_at: toISODate(now) + 'T16:20:00.000Z',
      lignes: [
        { id: 'cl-dem-1', commande_id: 'cmd-demain', produit_id: p1.id, produit_nom: p1.nom, quantite: 80, prix_unitaire: p1.prix_revendeur },
        { id: 'cl-dem-2', commande_id: 'cmd-demain', produit_id: p2.id, produit_nom: p2.nom, quantite: 40, prix_unitaire: p2.prix_revendeur },
      ],
    })
  }

  return { produits, clients, ventes, remboursements, commandes, productions, invendus, depenses }
}

export const VERSION_DEMO = 'gestipain-demo-v1'
