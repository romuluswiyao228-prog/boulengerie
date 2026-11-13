// ============================================================================
// Ventes.tsx — Saisie rapide d'une vente (optimisée comptoir)
// • Prix appliqué automatiquement selon le type de client (détail / revendeur)
// • Paiement comptant ou crédit (crédit → dette ajoutée au solde du client)
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { Banknote, Check, Croissant, HandCoins, Plus, ShoppingBag, ShoppingCart, Store } from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import type { Client, ModePaiement, TypeClient } from '../lib/types'
import { LIBELLE_PAIEMENT, LIBELLE_TYPE_CLIENT } from '../lib/types'
import { aujourdhui, FCFA, formatDateLongueFR } from '../lib/utils'
import {
  Alerte, Bouton, Carte, Champ, CompteurQuantite, Etiquette, Input, Modale, Select, TitrePage, Vide, cn,
} from '../components/ui'

interface LignePanier {
  produit_id: string
  produit_nom: string
  quantite: number
  prix_unitaire: number
  cout_unitaire: number
}

export default function Ventes() {
  const { data, profil, rafraichir } = useStore()
  const [typeClient, setTypeClient] = useState<TypeClient>('detail')
  const [mode, setMode] = useState<ModePaiement>('comptant')
  const [panier, setPanier] = useState<LignePanier[]>([])
  const [clientId, setClientId] = useState<string>('')
  const [date, setDate] = useState(aujourdhui())
  const [note, setNote] = useState('')
  const [nouveauClient, setNouveauClient] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const produitsActifs = useMemo(() => data.produits.filter((p) => p.actif), [data.produits])
  const clients = useMemo(
    () => data.clients.filter((c) => c.type === typeClient).sort((a, b) => a.nom.localeCompare(b.nom)),
    [data.clients, typeClient],
  )

  const prixDe = (prixDetail: number, prixRevendeur: number) =>
    typeClient === 'revendeur' ? prixRevendeur : prixDetail

  const total = panier.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)

  const ajouter = (produitId: string) => {
    const p = data.produits.find((x) => x.id === produitId)
    if (!p) return
    setSucces(null)
    setPanier((prev) => {
      const existe = prev.find((l) => l.produit_id === produitId)
      if (existe) {
        return prev.map((l) =>
          l.produit_id === produitId ? { ...l, quantite: l.quantite + 1 } : l,
        )
      }
      return [...prev, {
        produit_id: p.id, produit_nom: p.nom, quantite: 1,
        prix_unitaire: prixDe(p.prix_detail, p.prix_revendeur), cout_unitaire: p.cout_production,
      }]
    })
  }

  const modifierQuantite = (produitId: string, q: number) =>
    setPanier((prev) => prev.map((l) => (l.produit_id === produitId ? { ...l, quantite: q } : l)))

  const retirer = (produitId: string) =>
    setPanier((prev) => prev.filter((l) => l.produit_id !== produitId))

  // Changer de type de client recalcule tous les prix du panier
  const changerType = (t: TypeClient) => {
    setTypeClient(t)
    setClientId('')
    setPanier((prev) =>
      prev.map((l) => {
        const p = data.produits.find((x) => x.id === l.produit_id)
        return p ? { ...l, prix_unitaire: prixDe(p.prix_detail, p.prix_revendeur) } : l
      }),
    )
  }

  const valider = async () => {
    setErreur(null); setSucces(null)
    if (!panier.length) return setErreur('Ajoutez au moins un produit au ticket.')
    if (mode === 'credit' && !clientId) return setErreur('Sélectionnez un client pour une vente à crédit.')
    if (!profil) return
    setEnCours(true)
    try {
      await api.creerVente({
        date, type_client: typeClient, mode_paiement: mode,
        client_id: clientId || null, note: note || null,
        lignes: panier.map(({ produit_id, produit_nom, quantite, prix_unitaire, cout_unitaire }) => ({
          produit_id, produit_nom, quantite, prix_unitaire, cout_unitaire,
        })),
      }, profil)
      await rafraichir()
      setSucces(
        `Vente de ${FCFA(total)} enregistrée (${LIBELLE_PAIEMENT[mode].toLowerCase()})` +
        (mode === 'credit' ? ` — dette ajoutée au client.` : '.'),
      )
      setPanier([]); setNote(''); setClientId('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e: any) {
      setErreur(e?.message ?? "Erreur lors de l'enregistrement")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl pb-20 lg:pb-0">
      <TitrePage
        titre="Nouvelle vente"
        sousTitre={formatDateLongueFR(date)}
      />

      {succes && <div className="mb-4"><Alerte ton="succes">{succes}</Alerte></div>}
      {erreur && <div className="mb-4"><Alerte>{erreur}</Alerte></div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
        {/* ---------------- Colonne saisie ---------------- */}
        <div className="order-1 space-y-4 lg:order-1">
          {/* Type de client */}
          <Carte className="p-4">
            <p className="mb-2.5 text-[13px] font-bold text-stone-600">Type de client</p>
            <div className="grid grid-cols-2 gap-2.5">
              {(['detail', 'revendeur'] as TypeClient[]).map((t) => (
                <button
                  key={t}
                  onClick={() => changerType(t)}
                  className={cn(
                    'rounded-xl border-2 px-4 py-3.5 text-[15px] font-bold transition-all active:scale-[0.98]',
                    typeClient === t
                      ? 'border-amber-600 bg-amber-50 text-amber-900'
                      : 'border-stone-200 bg-white text-stone-600',
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    {t === 'detail' ? <ShoppingBag size={18} /> : <Store size={18} />}
                    {LIBELLE_TYPE_CLIENT[t]}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-medium opacity-70">
                    {t === 'detail' ? 'prix détail' : 'prix revendeur'}
                  </span>
                </button>
              ))}
            </div>
          </Carte>

          {/* Produits — gros boutons tactiles */}
          <Carte className="p-4">
            <p className="mb-2.5 text-[13px] font-bold text-stone-600">Produits — appuyez pour ajouter</p>
            {produitsActifs.length === 0 ? (
              <Vide texte="Aucun produit actif. Le propriétaire doit en créer." icone={<Croissant size={24} />} />
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {produitsActifs.map((p) => {
                  const prix = prixDe(p.prix_detail, p.prix_revendeur)
                  const dansPanier = panier.find((l) => l.produit_id === p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => ajouter(p.id)}
                      className={cn(
                        'relative flex flex-col items-start gap-0.5 rounded-xl border-2 p-3 text-left transition-all active:scale-[0.97]',
                        dansPanier
                          ? 'border-amber-600 bg-amber-50'
                          : 'border-stone-200 bg-white hover:border-amber-300',
                      )}
                    >
                      {dansPanier && (
                        <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-amber-600 px-1.5 text-[11px] font-black text-white">
                          {dansPanier.quantite}
                        </span>
                      )}
                      <span className="text-[13px] font-bold leading-tight text-stone-900">{p.nom}</span>
                      <span className="text-[13px] font-extrabold text-amber-800">{FCFA(prix)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </Carte>

          {/* Options avancées */}
          <Carte className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ label="Date de la vente">
                <Input type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} />
              </Champ>
              <Champ label="Note (facultatif)">
                <Input placeholder="Ex. livraison marché" value={note} onChange={(e) => setNote(e.target.value)} />
              </Champ>
            </div>
          </Carte>
        </div>

        {/* ---------------- Ticket ---------------- */}
        <div className="order-2 lg:order-2 lg:sticky lg:top-6">
          <Carte className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <h2 className="text-[15px] font-black text-stone-900">Ticket</h2>
              {panier.length > 0 && (
                <button onClick={() => setPanier([])} className="text-[12px] font-bold text-red-600 hover:underline">
                  Vider
                </button>
              )}
            </div>

            {panier.length === 0 ? (
              <Vide texte="Appuyez sur un produit pour commencer le ticket." icone={<ShoppingCart size={24} />} />
            ) : (
              <ul className="divide-y divide-stone-100">
                {panier.map((l) => (
                  <li key={l.produit_id} className="px-4 py-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-bold text-stone-900">{l.produit_nom}</p>
                        <p className="text-[11px] text-stone-500">{FCFA(l.prix_unitaire)} / unité</p>
                      </div>
                      <button
                        onClick={() => retirer(l.produit_id)}
                        className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-stone-400 hover:bg-red-50 hover:text-red-600"
                      >Retirer</button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <CompteurQuantite
                        valeur={l.quantite}
                        onChange={(q) => modifierQuantite(l.produit_id, q)}
                        pas={typeClient === 'revendeur' ? 5 : 1}
                      />
                      <span className="text-[15px] font-black text-stone-900">
                        {FCFA(l.quantite * l.prix_unitaire)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Client — bloc mobile (le sélecteur desktop est plus bas) */}
            <div className="border-t border-stone-100 px-4 py-3 lg:hidden">
              <Champ
                label={
                  mode === 'credit'
                    ? 'Client (obligatoire pour un crédit)'
                    : 'Client (facultatif)'
                }
              >
                <div className="flex gap-2">
                  <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                    <option value="">— {mode === 'credit' ? 'Choisir un client' : 'Client de passage'} —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}{c.solde_du > 0 ? ` (doit ${FCFA(c.solde_du)})` : ''}
                      </option>
                    ))}
                  </Select>
                  <Bouton variante="secondaire" className="shrink-0 px-3" onClick={() => setNouveauClient(true)} aria-label="Nouveau client">
                    <Plus size={18} />
                  </Bouton>
                </div>
              </Champ>
              {mode === 'credit' && clientId && (
                <p className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-[12px] font-semibold text-orange-800">
                  Nouvelle dette après vente :{' '}
                  {FCFA((data.clients.find((c) => c.id === clientId)?.solde_du ?? 0) + total)}
                </p>
              )}
            </div>

            <div className="hidden border-t border-stone-100 bg-stone-50 px-4 py-3 lg:block">
              {/* Paiement (desktop) — sur mobile, la barre fixe en bas reprend ces contrôles */}
              <p className="mb-2 text-[13px] font-bold text-stone-600">Paiement</p>
              <div className="grid grid-cols-2 gap-2">
                {(['comptant', 'credit'] as ModePaiement[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); if (m === 'comptant') setClientId('') }}
                    className={cn(
                      'rounded-xl border-2 px-3 py-2.5 text-[14px] font-bold transition-all',
                      mode === m
                        ? m === 'comptant'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-orange-600 bg-orange-50 text-orange-800'
                        : 'border-stone-200 bg-white text-stone-600',
                    )}
                  >
                    {m === 'comptant' ? <Banknote size={18} /> : <HandCoins size={18} />} {LIBELLE_PAIEMENT[m]}
                  </button>
                ))}
              </div>

              {/* Client */}
              <div className="mt-3">
                <Champ
                  label={mode === 'credit' ? 'Client (obligatoire pour crédit)' : 'Client (facultatif)'}
                >
                  <div className="flex gap-2">
                    <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                      <option value="">— {mode === 'credit' ? 'Choisir un client' : 'Client de passage'} —</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom}{c.solde_du > 0 ? ` (doit ${FCFA(c.solde_du)})` : ''}
                        </option>
                      ))}
                    </Select>
                    <Bouton variante="secondaire" className="shrink-0 px-3" onClick={() => setNouveauClient(true)} aria-label="Nouveau client">
                      <Plus size={18} />
                    </Bouton>
                  </div>
                </Champ>
                {mode === 'credit' && clientId && (
                  <p className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-[12px] font-semibold text-orange-800">
                    Nouvelle dette après vente :{' '}
                    {FCFA((data.clients.find((c) => c.id === clientId)?.solde_du ?? 0) + total)}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-end justify-between border-t border-stone-200 pt-3">
                <span className="text-[13px] font-bold text-stone-500">TOTAL</span>
                <span className="text-2xl font-black tracking-tight text-stone-900">{FCFA(total)}</span>
              </div>

              <Bouton
                taille="lg"
                className="mt-3 w-full"
                onClick={valider}
                disabled={enCours || !panier.length}
              >
                {enCours ? 'Enregistrement…' : mode === 'comptant' ? <><Check size={18} /> Encaisser la vente</> : <><Check size={18} /> Enregistrer à crédit</>}
              </Bouton>
            </div>
          </Carte>
          <p className="mt-2 px-1 text-center text-[11px] text-stone-400">
            Saisie enregistrée au nom de {profil?.nom} · {profil?.role === 'proprietaire' ? 'Propriétaire' : 'Employé'}
          </p>
        </div>
      </div>

      {/* Barre d'action fixe (mobile) : total, mode de paiement et validation */}
      <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 border-t border-stone-200 bg-white/95 px-3 py-2.5 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <div className="flex shrink-0 rounded-xl bg-stone-100 p-1">
            {(['comptant', 'credit'] as ModePaiement[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); if (m === 'comptant') setClientId('') }}
                className={cn(
                  'rounded-lg px-2.5 py-2 text-[12px] font-bold transition-colors',
                  mode === m ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500',
                )}
                title={LIBELLE_PAIEMENT[m]}
              >
                {m === 'comptant' ? <Banknote size={18} /> : <HandCoins size={18} />}
              </button>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-bold uppercase tracking-wide text-stone-400">
              {panier.length} article{panier.length > 1 ? 's' : ''}
            </p>
            <p className="truncate text-[16px] font-black leading-tight text-stone-900">{FCFA(total)}</p>
          </div>
          <Bouton
            onClick={valider}
            disabled={enCours || !panier.length}
            className="shrink-0"
          >
            {mode === 'comptant' ? 'Encaisser' : 'Crédit'}
          </Bouton>
        </div>
      </div>

      <NouveauClientModale
        ouvert={nouveauClient}
        type={typeClient}
        onFermer={() => setNouveauClient(false)}
        onCree={async (c) => {
          // Le client peut avoir un autre type que celui sélectionné :
          // on aligne l'onglet puis on le sélectionne (l'<option> existe au même rendu).
          setTypeClient(c.type)
          setClientId(c.id)
          setMode('credit')
          setNouveauClient(false)
          await rafraichir()
          setSucces(`Client « ${c.nom} » créé.`)
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
export function NouveauClientModale({
  ouvert, type, onFermer, onCree,
}: {
  ouvert: boolean
  type: TypeClient
  onFermer: () => void
  onCree: (c: Client) => void | Promise<void>
}) {
  const [nom, setNom] = useState('')
  const [tel, setTel] = useState('')
  const [typeC, setTypeC] = useState<TypeClient>(type)
  const [erreur, setErreur] = useState<string | null>(null)

  // Le type par défaut suit l'onglet sélectionné à chaque ouverture
  useEffect(() => {
    if (ouvert) { setTypeC(type); setErreur(null) }
  }, [ouvert, type])
  const [enCours, setEnCours] = useState(false)

  const creer = async () => {
    if (!nom.trim()) return setErreur('Le nom est obligatoire.')
    setEnCours(true)
    try {
      const c = await api.enregistrerClient({ nom: nom.trim(), telephone: tel.trim() || null, type: typeC })
      setNom(''); setTel(''); setErreur('')
      await onCree(c)
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modale
      ouvert={ouvert}
      onFermer={onFermer}
      titre="Nouveau client"
      pied={
        <Bouton className="w-full" taille="lg" onClick={creer} disabled={enCours}>
          {enCours ? 'Création…' : 'Créer le client'}
        </Bouton>
      }
    >
      <div className="space-y-3">
        {erreur && <Alerte>{erreur}</Alerte>}
        <Champ label="Nom complet">
          <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Boutique Adjo" autoFocus />
        </Champ>
        <Champ label="Téléphone">
          <Input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+228 …" inputMode="tel" />
        </Champ>
        <Champ label="Type">
          <Select value={typeC} onChange={(e) => setTypeC(e.target.value as TypeClient)}>
            <option value="detail">Détail</option>
            <option value="revendeur">Revendeur</option>
          </Select>
        </Champ>
        <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5">
          <Etiquette ton="ambre">Info</Etiquette>
          <p className="text-[12px] text-stone-600">Le solde dû démarre à 0 FCFA.</p>
        </div>
      </div>
    </Modale>
  )
}
