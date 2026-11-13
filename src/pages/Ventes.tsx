// ============================================================================
// Ventes.tsx — Caisse visuelle reliée au catalogue produits
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import {
  Banknote, Check, CreditCard, Croissant, HandCoins, Plus, Search, ShoppingBag,
  ShoppingCart, Smartphone, Store, UserRound, Wallet,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import type { Client, MoyenPaiement, ModePaiement, Produit, TypeClient } from '../lib/types'
import { LIBELLE_MOYEN_PAIEMENT, LIBELLE_PAIEMENT, LIBELLE_TYPE_CLIENT } from '../lib/types'
import { aujourdhui, FCFA } from '../lib/utils'
import {
  Alerte, Bouton, Carte, Champ, CompteurQuantite, Etiquette, Input, Modale, Select,
  TitrePage, Vide, ZoneTexte, cn,
} from '../components/ui'

interface LignePanier {
  produit_id: string
  produit_nom: string
  produit?: Produit
  quantite: number
  prix_unitaire: number
  cout_unitaire: number
}

const MOYENS: { id: MoyenPaiement; icone: typeof Banknote }[] = [
  { id: 'especes', icone: Banknote },
  { id: 'tmoney', icone: Smartphone },
  { id: 'flooz', icone: Smartphone },
  { id: 'carte', icone: CreditCard },
  { id: 'mixte', icone: Wallet },
]

export default function Ventes() {
  const { data, profil, rafraichir, patchData } = useStore()
  const [typeClient, setTypeClient] = useState<TypeClient>('detail')
  const [mode, setMode] = useState<ModePaiement>('comptant')
  const [moyen, setMoyen] = useState<MoyenPaiement>('especes')
  const [panier, setPanier] = useState<LignePanier[]>([])
  const [clientId, setClientId] = useState('')
  const [clientNom, setClientNom] = useState('')
  const [date, setDate] = useState(aujourdhui())
  const [note, setNote] = useState('')
  const [recherche, setRecherche] = useState('')
  const [nouveauClient, setNouveauClient] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [recu, setRecu] = useState('')
  const [verse, setVerse] = useState('')
  const [recuEspeces, setRecuEspeces] = useState('')
  const [recuMobile, setRecuMobile] = useState('')

  const produits = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return data.produits
      .filter((p) => p.actif)
      .filter((p) => !q || p.nom.toLowerCase().includes(q) || (p.categorie ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.nom.localeCompare(b.nom))
  }, [data.produits, recherche])

  const clients = useMemo(
    () => [...data.clients].sort((a, b) => a.nom.localeCompare(b.nom)),
    [data.clients],
  )

  const clientParNom = (nom: string) => {
    const n = nom.trim().toLowerCase()
    return n ? data.clients.find((c) => c.nom.trim().toLowerCase() === n) : undefined
  }

  const saisirClient = (v: string) => {
    setClientNom(v)
    setClientId(v.trim() ? (clientParNom(v)?.id ?? '') : '')
  }

  const prixDe = (p: Produit) => (typeClient === 'revendeur' ? p.prix_revendeur : p.prix_detail)
  const total = panier.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)
  const nbArticles = panier.reduce((s, l) => s + l.quantite, 0)

  const montantRecu = useMemo(() => {
    if (mode === 'credit') return null
    if (mode === 'partiel') return Number(verse) || 0
    if (moyen === 'mixte') return (Number(recuEspeces) || 0) + (Number(recuMobile) || 0)
    return Number(recu) || total
  }, [mode, moyen, recu, recuEspeces, recuMobile, verse, total])
  const monnaie = montantRecu == null ? 0 : Math.max(0, montantRecu - total)

  const stockDe = (l: LignePanier) => l.produit?.stock
  const quantitePanier = (id: string) => panier.find((l) => l.produit_id === id)?.quantite ?? 0

  const ajouter = (p: Produit) => {
    setErreur(null); setSucces(null)
    const stock = p.stock
    if (stock != null && quantitePanier(p.id) + 1 > stock) {
      return setErreur(`Stock insuffisant pour ${p.nom} (${stock} ${p.unite ?? 'unité'}).`)
    }
    setPanier((prev) => {
      const existe = prev.find((l) => l.produit_id === p.id)
      if (existe) return prev.map((l) => l.produit_id === p.id ? { ...l, quantite: l.quantite + 1 } : l)
      return [...prev, { produit_id: p.id, produit_nom: p.nom, produit: p, quantite: 1, prix_unitaire: prixDe(p), cout_unitaire: p.cout_production }]
    })
  }

  const modifierQuantite = (id: string, q: number) => {
    const l = panier.find((x) => x.produit_id === id)
    const stock = l?.produit?.stock
    if (stock != null && q > stock) return setErreur(`Stock maximum : ${stock}.`)
    setPanier((prev) => prev.map((x) => x.produit_id === id ? { ...x, quantite: Math.max(1, q) } : x))
  }
  const retirer = (id: string) => setPanier((prev) => prev.filter((x) => x.produit_id !== id))

  const changerType = (t: TypeClient) => {
    setTypeClient(t); setClientId('')
    setPanier((prev) => prev.map((l) => {
      const p = data.produits.find((x) => x.id === l.produit_id)
      return p ? { ...l, prix_unitaire: prixDe(p) } : l
    }))
  }

  const valider = async () => {
    setErreur(null); setSucces(null)
    if (!panier.length) return setErreur('Ajoutez au moins un produit au ticket.')
    const nomClient = clientNom.trim()
    let clientFinal = clientId || (nomClient ? clientParNom(nomClient)?.id ?? '' : '')
    const clientObligatoire = mode === 'credit' || mode === 'partiel'
    if (clientObligatoire && !clientFinal && !nomClient) {
      return setErreur('Indiquez le nom du client pour cette vente.')
    }
    if (mode === 'partiel') {
      const v = Number(verse)
      if (!v || v <= 0 || v >= total) {
        return setErreur('Le montant versé doit être supérieur à 0 et inférieur au total.')
      }
    }
    if (mode === 'comptant') {
      if (moyen === 'mixte') {
        if ((Number(recuEspeces) || 0) + (Number(recuMobile) || 0) < total) return setErreur('Le montant reçu est insuffisant.')
      } else if ((Number(recu) || total) < total) return setErreur('Le montant reçu est insuffisant.')
    }
    if (!profil) return
    setEnCours(true)
    try {
      // Client tapé à la caisse : on le retrouve ou on le crée automatiquement
      if (!clientFinal && nomClient) {
        const trouve = clientParNom(nomClient)
        if (trouve) {
          clientFinal = trouve.id
        } else {
          const c = await api.enregistrerClient({ nom: nomClient, telephone: null, type: typeClient })
          clientFinal = c.id
          setClientId(c.id); setClientNom(c.nom)
          patchData((d) => ({ ...d, clients: [...d.clients, c] }))
        }
      }
      if (clientObligatoire && !clientFinal) {
        setErreur('Indiquez le nom du client pour cette vente.')
        return
      }
      const vente = await api.creerVente({
        date, type_client: typeClient, mode_paiement: mode,
        moyen_paiement: mode === 'credit' ? null : moyen,
        montant_recu: montantRecu, monnaie_rendue: monnaie,
        montant_paye: mode === 'partiel' ? Number(verse) || 0 : null,
        client_id: clientFinal || null, note: note || null,
        lignes: panier.map(({ produit_id, produit_nom, quantite, prix_unitaire, cout_unitaire }) => ({
          produit_id, produit_nom, quantite, prix_unitaire, cout_unitaire,
        })),
      }, profil)
      await rafraichir()
      setSucces(`Vente de ${FCFA(vente.total)} enregistrée.`)
      setPanier([]); setNote(''); setRecu(''); setVerse(''); setRecuEspeces(''); setRecuMobile('')
    } catch (e: any) {
      setErreur(e?.message ?? "Erreur lors de l'enregistrement")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl pb-10">
      <TitrePage titre="Caisse" sousTitre="Cliquez sur un produit pour l’ajouter au ticket" />
      {succes && <div className="mb-4"><Alerte ton="succes">{succes}</Alerte></div>}
      {erreur && <div className="mb-4"><Alerte>{erreur}</Alerte></div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_390px] lg:items-start">
        <div className="space-y-4">
          <Carte className="p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-bread-400" />
                <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher dans le catalogue…" className="pl-9" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['detail', 'revendeur'] as TypeClient[]).map((t) => (
                  <button key={t} onClick={() => changerType(t)} className={cn('flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-[13px] font-bold', typeClient === t ? 'border-gold-600 bg-gold-50 text-gold-900' : 'border-bread-200 bg-white text-bread-600')}>
                    {t === 'detail' ? <ShoppingBag size={17} /> : <Store size={17} />} {LIBELLE_TYPE_CLIENT[t]}
                  </button>
                ))}
              </div>
            </div>
          </Carte>

          {produits.length === 0 ? (
            <Carte><Vide texte="Aucun produit actif. Créez d’abord un produit dans le catalogue." icone={<Croissant size={26} />} /></Carte>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {produits.map((p) => {
                const rupture = p.stock === 0
                const dansPanier = quantitePanier(p.id)
                return (
                  <button key={p.id} onClick={() => ajouter(p)} disabled={rupture}
                    className={cn('group relative overflow-hidden rounded-2xl border bg-ivory text-left shadow-card transition-all', dansPanier ? 'border-gold-500 ring-2 ring-gold-500/30' : 'border-bread-200/80 hover:-translate-y-0.5 hover:border-gold-300', rupture && 'opacity-55')}>
                    {p.photo_url ? <img src={p.photo_url} alt={p.nom} className="h-32 w-full object-cover" /> : <div className="grid h-32 place-items-center bg-gradient-to-br from-bread-100 via-gold-50 to-bread-200 text-bread-400"><Croissant size={38} strokeWidth={1.4} /></div>}
                    {dansPanier > 0 && <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-gold-600 px-1.5 text-[11px] font-black text-white">{dansPanier}</span>}
                    {rupture && <span className="absolute left-2 top-2"><Etiquette ton="rouge">Rupture</Etiquette></span>}
                    <div className="p-3">
                      <p className="truncate text-[13px] font-black text-ink">{p.nom}</p>
                      <p className="truncate text-[10px] font-semibold text-bread-500">{p.categorie ?? '—'}{p.stock != null ? ` · stock ${p.stock}` : ''}</p>
                      <p className="mt-1 text-[15px] font-black text-gold-800">{FCFA(prixDe(p))}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-6">
          <Carte className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-bread-100 px-4 py-3">
              <div><h2 className="text-[15px] font-black text-ink">Ticket</h2><p className="text-[11px] text-bread-500">{nbArticles} article{nbArticles > 1 ? 's' : ''}</p></div>
              {panier.length > 0 && <button onClick={() => setPanier([])} className="text-[12px] font-bold text-red-600 hover:underline">Vider</button>}
            </div>

            {panier.length === 0 ? (
              <Vide texte="Appuyez sur un produit pour commencer le ticket." icone={<ShoppingCart size={24} />} />
            ) : (
              <ul className="max-h-[38vh] divide-y divide-bread-100 overflow-y-auto">
                {panier.map((l) => (
                  <li key={l.produit_id} className="px-4 py-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {l.produit?.photo_url ? <img src={l.produit.photo_url} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-bread-100 text-bread-400"><Croissant size={18} /></span>}
                        <div className="min-w-0"><p className="truncate text-[13px] font-bold text-ink">{l.produit_nom}</p><p className="text-[10px] text-bread-500">{FCFA(l.prix_unitaire)} / unité</p></div>
                      </div>
                      <button onClick={() => retirer(l.produit_id)} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-stone-400 hover:bg-red-50 hover:text-red-600">Retirer</button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <CompteurQuantite valeur={l.quantite} onChange={(q) => modifierQuantite(l.produit_id, q)} pas={typeClient === 'revendeur' ? 5 : 1} />
                      <span className="text-[15px] font-black text-ink">{FCFA(l.quantite * l.prix_unitaire)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-3 border-t border-bread-100 bg-bread-50/60 px-4 py-3">
              <Champ label={mode === 'credit' || mode === 'partiel' ? 'Nom du client (obligatoire)' : 'Nom du client (facultatif)'}>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <UserRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bread-400" />
                    <Input
                      list="clients-caisse"
                      value={clientNom}
                      onChange={(e) => saisirClient(e.target.value)}
                      placeholder="Ex. Boutique Adjo — vide = client de passage"
                      className="pl-9"
                    />
                    <datalist id="clients-caisse">
                      {clients.map((c) => <option key={c.id} value={c.nom} />)}
                    </datalist>
                  </div>
                  <Bouton variante="secondaire" className="shrink-0 px-3" onClick={() => setNouveauClient(true)} aria-label="Nouveau client"><Plus size={18} /></Bouton>
                </div>
                {clientNom.trim() && !clientId && (
                  <p className="mt-1 text-[11px] font-semibold text-bread-400">Nouveau client — il sera créé automatiquement.</p>
                )}
              </Champ>

              <div>
                <p className="mb-1.5 text-[12px] font-bold text-bread-600">Paiement</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['comptant', 'credit', 'partiel'] as ModePaiement[]).map((m) => (
                    <button key={m} onClick={() => setMode(m)} className={cn('rounded-xl border-2 px-2 py-2 text-[12px] font-bold', mode === m ? (m === 'comptant' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : m === 'credit' ? 'border-gold-600 bg-gold-50 text-gold-900' : 'border-sky-600 bg-sky-50 text-sky-800') : 'border-bread-200 bg-white text-bread-600')}>
                      {LIBELLE_PAIEMENT[m]}
                    </button>
                  ))}
                </div>
              </div>

              {mode !== 'credit' && (
                <div>
                  <p className="mb-1.5 text-[12px] font-bold text-bread-600">Moyen</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {MOYENS.map((m) => (
                      <button key={m.id} onClick={() => setMoyen(m.id)} className={cn('flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2 text-[10px] font-bold', moyen === m.id ? 'border-gold-600 bg-gold-50 text-gold-900' : 'border-bread-200 bg-white text-bread-600')}>
                        <m.icone size={17} /> {LIBELLE_MOYEN_PAIEMENT[m.id].split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === 'comptant' && moyen === 'mixte' && (
                <div className="grid grid-cols-2 gap-2">
                  <Champ label="Espèces reçues"><Input type="number" inputMode="numeric" value={recuEspeces} onChange={(e) => setRecuEspeces(e.target.value)} placeholder="0" /></Champ>
                  <Champ label="Mobile reçu"><Input type="number" inputMode="numeric" value={recuMobile} onChange={(e) => setRecuMobile(e.target.value)} placeholder="0" /></Champ>
                </div>
              )}

              {mode === 'comptant' && moyen !== 'mixte' && (
                <Champ label={moyen === 'especes' ? 'Montant reçu' : 'Montant réglé'}>
                  <Input type="number" inputMode="numeric" value={recu} placeholder={String(total)} onChange={(e) => setRecu(e.target.value)} />
                </Champ>
              )}

              {mode === 'partiel' && (
                <Champ label="Montant versé maintenant">
                  <Input type="number" inputMode="numeric" value={verse} placeholder={String(total)} onChange={(e) => setVerse(e.target.value)} />
                </Champ>
              )}

              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div><p className="font-semibold text-bread-500">Total</p><p className="text-xl font-black text-ink">{FCFA(total)}</p></div>
                <div className="text-right">
                  {mode === 'credit' ? <p className="font-semibold text-gold-700">Crédit client</p>
                  : mode === 'partiel' ? <>
                    <p className="font-semibold text-bread-500">Reste à payer</p>
                    <p className="text-xl font-black text-red-600">{FCFA(Math.max(0, total - (Number(verse) || 0)))}</p>
                  </>
                  : <>
                    <p className="font-semibold text-bread-500">Monnaie</p>
                    <p className="text-xl font-black text-emerald-700">{FCFA(monnaie)}</p>
                  </>}
                </div>
              </div>

              <Champ label="Note (facultatif)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. livraison marché" /></Champ>
              <Champ label="Date"><Input type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} /></Champ>

              <Bouton taille="lg" className="w-full" onClick={valider} disabled={enCours || !panier.length}>
                {enCours ? 'Enregistrement…' : mode === 'comptant' ? <><Check size={18} /> Encaisser</> : mode === 'credit' ? <><HandCoins size={18} /> Crédit</> : <><HandCoins size={18} /> Partiel</>}
              </Bouton>
            </div>
          </Carte>
        </div>
      </div>

      <NouveauClientModale
        ouvert={nouveauClient} type={typeClient}
        onFermer={() => setNouveauClient(false)}
        onCree={async (c) => { setTypeClient(c.type); setClientId(c.id); setClientNom(c.nom); setMode('credit'); setNouveauClient(false); patchData((d) => ({ ...d, clients: [...d.clients, c] })); setSucces(`Client « ${c.nom} » créé.`) }}
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
  const [enCours, setEnCours] = useState(false)

  useEffect(() => { if (ouvert) { setTypeC(type); setErreur(null) } }, [ouvert, type])

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
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Nouveau client"
      pied={<Bouton className="w-full" taille="lg" onClick={creer} disabled={enCours}>{enCours ? 'Création…' : 'Créer le client'}</Bouton>}>
      <div className="space-y-3">
        {erreur && <Alerte>{erreur}</Alerte>}
        <Champ label="Nom complet"><Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Boutique Adjo" autoFocus /></Champ>
        <Champ label="Téléphone"><Input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+228 …" inputMode="tel" /></Champ>
        <Champ label="Type">
          <Select value={typeC} onChange={(e) => setTypeC(e.target.value as TypeClient)}>
            <option value="detail">Détail</option>
            <option value="revendeur">Revendeur</option>
          </Select>
        </Champ>
        <div className="flex items-center gap-2 rounded-xl bg-bread-50 px-3 py-2.5">
          <Etiquette ton="ambre">Info</Etiquette>
          <p className="text-[12px] text-bread-600">Le solde dû démarre à 0 FCFA.</p>
        </div>
      </div>
    </Modale>
  )
}
