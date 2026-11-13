// ============================================================================
// Invendus.tsx — Invendus et pertes de fin de journée
// valeur perdue = quantité × prix de vente (détail)
// ============================================================================
import { useMemo, useState } from 'react'
import { Check, Trash2, TrendingDown } from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import type { MotifPerte } from '../lib/types'
import { LIBELLE_MOTIF } from '../lib/types'
import { aujourdhui, FCFA, formatDateFR, formatDateLongueFR } from '../lib/utils'
import {
  Alerte, Bouton, Carte, Champ, Etiquette, Input, Modale, Select, TitrePage, Vide, ZoneTexte, cn,
} from '../components/ui'

export default function Invendus() {
  const { data, profil, rafraichir } = useStore()
  const [date, setDate] = useState(aujourdhui())
  const [saisie, setSaisie] = useState<{ produitId: string; quantite: string; motif: MotifPerte; note: string } | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const duJour = useMemo(
    () => data.invendus.filter((i) => i.date === date).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [data.invendus, date],
  )
  const valeurJour = duJour.reduce((s, i) => s + i.valeur_perdue, 0)

  const ouvreSaisie = (produitId = '') =>
    setSaisie({ produitId, quantite: '', motif: 'perte', note: '' })

  const enregistrer = async () => {
    if (!saisie) return
    setErreur(null)
    const p = data.produits.find((x) => x.id === saisie.produitId)
    const q = Number(saisie.quantite)
    if (!p) return setErreur('Choisissez un produit.')
    if (!q || q <= 0) return setErreur('Saisissez une quantité supérieure à 0.')
    setEnCours(true)
    try {
      await api.enregistrerInvendu({
        date, produit_id: p.id, produit_nom: p.nom, quantite: q,
        valeur_perdue: q * p.prix_detail, motif: saisie.motif, note: saisie.note || null,
      }, profil!)
      await rafraichir()
      setSaisie(null)
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur')
    } finally {
      setEnCours(false)
    }
  }

  // Historique 7 jours
  const historique = useMemo(() => {
    const map = new Map<string, number>()
    for (const i of data.invendus) map.set(i.date, (map.get(i.date) ?? 0) + i.valeur_perdue)
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7)
  }, [data.invendus])

  return (
    <div className="mx-auto max-w-3xl">
      <TitrePage
        titre="Invendus &amp; pertes"
        sousTitre="Saisie de fin de journée"
        action={<Bouton onClick={() => ouvreSaisie()} className="shrink-0 whitespace-nowrap">＋ Saisir</Bouton>}
      />

      <Carte className="mb-4 p-4">
        <Champ label="Date">
          <Input type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} />
        </Champ>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-stone-900 px-4 py-3 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Valeur perdue</p>
            <p className="text-xl font-black">{FCFA(valeurJour)}</p>
          </div>
          <p className="text-[11px] text-stone-400">{duJour.length} ligne{duJour.length > 1 ? 's' : ''}</p>
        </div>
      </Carte>

      {duJour.length === 0 ? (
        <Carte className="mb-4"><Vide texte={`Aucun invendu saisi pour le ${formatDateFR(date)}.`} icone={<Trash2 size={24} />} /></Carte>
      ) : (
        <div className="mb-4 space-y-2">
          {duJour.map((i) => (
            <Carte key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold text-stone-900">{i.produit_nom}</p>
                <p className="text-[11px] text-stone-500">
                  {i.quantite} unités · {i.user_email}{i.note ? ` · ${i.note}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Etiquette ton={i.motif === 'perte' ? 'rouge' : i.motif === 'don' ? 'bleu' : 'ambre'}>
                  {LIBELLE_MOTIF[i.motif]}
                </Etiquette>
                <span className="text-[14px] font-black text-red-600">−{FCFA(i.valeur_perdue)}</span>
              </div>
            </Carte>
          ))}
        </div>
      )}

      <Carte className="p-4">
        <h2 className="mb-3 text-[14px] font-black text-stone-900">Historique (7 derniers jours saisis)</h2>
        {historique.length === 0 ? (
          <Vide texte="Aucune perte enregistrée." icone={<TrendingDown size={24} />} />
        ) : (
          <ul className="divide-y divide-stone-100">
            {historique.map(([d, v]) => (
              <li key={d} className="flex items-center justify-between py-2.5">
                <span className="text-[13px] font-semibold text-stone-700">{formatDateLongueFR(d)}</span>
                <span className="text-[13px] font-bold text-red-600">−{FCFA(v)}</span>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      {saisie && (
        <Modale
          ouvert onFermer={() => setSaisie(null)} titre="Saisir un invendu"
          pied={
            <Bouton className="w-full" taille="lg" onClick={enregistrer} disabled={enCours}>
              {enCours ? 'Enregistrement…' : <><Check size={18} /> Enregistrer</>}
            </Bouton>
          }
        >
          <div className="space-y-3.5">
            {erreur && <Alerte>{erreur}</Alerte>}
            <Champ label="Produit">
              <Select value={saisie.produitId} onChange={(e) => setSaisie({ ...saisie, produitId: e.target.value })}>
                <option value="">— Choisir —</option>
                {data.produits.filter((p) => p.actif).map((p) => (
                  <option key={p.id} value={p.id}>{p.nom} ({FCFA(p.prix_detail)})</option>
                ))}
              </Select>
            </Champ>
            <Champ label="Quantité invendue">
              <Input
                type="number" inputMode="numeric" placeholder="0"
                value={saisie.quantite}
                onChange={(e) => setSaisie({ ...saisie, quantite: e.target.value })}
              />
            </Champ>
            <Champ label="Motif">
              <div className="grid grid-cols-3 gap-2">
                {(['perte', 'reduction', 'don'] as MotifPerte[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSaisie({ ...saisie, motif: m })}
                    className={cn(
                      'rounded-xl border-2 px-2 py-2.5 text-[12px] font-bold',
                      saisie.motif === m ? 'border-amber-600 bg-amber-50 text-amber-900' : 'border-stone-200 bg-white text-stone-600',
                    )}
                  >{LIBELLE_MOTIF[m]}</button>
                ))}
              </div>
            </Champ>
            <Champ label="Note (facultatif)">
              <ZoneTexte value={saisie.note} onChange={(e) => setSaisie({ ...saisie, note: e.target.value })} placeholder="Ex. four trop cuit" />
            </Champ>
            {saisie.produitId && Number(saisie.quantite) > 0 && (
              <div className="rounded-xl bg-red-50 px-3.5 py-3 text-[13px] font-bold text-red-700">
                Valeur perdue estimée :{' '}
                {FCFA(Number(saisie.quantite) * (data.produits.find((p) => p.id === saisie.produitId)?.prix_detail ?? 0))}
              </div>
            )}
          </div>
        </Modale>
      )}
    </div>
  )
}
