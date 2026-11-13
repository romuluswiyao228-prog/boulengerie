// ============================================================================
// Depenses.tsx — Dépenses par catégorie (propriétaire uniquement)
// Catégories : farine, énergie, main-d'œuvre, transport, autres
// ============================================================================
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { HardHat, ReceiptText, Truck, Wallet, Wheat, Zap } from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import type { CategorieDepense } from '../lib/types'
import { LIBELLE_CATEGORIE } from '../lib/types'
import { addDays, aujourdhui, FCFA, formatDateFR, formatDateLongueFR, debutMois } from '../lib/utils'
import {
  Alerte, Bouton, Carte, Champ, Input, Modale, Select, TitrePage, Vide, ZoneTexte, cn,
} from '../components/ui'

const ICONES: Record<CategorieDepense, ReactNode> = {
  farine: <Wheat size={16} strokeWidth={2.2} />,
  energie: <Zap size={16} strokeWidth={2.2} />,
  main_oeuvre: <HardHat size={16} strokeWidth={2.2} />,
  transport: <Truck size={16} strokeWidth={2.2} />,
  autres: <ReceiptText size={16} strokeWidth={2.2} />,
}

export default function Depenses() {
  const { data, rafraichir } = useStore()
  const [du, setDu] = useState(debutMois(aujourdhui()))
  const [au, setAu] = useState(aujourdhui())
  const [categorie, setCategorie] = useState<CategorieDepense | ''>('')
  const [saisie, setSaisie] = useState(false)

  const liste = useMemo(
    () =>
      data.depenses
        .filter((d) => d.date >= du && d.date <= au)
        .filter((d) => !categorie || d.categorie === categorie)
        .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)),
    [data.depenses, du, au, categorie],
  )

  const total = liste.reduce((s, d) => s + d.montant, 0)
  const parCategorie = useMemo(() => {
    const m = new Map<CategorieDepense, number>()
    for (const d of liste) m.set(d.categorie, (m.get(d.categorie) ?? 0) + d.montant)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [liste])

  return (
    <div className="mx-auto max-w-3xl">
      <TitrePage
        titre="Achats & dépenses"
        sousTitre="Charges d'exploitation et achats"
        action={<Bouton onClick={() => setSaisie(true)}>＋ Dépense</Bouton>}
      />

      <Carte className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Du">
            <Input type="date" value={du} onChange={(e) => setDu(e.target.value)} />
          </Champ>
          <Champ label="Au">
            <Input type="date" value={au} onChange={(e) => setAu(e.target.value)} />
          </Champ>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Bouton variante="secondaire" taille="sm" onClick={() => { setDu(aujourdhui()); setAu(aujourdhui()) }}>Aujourd'hui</Bouton>
          <Bouton variante="secondaire" taille="sm" onClick={() => { setDu(addDays(aujourdhui(), -6)); setAu(aujourdhui()) }}>7 jours</Bouton>
          <Bouton variante="secondaire" taille="sm" onClick={() => { setDu(debutMois(aujourdhui())); setAu(aujourdhui()) }}>Ce mois</Bouton>
        </div>
      </Carte>

      <div className="mb-4 grid gap-2.5 sm:grid-cols-[1fr_1.4fr]">
        <Carte className="border-stone-900 bg-stone-900 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Total dépenses</p>
          <p className="text-xl font-black text-white">{FCFA(total)}</p>
        </Carte>
        <Carte className="px-4 py-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-500">Répartition</p>
          <div className="space-y-1">
            {parCategorie.length === 0 && <p className="text-[12px] text-stone-400">—</p>}
            {parCategorie.map(([c, m]) => (
              <div key={c} className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-stone-600">{ICONES[c]} {LIBELLE_CATEGORIE[c]}</span>
                <span className="font-bold text-stone-800">{FCFA(m)}</span>
              </div>
            ))}
          </div>
        </Carte>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCategorie('')}
          className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold',
            categorie === '' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200')}
        >Toutes</button>
        {(Object.keys(LIBELLE_CATEGORIE) as CategorieDepense[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategorie(c)}
            className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold',
              categorie === c ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200')}
          >{ICONES[c]} {LIBELLE_CATEGORIE[c]}</button>
        ))}
      </div>

      {liste.length === 0 ? (
        <Carte><Vide texte="Aucune dépense sur cette période." icone={<Wallet size={24} />} /></Carte>
      ) : (
        <div className="space-y-2">
          {liste.map((d) => (
            <Carte key={d.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-lg">
                {ICONES[d.categorie]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-stone-900">{LIBELLE_CATEGORIE[d.categorie]}</p>
                <p className="truncate text-[11px] text-stone-500">
                  {formatDateFR(d.date)}{d.note ? ` · ${d.note}` : ''} · {d.user_email}
                </p>
              </div>
              <span className="shrink-0 text-[15px] font-black text-stone-900">−{FCFA(d.montant)}</span>
            </Carte>
          ))}
        </div>
      )}

      {saisie && (
        <SaisieDepense
          onFermer={() => setSaisie(false)}
          onCree={async () => { await rafraichir(); setSaisie(false) }}
        />
      )}
    </div>
  )
}

function SaisieDepense({ onFermer, onCree }: { onFermer: () => void; onCree: () => Promise<void> }) {
  const { profil } = useStore()
  const [categorie, setCategorie] = useState<CategorieDepense>('farine')
  const [montant, setMontant] = useState('')
  const [date, setDate] = useState(aujourdhui())
  const [note, setNote] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const enregistrer = async () => {
    setErreur(null)
    const m = Number(montant)
    if (!m || m <= 0) return setErreur('Saisissez un montant valide.')
    setEnCours(true)
    try {
      await api.enregistrerDepense({ date, categorie, montant: m, note: note || null }, profil!)
      await onCree()
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modale
      ouvert onFermer={onFermer} titre="Nouvelle dépense"
      pied={
        <Bouton className="w-full" taille="lg" onClick={enregistrer} disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer la dépense'}
        </Bouton>
      }
    >
      <div className="space-y-3.5">
        {erreur && <Alerte>{erreur}</Alerte>}
        <Champ label="Catégorie">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(LIBELLE_CATEGORIE) as CategorieDepense[]).map((c) => (
              <button
                key={c}
                onClick={() => setCategorie(c)}
                className={cn(
                  'rounded-xl border-2 px-3 py-2.5 text-left text-[13px] font-bold',
                  categorie === c ? 'border-amber-600 bg-amber-50 text-amber-900' : 'border-stone-200 bg-white text-stone-600',
                )}
              >{ICONES[c]} {LIBELLE_CATEGORIE[c]}</button>
            ))}
          </div>
        </Champ>
        <Champ label="Montant (FCFA)">
          <Input type="number" inputMode="numeric" placeholder="0" value={montant} onChange={(e) => setMontant(e.target.value)} />
        </Champ>
        <Champ label="Date">
          <Input type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} />
        </Champ>
        <Champ label="Note">
          <ZoneTexte value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. 2 sacs de 50 kg chez le fournisseur" />
        </Champ>
        <p className="text-[11px] text-stone-400">{formatDateLongueFR(date)}</p>
      </div>
    </Modale>
  )
}
