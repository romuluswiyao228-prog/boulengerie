// ============================================================================
// Commandes.tsx — Précommandes et livraisons
// Statuts : à préparer → prête → livrée (ou annulée).
// À la livraison, la commande est transformée en vente (comptant ou crédit).
// ============================================================================
import { useMemo, useState } from 'react'
import { Banknote, CalendarDays, Check, HandCoins, Package, Plus, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import type { Commande, StatutCommande } from '../lib/types'
import { LIBELLE_STATUT } from '../lib/types'
import { aujourdhui, demain, FCFA, formatDateFR, formatDateLongueFR } from '../lib/utils'
import {
  Alerte, Bouton, Carte, Champ, CompteurQuantite, Etiquette, Input, Modale, Select, TitrePage, Vide, ZoneTexte, cn,
} from '../components/ui'

const TON: Record<StatutCommande, 'ambre' | 'bleu' | 'vert' | 'gris'> = {
  a_preparer: 'ambre',
  prete: 'bleu',
  livree: 'vert',
  annulee: 'gris',
}

export default function Commandes() {
  const { data, rafraichir } = useStore()
  const [onglet, setOnglet] = useState<'demain' | 'jour' | 'encours' | 'toutes'>('demain')
  const [creation, setCreation] = useState(false)
  const [livraison, setLivraison] = useState<Commande | null>(null)

  const commandes = useMemo(() => {
    const d = demain(), j = aujourdhui()
    const base = [...data.commandes].sort((a, b) => a.date_livraison.localeCompare(b.date_livraison))
    switch (onglet) {
      case 'demain': return base.filter((c) => c.date_livraison === d && c.statut !== 'annulee')
      case 'jour': return base.filter((c) => c.date_livraison === j)
      case 'encours': return base.filter((c) => c.statut === 'a_preparer' || c.statut === 'prete')
      default: return base.reverse()
    }
  }, [data.commandes, onglet])

  const stats = useMemo(() => {
    const actives = data.commandes.filter((c) => c.statut === 'a_preparer' || c.statut === 'prete')
    return {
      aPreparer: data.commandes.filter((c) => c.statut === 'a_preparer').length,
      demain: data.commandes.filter((c) => c.date_livraison === demain() && c.statut !== 'annulee').length,
      valeur: actives.reduce((s, c) => s + c.total, 0),
    }
  }, [data.commandes])

  const changerStatut = async (id: string, s: StatutCommande) => {
    await api.changerStatutCommande(id, s)
    await rafraichir()
  }

  return (
    <div className="mx-auto max-w-4xl">
      <TitrePage
        titre="Précommandes"
        sousTitre="Commandes clients et livraisons"
        action={<Bouton onClick={() => setCreation(true)}><Plus size={18} /> Commande</Bouton>}
      />

      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <Carte className="px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">À préparer</p>
          <p className="mt-0.5 text-lg font-black text-stone-900">{stats.aPreparer}</p>
        </Carte>
        <Carte className="px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Demain</p>
          <p className="mt-0.5 text-lg font-black text-stone-900">{stats.demain}</p>
        </Carte>
        <Carte className="bg-stone-900 border-stone-900 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Valeur en cours</p>
          <p className="mt-0.5 text-[13px] font-black leading-tight text-white">{FCFA(stats.valeur)}</p>
        </Carte>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {([
          ['demain', 'À préparer demain'],
          ['jour', "Aujourd'hui"],
          ['encours', 'En cours'],
          ['toutes', 'Toutes'],
        ] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setOnglet(v)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold transition-colors',
              onglet === v ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200',
            )}
          >{v === 'demain' && <CalendarDays size={15} />}{l}</button>
        ))}
      </div>

      {onglet === 'demain' && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] font-semibold text-amber-900 ring-1 ring-amber-200">
          Livraisons prévues {formatDateLongueFR(demain())}
        </p>
      )}

      {commandes.length === 0 ? (
        <Carte><Vide texte="Aucune commande dans cette vue." icone={<Package size={24} />} /></Carte>
      ) : (
        <div className="space-y-2.5">
          {commandes.map((c) => (
            <Carte key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[14px] font-black text-stone-900">{c.client_nom}</p>
                    <Etiquette ton={TON[c.statut]}>{LIBELLE_STATUT[c.statut]}</Etiquette>
                  </div>
                  <p className="mt-1 text-[12px] text-stone-500">
                    Livraison : <strong className="text-stone-700">{formatDateFR(c.date_livraison)}</strong>
                    {c.adresse ? ` · ${c.adresse}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-[15px] font-black text-stone-900">{FCFA(c.total)}</p>
              </div>

              <ul className="mt-2.5 space-y-1 rounded-xl bg-stone-50 px-3 py-2">
                {c.lignes.map((l) => (
                  <li key={l.id} className="flex justify-between text-[12px]">
                    <span className="font-semibold text-stone-700">{l.quantite} × {l.produit_nom}</span>
                    <span className="text-stone-500">{FCFA(l.quantite * l.prix_unitaire)}</span>
                  </li>
                ))}
              </ul>
              {c.note && <p className="mt-2 text-[12px] italic text-stone-500">Note : {c.note}</p>}

              {c.statut !== 'livree' && c.statut !== 'annulee' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.statut === 'a_preparer' && (
                    <Bouton taille="sm" variante="secondaire" onClick={() => changerStatut(c.id, 'prete')}>
                      Marquer prête
                    </Bouton>
                  )}
                  <Bouton taille="sm" variante="succes" onClick={() => setLivraison(c)}>
                    <Check size={16} className="mr-1 inline" /> Livrer → vente
                  </Bouton>
                  <Bouton taille="sm" variante="fantome" onClick={() => changerStatut(c.id, 'annulee')}>
                    Annuler
                  </Bouton>
                </div>
              )}
              {c.statut === 'livree' && (
                <p className="mt-3 text-[12px] font-semibold text-emerald-700"><Check size={16} className="mr-1 inline" /> Livrée et convertie en vente</p>
              )}
            </Carte>
          ))}
        </div>
      )}

      <CreationCommande
        ouvert={creation}
        onFermer={() => setCreation(false)}
        onCree={async () => { await rafraichir(); setCreation(false); setOnglet('encours') }}
      />
      {livraison && (
        <ModaleLivraison
          commande={livraison}
          onFermer={() => setLivraison(null)}
          onLivre={async () => { await rafraichir(); setLivraison(null) }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function CreationCommande({
  ouvert, onFermer, onCree,
}: { ouvert: boolean; onFermer: () => void; onCree: () => Promise<void> }) {
  const { data, profil } = useStore()
  const [clientId, setClientId] = useState('')
  const [dateLiv, setDateLiv] = useState(demain())
  const [adresse, setAdresse] = useState('')
  const [note, setNote] = useState('')
  const [lignes, setLignes] = useState<{ produit_id: string; quantite: number }[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const client = data.clients.find((c) => c.id === clientId)
  const prix = (pid: string) => {
    const p = data.produits.find((x) => x.id === pid)!
    if (!p) return 0
    return client?.type === 'revendeur' ? p.prix_revendeur : p.prix_detail
  }
  const total = lignes.reduce((s, l) => s + l.quantite * prix(l.produit_id), 0)

  const ajouterProduit = (pid: string) => {
    if (!pid) return
    setLignes((prev) =>
      prev.some((l) => l.produit_id === pid)
        ? prev.map((l) => (l.produit_id === pid ? { ...l, quantite: l.quantite + 1 } : l))
        : [...prev, { produit_id: pid, quantite: 1 }],
    )
  }

  const creer = async () => {
    setErreur(null)
    if (!clientId) return setErreur('Sélectionnez un client.')
    if (!lignes.length) return setErreur('Ajoutez au moins un produit.')
    setEnCours(true)
    try {
      await api.creerCommande({
        client_id: clientId, date_livraison: dateLiv,
        adresse: adresse || null, note: note || null,
        lignes: lignes.map((l) => {
          const p = data.produits.find((x) => x.id === l.produit_id)!
          return {
            produit_id: l.produit_id, produit_nom: p.nom,
            quantite: l.quantite, prix_unitaire: prix(l.produit_id),
          }
        }),
      }, profil!)
      await onCree()
      setClientId(''); setLignes([]); setAdresse(''); setNote('')
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modale
      ouvert={ouvert} onFermer={onFermer} titre="Nouvelle précommande"
      pied={
        <Bouton className="w-full" taille="lg" onClick={creer} disabled={enCours}>
          {enCours ? 'Création…' : `Enregistrer la commande · ${FCFA(total)}`}
        </Bouton>
      }
    >
      <div className="space-y-3.5">
        {erreur && <Alerte>{erreur}</Alerte>}
        <Champ label="Client">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">— Choisir —</option>
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>{c.nom} ({c.type === 'revendeur' ? 'revendeur' : 'détail'})</option>
            ))}
          </Select>
        </Champ>
        <div className="grid grid-cols-2 gap-2.5">
          <Champ label="Date de livraison">
            <Input type="date" value={dateLiv} min={aujourdhui()} onChange={(e) => setDateLiv(e.target.value)} />
          </Champ>
          <Champ label="Adresse (option)">
            <Input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Quartier, rue…" />
          </Champ>
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-stone-600">Ajouter un produit</p>
          <div className="flex flex-wrap gap-2">
            {data.produits.filter((p) => p.actif).map((p) => (
              <button
                key={p.id}
                onClick={() => ajouterProduit(p.id)}
                className="rounded-xl border-2 border-stone-200 bg-white px-3 py-2 text-[12px] font-bold text-stone-700 active:bg-amber-50"
              >
                <Plus size={14} className="mr-1 inline" /> {p.nom}
              </button>
            ))}
          </div>
        </div>

        {lignes.length > 0 && (
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
            {lignes.map((l) => {
              const p = data.produits.find((x) => x.id === l.produit_id)!
              return (
                <li key={l.produit_id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-stone-900">{p.nom}</p>
                    <p className="text-[11px] text-stone-500">{FCFA(prix(l.produit_id))} / unité</p>
                  </div>
                  <CompteurQuantite
                    valeur={l.quantite}
                    pas={client?.type === 'revendeur' ? 5 : 1}
                    onChange={(q) => setLignes((prev) => prev.map((x) => x.produit_id === l.produit_id ? { ...x, quantite: q } : x))}
                  />
                  <button
                    onClick={() => setLignes((prev) => prev.filter((x) => x.produit_id !== l.produit_id))}
                    className="shrink-0 rounded-lg px-1.5 py-1 text-stone-400 hover:text-red-600"
                    aria-label="Retirer"
                  ><X size={16} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <Champ label="Note">
          <ZoneTexte value={note} onChange={(e) => setNote(e.target.value)} placeholder="Précisions de préparation, heure de passage…" />
        </Champ>
      </div>
    </Modale>
  )
}

// ---------------------------------------------------------------------------
function ModaleLivraison({
  commande, onFermer, onLivre,
}: { commande: Commande; onFermer: () => void; onLivre: () => Promise<void> }) {
  const { profil } = useStore()
  const [mode, setMode] = useState<'comptant' | 'credit'>('comptant')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const livrer = async () => {
    setEnCours(true)
    try {
      await api.livrerCommande(commande.id, mode, aujourdhui(), profil!)
      await onLivre()
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modale
      ouvert onFermer={onFermer} titre="Livrer la commande"
      pied={
        <Bouton className="w-full" taille="lg" variante="succes" onClick={livrer} disabled={enCours}>
          {enCours ? 'Livraison…' : <><Check size={18} /> Confirmer la livraison</>}
        </Bouton>
      }
    >
      <div className="space-y-3.5">
        {erreur && <Alerte>{erreur}</Alerte>}
        <div className="rounded-2xl bg-stone-50 p-3.5">
          <p className="text-[13px] font-bold text-stone-900">{commande.client_nom}</p>
          <p className="text-[12px] text-stone-500">Total de la commande</p>
          <p className="mt-1 text-2xl font-black text-stone-900">{FCFA(commande.total)}</p>
        </div>
        <p className="text-[13px] font-semibold text-stone-600">Mode de paiement de la vente</p>
        <div className="grid grid-cols-2 gap-2">
          {(['comptant', 'credit'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-xl border-2 px-3 py-3 text-[14px] font-bold',
                mode === m
                  ? m === 'comptant' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-orange-600 bg-orange-50 text-orange-800'
                  : 'border-stone-200 bg-white text-stone-600',
              )}
            >
              {m === 'comptant' ? <><Banknote size={18} className="mr-1 inline" /> Comptant</> : <><HandCoins size={18} className="mr-1 inline" /> Crédit</>}
            </button>
          ))}
        </div>
        <Alerte ton="info">
          La commande sera marquée <strong>livrée</strong> et une vente sera créée avec la date du jour.
          {mode === 'credit' && ' Le montant sera ajouté au solde dû du client.'}
        </Alerte>
      </div>
    </Modale>
  )
}
