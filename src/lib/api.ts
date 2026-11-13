// ============================================================================
// api.ts — Couche d'accès aux données
// ----------------------------------------------------------------------------
// Deux implémentations derrière la même interface :
//   • Supabase (si VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY sont définies)
//   • Mode démo local (localStorage) sinon — permet de présenter le prototype
//     sans backend. Les règles de rôle y sont appliquées côté client.
// ============================================================================
import { supabase, MODE_DEMO } from './supabase'
import { creerDonneesDemo, EMPLOYES_DEMO } from './demoData'
import type {
  AppData, Client, Commande, Depense, Invendu, LigneVente, Produit,
  Profil, Production, Remboursement, Role, Vente,
} from './types'
import { aujourdhui, uid } from './utils'

const CLE_STORAGE = 'gestipain.demo.v1'

// ---------------------------------------------------------------------------
// État démo persistant
// ---------------------------------------------------------------------------
interface DemoState extends AppData {
  profils: (Profil & { mot_de_passe: string })[]
}

function chargerDemo(): DemoState {
  try {
    const brut = localStorage.getItem(CLE_STORAGE)
    if (brut) {
      const parse = JSON.parse(brut) as DemoState
      if (parse.produits && parse.ventes) return parse
    }
  } catch {
    /* ignore */
  }
  const base = creerDonneesDemo()
  const state: DemoState = {
    ...base,
    profils: EMPLOYES_DEMO.map(({ mot_de_passe, ...p }) => ({ ...p, mot_de_passe })),
  }
  sauverDemo(state)
  return state
}

function sauverDemo(state: DemoState) {
  localStorage.setItem(CLE_STORAGE, JSON.stringify(state))
}

export const reinitialiserDemo = () => {
  localStorage.removeItem(CLE_STORAGE)
  window.location.reload()
}

// ---------------------------------------------------------------------------
// Helpers Supabase : mapping snake_case → objets applicatifs
// ---------------------------------------------------------------------------
async function chargerDepuisSupabase(_role: Role): Promise<AppData> {
  const sb = supabase!
  // Un employé ne récupère jamais les colonnes de coût (aucun accès aux bénéfices).
  // Côté base, ces colonnes sont en plus protégées par des privilèges (schema.sql §5 bis).
  // Champs communs aux deux rôles (les coûts arrivent par les vues propriétaire)
  const colonnesVente =
    'id,date,type_client,mode_paiement,client_id,total,montant_paye,note,user_id,created_at'
  const colonnesLigne = 'id,vente_id,produit_id,produit_nom,quantite,prix_unitaire'
  const colonnesProduit =
    'id,nom,prix_detail,prix_revendeur,actif,created_at'
  const [produits, clients, ventes, lignes, couts, coutsProduits, remb, commandes, lignesCmd, productions, invendus, depenses, profils] =
    await Promise.all([
      sb.from('produits').select(colonnesProduit).order('created_at'),
      sb.from('clients').select('*').order('nom'),
      sb.from('ventes').select(colonnesVente).order('created_at', { ascending: false }),
      sb.from('ventes_lignes').select(colonnesLigne),
      sb.from('v_couts_ventes').select('*'),
      sb.from('v_couts_produits').select('*'),
      sb.from('remboursements').select('*').order('date', { ascending: false }),
      sb.from('commandes').select('*').order('date_livraison'),
      sb.from('commandes_lignes').select('*'),
      sb.from('productions').select('*'),
      sb.from('invendus').select('*').order('date', { ascending: false }),
      sb.from('depenses').select('*').order('date', { ascending: false }),
      sb.from('profils').select('*'),
    ])

  // Les dépenses / productions sont invisibles (RLS) pour un employé : erreur ou tableau vide.
  const profilsListe = (profils.data ?? []) as Profil[]
  // Auteur affiché : « Nom (e-mail) » si le profil est lisible
  const emailDe = (id: string) => {
    const p = profilsListe.find((x) => x.id === id)
    return p ? (p.nom ? `${p.nom} (${p.email})` : p.email) : '—'
  }

  const coutParVente = new Map<string, number>()
  for (const c of (couts.data ?? []) as any[]) coutParVente.set(c.vente_id, c.cout_total)

  const lignesParVente = new Map<string, LigneVente[]>()
  for (const l of (lignes.data ?? []) as any[]) {
    const arr = lignesParVente.get(l.vente_id) ?? []
    arr.push(l as LigneVente)
    lignesParVente.set(l.vente_id, arr)
  }
  const lignesParCmd = new Map<string, any[]>()
  for (const l of (lignesCmd.data ?? []) as any[]) {
    const arr = lignesParCmd.get(l.commande_id) ?? []
    arr.push(l)
    lignesParCmd.set(l.commande_id, arr)
  }

  const clientsAvecSolde: Client[] = ((clients.data ?? []) as any[]).map((c: any) => {
    const du =
      ((ventes.data ?? []) as any[])
        .filter((v: any) => v.client_id === c.id && v.mode_paiement === 'credit')
        .reduce((s: number, v: any) => s + v.total, 0) -
      (remb.data ?? [])
        .filter((r: any) => r.client_id === c.id)
        .reduce((s: number, r: any) => s + r.montant, 0)
    return { ...c, solde_du: du }
  })

  const coutProduit = new Map<string, number>()
  for (const c of (coutsProduits.data ?? []) as any[]) {
    coutProduit.set(c.produit_id, c.cout_production)
  }

  return {
    produits: ((produits.data ?? []) as any[]).map((p) => ({
      ...p,
      cout_production: coutProduit.get(p.id) ?? 0,
    })) as Produit[],
    clients: clientsAvecSolde,
    ventes: ((ventes.data ?? []) as any[]).map((v: any) => ({
      ...v,
      cout_total: coutParVente.get(v.id) ?? 0,
      client_nom: clientsAvecSolde.find((c) => c.id === v.client_id)?.nom ?? null,
      user_email: emailDe(v.user_id),
      lignes: (lignesParVente.get(v.id) ?? []).map((l: any) => ({ cout_unitaire: 0, ...l })),
    })),
    remboursements: ((remb.data ?? []) as any[]).map((r: any) => ({
      ...r,
      client_nom: clientsAvecSolde.find((c) => c.id === r.client_id)?.nom ?? '—',
      user_email: emailDe(r.user_id),
    })),
    commandes: ((commandes.data ?? []) as any[]).map((c: any) => ({
      ...c,
      client_nom: clientsAvecSolde.find((x) => x.id === c.client_id)?.nom ?? '—',
      user_email: emailDe(c.user_id),
      total: (lignesParCmd.get(c.id) ?? []).reduce(
        (s: number, l: any) => s + l.quantite * l.prix_unitaire, 0),
        lignes: lignesParCmd.get(c.id) ?? [],
    })),
    productions: ((productions.data ?? []) as any[]).map((p: any) => ({ ...p, user_email: emailDe(p.user_id) })),
    invendus: ((invendus.data ?? []) as any[]).map((i: any) => ({ ...i, user_email: emailDe(i.user_id) })),
    depenses: ((depenses.data ?? []) as any[]).map((d: any) => ({ ...d, user_email: emailDe(d.user_id) })),
  }
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------
export interface NouvelleVente {
  date: string
  type_client: 'detail' | 'revendeur'
  mode_paiement: 'comptant' | 'credit'
  client_id: string | null
  note: string | null
  lignes: { produit_id: string; produit_nom: string; quantite: number; prix_unitaire: number; cout_unitaire: number }[]
}

export const api = {
  /** Charge toutes les données accessibles au rôle courant */
  async charger(role: Role = 'employe'): Promise<AppData> {
    if (MODE_DEMO) return chargerDemo()
    return chargerDepuisSupabase(role)
  },

  // --- Produits ------------------------------------------------------------
  async enregistrerProduit(p: Partial<Produit> & { nom: string }): Promise<Produit> {
    if (MODE_DEMO) {
      const st = chargerDemo()
      const existant = p.id ? st.produits.find((x) => x.id === p.id) : null
      if (existant) {
        Object.assign(existant, p)
        sauverDemo(st)
        return existant
      }
      const nouveau: Produit = {
        id: uid(), nom: p.nom, prix_detail: p.prix_detail ?? 0,
        prix_revendeur: p.prix_revendeur ?? 0, cout_production: p.cout_production ?? 0,
        actif: p.actif ?? true, created_at: new Date().toISOString(),
      }
      st.produits.push(nouveau)
      sauverDemo(st)
      return nouveau
    }
    const { data, error } = await supabase!.from('produits').upsert(p).select().single()
    if (error) throw error
    return data as Produit
  },

  async basculerProduit(id: string, actif: boolean) {
    if (MODE_DEMO) {
      const st = chargerDemo()
      const p = st.produits.find((x) => x.id === id)
      if (p) p.actif = actif
      sauverDemo(st)
      return
    }
    const { error } = await supabase!.from('produits').update({ actif }).eq('id', id)
    if (error) throw error
  },

  // --- Clients -------------------------------------------------------------
  async enregistrerClient(c: { nom: string; telephone: string | null; type: 'detail' | 'revendeur' }): Promise<Client> {
    if (MODE_DEMO) {
      const st = chargerDemo()
      const nouveau: Client = { id: uid(), solde_du: 0, created_at: new Date().toISOString(), ...c }
      st.clients.push(nouveau)
      sauverDemo(st)
      return nouveau
    }
    const { data, error } = await supabase!.from('clients').insert(c).select().single()
    if (error) throw error
    return { ...(data as Client), solde_du: 0 }
  },

  // --- Ventes --------------------------------------------------------------
  async creerVente(v: NouvelleVente, profil: Profil): Promise<Vente> {
    const total = v.lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)
    const coutTotal = v.lignes.reduce((s, l) => s + l.quantite * l.cout_unitaire, 0)

    if (MODE_DEMO) {
      const st = chargerDemo()
      const client = st.clients.find((c) => c.id === v.client_id) ?? null
      const vente: Vente = {
        id: uid(), date: v.date, type_client: v.type_client, mode_paiement: v.mode_paiement,
        client_id: v.client_id, client_nom: client?.nom ?? null,
        total, cout_total: coutTotal,
        montant_paye: v.mode_paiement === 'comptant' ? total : 0,
        note: v.note, user_id: profil.id, user_email: profil.email,
        created_at: new Date().toISOString(),
        lignes: v.lignes.map((l) => ({ ...l, id: uid(), vente_id: '' })),
      }
      vente.lignes.forEach((l) => (l.vente_id = vente.id))
      st.ventes.unshift(vente)
      // Un crédit augmente la dette du client
      if (v.mode_paiement === 'credit' && client) client.solde_du += total
      sauverDemo(st)
      return vente
    }

    const sb = supabase!
    const { data: entete, error } = await sb
      .from('ventes')
      .insert({
        date: v.date, type_client: v.type_client, mode_paiement: v.mode_paiement,
        client_id: v.client_id, total, cout_total: coutTotal,
        montant_paye: v.mode_paiement === 'comptant' ? total : 0,
        note: v.note, user_id: profil.id,
      })
      .select()
      .single()
    if (error) throw error
    const { error: errLignes } = await sb.from('ventes_lignes').insert(
      v.lignes.map((l) => ({ ...l, vente_id: entete.id })),
    )
    if (errLignes) throw errLignes
    const client = v.client_id ? (await sb.from('clients').select('nom').eq('id', v.client_id).single()).data : null
    return {
      ...(entete as Vente), client_nom: client?.nom ?? null, user_email: profil.email,
      lignes: v.lignes.map((l) => ({ ...l, id: uid(), vente_id: entete.id })),
    }
  },

  // --- Remboursements ------------------------------------------------------
  async creerRemboursement(r: { client_id: string; montant: number; date: string; note: string | null }, profil: Profil) {
    if (MODE_DEMO) {
      const st = chargerDemo()
      const client = st.clients.find((c) => c.id === r.client_id)
      if (!client) throw new Error('Client introuvable')
      if (r.montant > client.solde_du) throw new Error('Le remboursement dépasse le solde dû')
      client.solde_du -= r.montant
      st.remboursements.unshift({
        id: uid(), ...r, client_nom: client.nom, user_id: profil.id,
        user_email: profil.email, created_at: new Date().toISOString(),
      })
      sauverDemo(st)
      return
    }
    const { error } = await supabase!.from('remboursements').insert({ ...r, user_id: profil.id })
    if (error) throw error
  },

  // --- Commandes -----------------------------------------------------------
  async creerCommande(
    c: {
      client_id: string; date_livraison: string; adresse: string | null; note: string | null
      lignes: { produit_id: string; produit_nom: string; quantite: number; prix_unitaire: number }[]
    },
    profil: Profil,
  ): Promise<Commande> {
    const clientNom = await nomClient(c.client_id)
    if (MODE_DEMO) {
      const st = chargerDemo()
      const cmd: Commande = {
        id: uid(), client_id: c.client_id, client_nom: clientNom,
        date_livraison: c.date_livraison, adresse: c.adresse, statut: 'a_preparer',
        note: c.note, total: c.lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0),
        vente_id: null, user_id: profil.id, user_email: profil.email,
        created_at: new Date().toISOString(),
        lignes: c.lignes.map((l) => ({ ...l, id: uid(), commande_id: '' })),
      }
      cmd.lignes.forEach((l) => (l.commande_id = cmd.id))
      st.commandes.push(cmd)
      sauverDemo(st)
      return cmd
    }
    const sb = supabase!
    const { data, error } = await sb.from('commandes').insert({
      client_id: c.client_id, date_livraison: c.date_livraison, adresse: c.adresse,
      note: c.note, statut: 'a_preparer', user_id: profil.id,
    }).select().single()
    if (error) throw error
    const { error: e2 } = await sb.from('commandes_lignes').insert(
      c.lignes.map((l) => ({ ...l, commande_id: data.id })),
    )
    if (e2) throw e2
    return {
      ...(data as Commande), client_nom: clientNom,
      total: c.lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0),
      user_email: profil.email,
      lignes: c.lignes.map((l) => ({ ...l, id: uid(), commande_id: data.id })),
    }
  },

  async changerStatutCommande(id: string, statut: Commande['statut']) {
    if (MODE_DEMO) {
      const st = chargerDemo()
      const c = st.commandes.find((x) => x.id === id)
      if (c) c.statut = statut
      sauverDemo(st)
      return
    }
    const { error } = await supabase!.from('commandes').update({ statut }).eq('id', id)
    if (error) throw error
  },

  /** Livre une commande : crée la vente associée et marque la commande comme livrée */
  async livrerCommande(
    commandeId: string, mode: 'comptant' | 'credit', date: string, profil: Profil,
  ): Promise<void> {
    const data = await api.charger(profil.role)
    const cmd = data.commandes.find((c) => c.id === commandeId)
    if (!cmd) throw new Error('Commande introuvable')
    const produits = data.produits

    const vente = await api.creerVente({
      date, type_client: data.clients.find((c) => c.id === cmd.client_id)?.type ?? 'detail',
      mode_paiement: mode, client_id: cmd.client_id, note: `Commande livrée — ${cmd.client_nom}`,
      lignes: cmd.lignes.map((l) => ({
        produit_id: l.produit_id, produit_nom: l.produit_nom, quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
        cout_unitaire: produits.find((p) => p.id === l.produit_id)?.cout_production ?? 0,
      })),
    }, profil)

    if (MODE_DEMO) {
      const st = chargerDemo()
      const c = st.commandes.find((x) => x.id === commandeId)
      if (c) { c.statut = 'livree'; c.vente_id = vente.id }
      sauverDemo(st)
      return
    }
    const { error } = await supabase!.from('commandes')
      .update({ statut: 'livree', vente_id: vente.id }).eq('id', commandeId)
    if (error) throw error
  },

  // --- Production ----------------------------------------------------------
  async enregistrerProduction(p: { date: string; produit_id: string; produit_nom: string; quantite: number }, profil: Profil) {
    if (MODE_DEMO) {
      const st = chargerDemo()
      const existant = st.productions.find((x) => x.date === p.date && x.produit_id === p.produit_id)
      if (existant) {
        existant.quantite = p.quantite
        existant.user_id = profil.id
        existant.user_email = profil.email
      } else {
        st.productions.push({ id: uid(), ...p, user_id: profil.id, user_email: profil.email, created_at: new Date().toISOString() })
      }
      sauverDemo(st)
      return
    }
    const sb = supabase!
    const { data } = await sb.from('productions').select('id').eq('date', p.date).eq('produit_id', p.produit_id).maybeSingle()
    if (data) {
      const { error } = await sb.from('productions').update({ quantite: p.quantite, user_id: profil.id }).eq('id', data.id)
      if (error) throw error
    } else {
      const { error } = await sb.from('productions').insert({ ...p, user_id: profil.id })
      if (error) throw error
    }
  },

  // --- Invendus ------------------------------------------------------------
  async enregistrerInvendu(
    i: { date: string; produit_id: string; produit_nom: string; quantite: number; valeur_perdue: number; motif: Invendu['motif']; note: string | null },
    profil: Profil,
  ) {
    if (MODE_DEMO) {
      const st = chargerDemo()
      st.invendus.unshift({ id: uid(), ...i, user_id: profil.id, user_email: profil.email, created_at: new Date().toISOString() })
      sauverDemo(st)
      return
    }
    const { error } = await supabase!.from('invendus').insert({ ...i, user_id: profil.id })
    if (error) throw error
  },

  // --- Dépenses (propriétaire) --------------------------------------------
  async enregistrerDepense(
    d: { date: string; categorie: Depense['categorie']; montant: number; note: string | null },
    profil: Profil,
  ) {
    if (MODE_DEMO) {
      const st = chargerDemo()
      st.depenses.unshift({ id: uid(), ...d, user_id: profil.id, user_email: profil.email, created_at: new Date().toISOString() })
      sauverDemo(st)
      return
    }
    const { error } = await supabase!.from('depenses').insert({ ...d, user_id: profil.id })
    if (error) throw error
  },

  // --- Utilisateurs (propriétaire) ----------------------------------------
  async listerUtilisateurs(): Promise<Profil[]> {
    if (MODE_DEMO) return chargerDemo().profils.map(({ mot_de_passe, ...p }) => p)
    const { data, error } = await supabase!.from('profils').select('*').order('created_at')
    if (error) throw error
    return data as Profil[]
  },

  async changerRole(id: string, role: Role) {
    if (MODE_DEMO) {
      const st = chargerDemo()
      const p = st.profils.find((x) => x.id === id)
      if (p) p.role = role
      sauverDemo(st)
      return
    }
    const { error } = await supabase!.from('profils').update({ role }).eq('id', id)
    if (error) throw error
  },
}

async function nomClient(id: string): Promise<string> {
  if (MODE_DEMO) return chargerDemo().clients.find((c) => c.id === id)?.nom ?? '—'
  const { data } = await supabase!.from('clients').select('nom').eq('id', id).single()
  return data?.nom ?? '—'
}

// ---------------------------------------------------------------------------
// Authentification (mode démo)
// ---------------------------------------------------------------------------
export async function connexionDemo(email: string, motDePasse: string): Promise<Profil> {
  const st = chargerDemo()
  const u = st.profils.find((p) => p.email.toLowerCase() === email.trim().toLowerCase())
  if (!u || u.mot_de_passe !== motDePasse) {
    throw new Error('Identifiants incorrects. Vérifiez l’e-mail et le mot de passe.')
  }
  const { mot_de_passe, ...profil } = u
  sessionStorage.setItem('gestipain.demo.session', JSON.stringify(profil))
  return profil
}

export function sessionDemo(): Profil | null {
  try {
    const brut = sessionStorage.getItem('gestipain.demo.session')
    return brut ? (JSON.parse(brut) as Profil) : null
  } catch {
    return null
  }
}

export const deconnexionDemo = () => sessionStorage.removeItem('gestipain.demo.session')

export const dateDuJour = aujourdhui
