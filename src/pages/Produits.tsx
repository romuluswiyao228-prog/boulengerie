// ============================================================================
// Produits.tsx — CRUD produits (propriétaire) / consultation (employé)
// ============================================================================
import { useState } from 'react'
import { Croissant } from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import type { Produit } from '../lib/types'
import { FCFA } from '../lib/utils'
import {
  Alerte, Bouton, Carte, Champ, CompteurQuantite, Etiquette, Input, Modale, TitrePage, Vide, cn,
} from '../components/ui'

const VIDE: Omit<Produit, 'id' | 'created_at'> = {
  nom: '', prix_detail: 0, prix_revendeur: 0, cout_production: 0, actif: true,
}

export default function Produits() {
  const { data, estProprietaire, rafraichir } = useStore()
  const [edition, setEdition] = useState<(Omit<Produit, 'id' | 'created_at'> & { id?: string }) | null>(null)
  const [filtre, setFiltre] = useState<'tous' | 'actifs' | 'inactifs'>('tous')

  const produits = data.produits
    .filter((p) => (filtre === 'tous' ? true : filtre === 'actifs' ? p.actif : !p.actif))
    .sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom))

  const basculer = async (p: Produit) => {
    await api.basculerProduit(p.id, !p.actif)
    await rafraichir()
  }

  return (
    <div className="mx-auto max-w-4xl">
      <TitrePage
        titre="Produits"
        sousTitre={estProprietaire ? 'Prix, coûts de production et disponibilité' : 'Catalogue et prix appliqués'}
        action={estProprietaire ? <Bouton onClick={() => setEdition({ ...VIDE })}>＋ Produit</Bouton> : undefined}
      />

      <div className="mb-4 flex gap-2">
        {([['tous', 'Tous'], ['actifs', 'Actifs'], ['inactifs', 'Inactifs']] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFiltre(v)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[12px] font-bold',
              filtre === v ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200',
            )}
          >{l}</button>
        ))}
      </div>

      {produits.length === 0 ? (
        <Carte><Vide texte="Aucun produit." icone={<Croissant size={24} />} /></Carte>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {produits.map((p) => {
            const margeDetail = p.prix_detail - p.cout_production
            const margeRev = p.prix_revendeur - p.cout_production
            return (
              <Carte key={p.id} className={cn('p-4', !p.actif && 'opacity-60')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-black text-stone-900">{p.nom}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Etiquette ton={p.actif ? 'vert' : 'gris'}>{p.actif ? 'Actif' : 'Inactif'}</Etiquette>
                    </div>
                  </div>
                  {estProprietaire && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => setEdition({ ...p })}
                        className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-[11px] font-bold text-stone-600 hover:bg-stone-50"
                      >Modifier</button>
                      <button
                        onClick={() => basculer(p)}
                        className={cn(
                          'rounded-lg px-2.5 py-1.5 text-[11px] font-bold',
                          p.actif ? 'bg-stone-100 text-stone-600' : 'bg-emerald-600 text-white',
                        )}
                      >{p.actif ? 'Désactiver' : 'Activer'}</button>
                    </div>
                  )}
                </div>

                <dl className="mt-3 space-y-1.5 text-[12px]">
                  <Ligne label="Prix détail" valeur={FCFA(p.prix_detail)} />
                  <Ligne label="Prix revendeur" valeur={FCFA(p.prix_revendeur)} />
                  {estProprietaire && (
                    <>
                      <Ligne label="Coût production" valeur={FCFA(p.cout_production)} />
                      <Ligne label="Marge détail" valeur={FCFA(margeDetail)} ton={margeDetail >= 0 ? 'ok' : 'ko'} />
                      <Ligne label="Marge revendeur" valeur={FCFA(margeRev)} ton={margeRev >= 0 ? 'ok' : 'ko'} />
                    </>
                  )}
                </dl>
              </Carte>
            )
          })}
        </div>
      )}

      {!estProprietaire && (
        <p className="mt-4 text-center text-[11px] text-stone-400">
          La modification des produits et des coûts est réservée au propriétaire.
        </p>
      )}

      {edition && (
        <EditionProduit
          initial={edition}
          onFermer={() => setEdition(null)}
          onEnregistre={async () => { await rafraichir(); setEdition(null) }}
        />
      )}
    </div>
  )
}

function Ligne({ label, valeur, ton }: { label: string; valeur: string; ton?: 'ok' | 'ko' }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-stone-500">{label}</dt>
      <dd className={cn('font-bold', ton === 'ok' ? 'text-emerald-700' : ton === 'ko' ? 'text-red-600' : 'text-stone-800')}>
        {valeur}
      </dd>
    </div>
  )
}

function EditionProduit({
  initial, onFermer, onEnregistre,
}: {
  initial: Omit<Produit, 'id' | 'created_at'> & { id?: string }
  onFermer: () => void
  onEnregistre: () => Promise<void>
}) {
  const [form, setForm] = useState(initial)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const enregistrer = async () => {
    if (!form.nom.trim()) return setErreur('Le nom est obligatoire.')
    if (form.prix_detail <= 0) return setErreur('Le prix détail doit être supérieur à 0.')
    setEnCours(true)
    try {
      await api.enregistrerProduit({
        id: form.id, nom: form.nom.trim(),
        prix_detail: Number(form.prix_detail), prix_revendeur: Number(form.prix_revendeur),
        cout_production: Number(form.cout_production), actif: form.actif,
      })
      await onEnregistre()
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modale
      ouvert onFermer={onFermer}
      titre={form.id ? 'Modifier le produit' : 'Nouveau produit'}
      pied={
        <Bouton className="w-full" taille="lg" onClick={enregistrer} disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </Bouton>
      }
    >
      <div className="space-y-3.5">
        {erreur && <Alerte>{erreur}</Alerte>}
        <Champ label="Nom du produit">
          <Input value={form.nom} onChange={(e) => set('nom', e.target.value)} placeholder="Ex. Baguette" autoFocus />
        </Champ>
        <Champ label="Prix de vente détail (FCFA)">
          <Input type="number" inputMode="numeric" value={form.prix_detail || ''}
            onChange={(e) => set('prix_detail', Number(e.target.value))} placeholder="200" />
        </Champ>
        <Champ label="Prix de vente revendeur (FCFA)">
          <Input type="number" inputMode="numeric" value={form.prix_revendeur || ''}
            onChange={(e) => set('prix_revendeur', Number(e.target.value))} placeholder="150" />
        </Champ>
        <Champ label="Coût de production unitaire (FCFA)" aide="Utilisé dans le calcul du bénéfice.">
          <Input type="number" inputMode="numeric" value={form.cout_production || ''}
            onChange={(e) => set('cout_production', Number(e.target.value))} placeholder="95" />
        </Champ>
        {form.prix_detail > 0 && (
          <div className="rounded-xl bg-stone-50 px-3.5 py-3 text-[12px] text-stone-600">
            Marge détail : <strong className="text-emerald-700">{FCFA(form.prix_detail - form.cout_production)}</strong>
            {' · '}Marge revendeur : <strong className={form.prix_revendeur - form.cout_production >= 0 ? 'text-emerald-700' : 'text-red-600'}>
              {FCFA(form.prix_revendeur - form.cout_production)}
            </strong>
          </div>
        )}
        <label className="flex items-center justify-between rounded-xl border-2 border-stone-200 px-3.5 py-3">
          <span className="text-[14px] font-semibold text-stone-700">Produit actif</span>
          <input
            type="checkbox" checked={form.actif}
            onChange={(e) => set('actif', e.target.checked)}
            className="h-6 w-6 accent-amber-600"
          />
        </label>
      </div>
    </Modale>
  )
}
