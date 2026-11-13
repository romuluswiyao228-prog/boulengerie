// ============================================================================
// Historique.tsx — Historique filtrable des ventes
// Filtres : date (du / au), produit, client, employé
// ============================================================================
import { useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { useStore } from '../lib/store'
import { LIBELLE_PAIEMENT, LIBELLE_TYPE_CLIENT } from '../lib/types'
import { addDays, aujourdhui, FCFA, formatDateFR, formatHeure } from '../lib/utils'
import {
  Bouton, Carte, Champ, Etiquette, Input, Select, TitrePage, Vide, cn,
} from '../components/ui'

export default function Historique() {
  const { data } = useStore()
  const [du, setDu] = useState(addDays(aujourdhui(), -7))
  const [au, setAu] = useState(aujourdhui())
  const [produitId, setProduitId] = useState('')
  const [clientId, setClientId] = useState('')
  const [employe, setEmploye] = useState('')
  const [ouverts, setOuverts] = useState<string[]>([])

  const employes = useMemo(
    () => Array.from(new Set(data.ventes.map((v) => v.user_email))).sort(),
    [data.ventes],
  )

  const ventes = useMemo(() => {
    return data.ventes
      .filter((v) => v.date >= du && v.date <= au)
      .filter((v) => !produitId || v.lignes.some((l) => l.produit_id === produitId))
      .filter((v) => !clientId || v.client_id === clientId)
      .filter((v) => !employe || v.user_email === employe)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  }, [data.ventes, du, au, produitId, clientId, employe])

  const totaux = useMemo(() => ({
    montant: ventes.reduce((s, v) => s + v.total, 0),
    comptant: ventes.filter((v) => v.mode_paiement === 'comptant').reduce((s, v) => s + v.total, 0),
    credit: ventes.filter((v) => v.mode_paiement === 'credit').reduce((s, v) => s + v.total, 0),
  }), [ventes])

  const reinit = () => {
    setDu(addDays(aujourdhui(), -7)); setAu(aujourdhui())
    setProduitId(''); setClientId(''); setEmploye('')
  }

  return (
    <div className="mx-auto max-w-4xl">
      <TitrePage titre="Historique des ventes" sousTitre="Filtrez par date, produit, client ou employé" />

      <Carte className="mb-5 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Champ label="Du">
            <Input type="date" value={du} onChange={(e) => setDu(e.target.value)} />
          </Champ>
          <Champ label="Au">
            <Input type="date" value={au} onChange={(e) => setAu(e.target.value)} />
          </Champ>
          <Champ label="Produit">
            <Select value={produitId} onChange={(e) => setProduitId(e.target.value)}>
              <option value="">Tous</option>
              {data.produits.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </Select>
          </Champ>
          <Champ label="Client">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Tous</option>
              {data.clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </Select>
          </Champ>
          <Champ label="Employé" className="col-span-2 sm:col-span-1">
            <Select value={employe} onChange={(e) => setEmploye(e.target.value)}>
              <option value="">Tous</option>
              {employes.map((e) => <option key={e} value={e}>{e}</option>)}
            </Select>
          </Champ>
          <div className="col-span-2 flex items-end sm:col-span-3">
            <Bouton variante="fantome" taille="sm" onClick={reinit}>Réinitialiser les filtres</Bouton>
          </div>
        </div>
      </Carte>

      <div className="mb-5 grid grid-cols-3 gap-2.5">
        <MiniStat label="Ventes" valeur={String(ventes.length)} />
        <MiniStat label="Total" valeur={FCFA(totaux.montant)} accent />
        <MiniStat label="Comptant / Crédit" valeur={`${FCFA(totaux.comptant)} / ${FCFA(totaux.credit)}`} petit />
      </div>

      {ventes.length === 0 ? (
        <Carte><Vide texte="Aucune vente ne correspond à ces filtres." icone={<Search size={24} />} /></Carte>
      ) : (
        <div className="space-y-2.5">
          {ventes.map((v) => {
            const ouvert = ouverts.includes(v.id)
            return (
              <Carte key={v.id} className="overflow-hidden">
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-stone-50"
                  onClick={() => setOuverts((o) => (o.includes(v.id) ? o.filter((x) => x !== v.id) : [...o, v.id]))}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13px] font-bold text-stone-900">{formatDateFR(v.date)}</span>
                      <span className="text-[11px] text-stone-400">{formatHeure(v.created_at)}</span>
                      <Etiquette ton={v.mode_paiement === 'comptant' ? 'vert' : 'rouge'}>
                        {LIBELLE_PAIEMENT[v.mode_paiement]}
                      </Etiquette>
                      <Etiquette ton={v.type_client === 'revendeur' ? 'bleu' : 'gris'}>
                        {LIBELLE_TYPE_CLIENT[v.type_client]}
                      </Etiquette>
                    </div>
                    <p className="mt-1 truncate text-[12px] text-stone-500">
                      {v.client_nom ?? 'Client de passage'} · {v.lignes.length} article{v.lignes.length > 1 ? 's' : ''} · {v.user_email}
                    </p>
                  </div>
                  <span className="shrink-0 text-[15px] font-black text-stone-900">{FCFA(v.total)}</span>
                  <ChevronDown size={18} className={cn('shrink-0 text-bread-400 transition-transform', ouvert && 'rotate-180')} />
                </button>
                {ouvert && (
                  <div className="border-t border-stone-100 bg-stone-50/60 px-4 py-3">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-stone-400">
                          <th className="pb-1.5 font-bold">Produit</th>
                          <th className="pb-1.5 text-center font-bold">Qté</th>
                          <th className="pb-1.5 text-right font-bold">P.U.</th>
                          <th className="pb-1.5 text-right font-bold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200/70">
                        {v.lignes.map((l) => (
                          <tr key={l.id}>
                            <td className="py-1.5 font-semibold text-stone-800">{l.produit_nom}</td>
                            <td className="py-1.5 text-center text-stone-600">{l.quantite}</td>
                            <td className="py-1.5 text-right text-stone-600">{FCFA(l.prix_unitaire)}</td>
                            <td className="py-1.5 text-right font-bold text-stone-900">{FCFA(l.quantite * l.prix_unitaire)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {v.note && <p className="mt-2 text-[12px] italic text-stone-500">Note : {v.note}</p>}
                  </div>
                )}
              </Carte>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, valeur, accent, petit }: { label: string; valeur: string; accent?: boolean; petit?: boolean }) {
  return (
    <Carte className={cn('px-3 py-2.5', accent && 'bg-stone-900 text-white border-stone-900')}>
      <p className={cn('text-[10px] font-bold uppercase tracking-wide', accent ? 'text-stone-300' : 'text-stone-500')}>{label}</p>
      <p className={cn('mt-0.5 font-black leading-tight', accent ? 'text-white' : 'text-stone-900', petit ? 'text-[12px]' : 'text-[15px] sm:text-base')}>{valeur}</p>
    </Carte>
  )
}
