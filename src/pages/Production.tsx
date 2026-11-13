// ============================================================================
// Production.tsx — Saisie quotidienne des quantités fabriquées (propriétaire)
// ============================================================================
import { useMemo, useState } from 'react'
import { Check, ClipboardList, Croissant } from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { aujourdhui, FCFA, formatDateLongueFR } from '../lib/utils'
import {
  Alerte, Bouton, Carte, Champ, Input, TitrePage, Vide, cn,
} from '../components/ui'

export default function Production() {
  const { data, profil, rafraichir } = useStore()
  const [date, setDate] = useState(aujourdhui())
  const [valeurs, setValeurs] = useState<Record<string, string>>({})
  const [succes, setSucces] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const produits = useMemo(() => data.produits.filter((p) => p.actif), [data.produits])

  const prodDuJour = useMemo(
    () => data.productions.filter((p) => p.date === date),
    [data.productions, date],
  )
  const valeurProd = (id: string) => valeurs[id] ?? String(prodDuJour.find((p) => p.produit_id === id)?.quantite ?? '')
  const totalQuantite = produits.reduce((s, p) => s + (Number(valeurProd(p.id)) || 0), 0)
  const coutTotal = produits.reduce((s, p) => {
    const q = Number(valeurProd(p.id)) || 0
    return s + q * p.cout_production
  }, 0)

  const enregistrer = async () => {
    setErreur(null); setSucces(null)
    const lignes = produits
      .map((p) => ({ p, q: Number(valeurProd(p.id)) || 0 }))
      .filter((x) => x.q > 0)
    if (!lignes.length) return setErreur('Saisissez au moins une quantité.')
    setEnCours(true)
    try {
      for (const { p, q } of lignes) {
        await api.enregistrerProduction(
          { date, produit_id: p.id, produit_nom: p.nom, quantite: q }, profil!,
        )
      }
      await rafraichir()
      setSucces('Production enregistrée.')
      setValeurs({})
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur')
    } finally {
      setEnCours(false)
    }
  }

  const historique = useMemo(() => {
    const parDate = new Map<string, { quantite: number; cout: number }>()
    for (const p of data.productions) {
      const prod = data.produits.find((x) => x.id === p.produit_id)
      const cur = parDate.get(p.date) ?? { quantite: 0, cout: 0 }
      cur.quantite += p.quantite
      cur.cout += p.quantite * (prod?.cout_production ?? 0)
      parDate.set(p.date, cur)
    }
    return [...parDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7)
  }, [data.productions, data.produits])

  return (
    <div className="mx-auto max-w-3xl">
      <TitrePage titre="Production" sousTitre="Quantités fabriquées par jour" />

      <Carte className="mb-4 p-4">
        <Champ label="Date de production" className="mb-4">
          <Input type="date" value={date} max={aujourdhui()} onChange={(e) => { setDate(e.target.value); setValeurs({}) }} />
        </Champ>
        <p className="mb-2 text-[12px] font-semibold text-stone-500">{formatDateLongueFR(date)}</p>

        {succes && <div className="mb-3"><Alerte ton="succes">{succes}</Alerte></div>}
        {erreur && <div className="mb-3"><Alerte>{erreur}</Alerte></div>}

        {produits.length === 0 ? (
          <Vide texte="Aucun produit actif." icone={<Croissant size={24} />} />
        ) : (
          <div className="space-y-2">
            {produits.map((p) => {
              const dejaSaisi = prodDuJour.find((x) => x.produit_id === p.id)
              return (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border-2 px-3 py-2.5',
                    dejaSaisi ? 'border-emerald-200 bg-emerald-50/50' : 'border-stone-200 bg-white',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-stone-900">{p.nom}</p>
                    <p className="text-[11px] text-stone-500">
                      coût unitaire {FCFA(p.cout_production)}
                      {dejaSaisi && <span className="ml-1 font-semibold text-emerald-700">· déjà saisi : {dejaSaisi.quantite}</span>}
                    </p>
                  </div>
                  <div className="w-20 shrink-0">
                    <Input
                      type="number" inputMode="numeric" placeholder="0"
                      value={valeurProd(p.id)}
                      onChange={(e) => setValeurs((v) => ({ ...v, [p.id]: e.target.value }))}
                      className="text-center font-bold"
                    />
                  </div>
                  <span className="hidden shrink-0 text-[11px] font-semibold text-stone-400 sm:block">unités</span>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between rounded-xl bg-stone-900 px-4 py-3 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Total fabriqué</p>
            <p className="text-lg font-black">{totalQuantite} unités</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Coût de production</p>
            <p className="text-lg font-black">{FCFA(coutTotal)}</p>
          </div>
        </div>

        <Bouton className="mt-3 w-full" taille="lg" onClick={enregistrer} disabled={enCours}>
          {enCours ? 'Enregistrement…' : <><Check size={18} /> Enregistrer la production</>}
        </Bouton>
      </Carte>

      <Carte className="p-4">
        <h2 className="mb-3 text-[14px] font-black text-stone-900">7 derniers jours</h2>
        {historique.length === 0 ? (
          <Vide texte="Aucune production enregistrée." icone={<ClipboardList size={24} />} />
        ) : (
          <ul className="divide-y divide-stone-100">
            {historique.map(([d, v]) => (
              <li key={d} className="flex items-center justify-between py-2.5">
                <span className="text-[13px] font-semibold text-stone-700">{formatDateLongueFR(d)}</span>
                <span className="text-[12px] text-stone-500">
                  {v.quantite} unités · <strong className="text-stone-800">{FCFA(v.cout)}</strong>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </div>
  )
}
