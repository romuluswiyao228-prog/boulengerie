// ============================================================================
// Credits.tsx — Clients (comptant) et Crédits (dettes) séparés
// ============================================================================
import { useMemo, useState } from 'react'
import { Check, HandCoins, Plus, Printer, UserRound } from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import type { Client, Vente } from '../lib/types'
import { LIBELLE_PAIEMENT, LIBELLE_TYPE_CLIENT } from '../lib/types'
import { aujourdhui, FCFA, formatDateFR } from '../lib/utils'
import {
  Alerte, Bouton, Carte, Champ, Etiquette, Input, Modale, TitrePage, Vide, cn,
} from '../components/ui'
import { NouveauClientModale } from './Ventes'

// Part d'une vente restée à charge du client (crédit = total, partiel = reste)
const detteVente = (v: Vente) => v.reste_a_payer ?? Math.max(v.total - (v.montant_paye ?? 0), 0)

export default function Credits() {
  const { data, profil, rafraichir, patchData } = useStore()
  const [recherche, setRecherche] = useState('')
  const [clientActif, setClientActif] = useState<Client | null>(null)
  const [nouveau, setNouveau] = useState(false)

  const correspond = (c: Client) =>
    !recherche ||
    c.nom.toLowerCase().includes(recherche.toLowerCase()) ||
    (c.telephone ?? '').includes(recherche)

  // A. Clients qui paient directement (pas de dette en cours)
  const clientsComptant = useMemo(
    () => data.clients.filter((c) => c.solde_du <= 0 && correspond(c)).sort((a, b) => a.nom.localeCompare(b.nom)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.clients, recherche],
  )

  // B. Clients à crédit (dette en cours)
  const clientsCredit = useMemo(
    () => data.clients.filter((c) => c.solde_du > 0 && correspond(c)).sort((a, b) => b.solde_du - a.solde_du),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.clients, recherche],
  )

  const totalDu = data.clients.reduce((s, c) => s + Math.max(0, c.solde_du), 0)

  // Agrégats par client : priorité à la vue SQL v_stats_clients,
  // sinon recalcul depuis les ventes/remboursements chargés.
  const statsDe = (c: Client) => {
    const ventesClient = data.ventes.filter((v) => v.client_id === c.id)
    const rembClient = data.remboursements.filter((r) => r.client_id === c.id)
    const comptant = ventesClient.filter((v) => v.mode_paiement === 'comptant').reduce((s, v) => s + v.total, 0)
    const paye = ventesClient.reduce((s, v) => s + (v.montant_paye ?? (v.mode_paiement === 'comptant' ? v.total : 0)), 0)
    const credit = ventesClient.reduce((s, v) => s + detteVente(v), 0)
    const remb = rembClient.reduce((s, r) => s + r.montant, 0)
    const totalVentes = ventesClient.reduce((s, v) => s + v.total, 0)
    const st = c.stats
    return {
      totalVentes: st?.total_ventes ?? totalVentes,
      totalComptant: st?.total_comptant ?? comptant,
      totalCredit: st?.total_credit ?? credit,
      totalRemb: st?.total_rembourse ?? remb,
      totalPaye: st ? st.total_verse + st.total_rembourse : paye + remb,
      solde: c.solde_du,
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <TitrePage
        titre="Clients & crédits"
        sousTitre="Clients au comptant et dettes à recouvrer"
        action={<Bouton taille="md" onClick={() => setNouveau(true)}><Plus size={18} /> Client</Bouton>}
      />

      <div className="mb-4">
        <Input
          placeholder="Rechercher un client (nom ou téléphone)…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>

      {/* ---------------- A. CLIENTS (comptant) ---------------- */}
      <div className="mb-6">
        <div className="mb-2.5 flex items-center gap-2">
          <UserRound size={17} className="text-bread-500" />
          <h2 className="text-[15px] font-black text-ink">Clients</h2>
          <span className="rounded-full bg-bread-100 px-2 py-0.5 text-[11px] font-bold text-bread-600">{clientsComptant.length}</span>
        </div>
        <p className="mb-3 text-[12px] text-bread-500">Clients sans dette en cours — leurs achats sont payés directement.</p>

        {clientsComptant.length === 0 ? (
          <Carte><Vide texte={data.clients.length === 0 ? 'Aucun client. Ajoutez votre premier client.' : 'Aucun client sans dette pour cette recherche.'} icone={<UserRound size={24} />} /></Carte>
        ) : (
          <div className="space-y-2">
            {clientsComptant.map((c) => {
              const st = statsDe(c)
              return (
              <Carte key={c.id} className="overflow-hidden">
                <button onClick={() => setClientActif(c)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gold-50/50">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bread-100 text-[13px] font-black text-bread-700">
                    {c.nom.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-ink">{c.nom}</p>
                    <p className="truncate text-[11px] text-bread-500">
                      {LIBELLE_TYPE_CLIENT[c.type]} · {c.telephone ?? 'sans téléphone'} · solde {FCFA(Math.max(0, st.solde))}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[14px] font-black text-emerald-700">{FCFA(st.totalVentes)}</p>
                    <p className="text-[10px] font-semibold uppercase text-bread-400">total achats</p>
                    <p className="text-[10px] font-semibold text-bread-500">payé {FCFA(st.totalPaye)}</p>
                  </div>
                </button>
              </Carte>
              )
            })}
          </div>
        )}
      </div>

      {/* ---------------- B. CRÉDIT ---------------- */}
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <HandCoins size={17} className="text-gold-600" />
          <h2 className="text-[15px] font-black text-ink">Crédit</h2>
          <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-bold text-gold-800">{clientsCredit.length}</span>
        </div>
        <p className="mb-3 text-[12px] text-bread-500">
          Clients qui achètent à crédit — total dû : <strong className="text-red-600">{FCFA(totalDu)}</strong>
        </p>

        {clientsCredit.length === 0 ? (
          <Carte><Vide texte="Aucun client n'a de dette en cours." icone={<HandCoins size={24} />} /></Carte>
        ) : (
          <div className="space-y-2.5">
            {clientsCredit.map((c) => {
              const st = statsDe(c)
              return (
                <Carte key={c.id} className="overflow-hidden">
                  <div className="flex w-full items-center gap-3 px-4 py-3.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-100 text-[13px] font-black text-gold-800">
                      {c.nom.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-ink">{c.nom}</p>
                      <p className="truncate text-[11px] text-bread-500">
                        {LIBELLE_TYPE_CLIENT[c.type]} · {c.telephone ?? 'sans téléphone'}
                      </p>
                      <p className="truncate text-[11px] font-semibold text-bread-600">
                        Total achats {FCFA(st.totalVentes)} · payé {FCFA(st.totalPaye)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[16px] font-black text-red-600">{FCFA(c.solde_du)}</p>
                      <p className="text-[10px] font-semibold uppercase text-bread-400">reste à payer</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-bread-100 border-t border-bread-100 bg-bread-50/60 text-center">
                    <div className="px-2 py-2">
                      <p className="text-[10px] font-bold uppercase text-bread-400">Crédit total</p>
                      <p className="text-[13px] font-black text-ink">{FCFA(st.totalCredit)}</p>
                    </div>
                    <div className="px-2 py-2">
                      <p className="text-[10px] font-bold uppercase text-bread-400">Remboursé</p>
                      <p className="text-[13px] font-black text-emerald-700">{FCFA(st.totalRemb)}</p>
                    </div>
                    <div className="px-2 py-2">
                      <p className="text-[10px] font-bold uppercase text-bread-400">Reste</p>
                      <p className="text-[13px] font-black text-red-600">{FCFA(c.solde_du)}</p>
                    </div>
                  </div>
                  <div className="border-t border-bread-100 px-4 py-2.5">
                    <Bouton variante="secondaire" taille="sm" className="w-full" onClick={() => setClientActif(c)}>
                      <Check size={15} /> Voir la fiche & rembourser
                    </Bouton>
                  </div>
                </Carte>
              )
            })}
          </div>
        )}
      </div>

      {clientActif && (
        <FicheClient
          client={data.clients.find((c) => c.id === clientActif.id) ?? clientActif}
          onFermer={() => setClientActif(null)}
          onRembourse={async () => { await rafraichir() }}
          profilId={profil!.id}
        />
      )}

      <NouveauClientModale
        ouvert={nouveau}
        type="revendeur"
        onFermer={() => setNouveau(false)}
        onCree={async (c) => { patchData((d) => ({ ...d, clients: [...d.clients, c] })); setNouveau(false) }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
function FicheClient({
  client, onFermer, onRembourse,
}: { client: Client; onFermer: () => void; onRembourse: () => Promise<void>; profilId: string }) {
  const { data, profil } = useStore()
  const [montant, setMontant] = useState('')
  const [date, setDate] = useState(aujourdhui())
  const [note, setNote] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  // Crédit = ventes à crédit + ventes partielles (le reste à payer est une dette)
  const ventesCredit = data.ventes
    .filter((v) => v.client_id === client.id && v.mode_paiement !== 'comptant')
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const ventesComptant = data.ventes
    .filter((v) => v.client_id === client.id && v.mode_paiement === 'comptant')
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const rembs = data.remboursements
    .filter((r) => r.client_id === client.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  const totalComptant = ventesComptant.reduce((s, v) => s + v.total, 0)
  const totalCredit = ventesCredit.reduce((s, v) => s + detteVente(v), 0)
  const totalRembourse = rembs.reduce((s, r) => s + r.montant, 0)

  // Données du relevé imprimable : toutes les ventes + totaux
  const toutesVentes = [...ventesComptant, ...ventesCredit]
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
  const totalVendu = toutesVentes.reduce((s, v) => s + v.total, 0)
  const totalPaye = toutesVentes.reduce((s, v) => s + (v.montant_paye ?? 0), 0) + totalRembourse

  const resumeLignes = (lignes: { quantite: number; produit_nom: string }[]) => {
    const txt = lignes.slice(0, 3).map((l) => `${l.quantite}× ${l.produit_nom}`).join(', ')
    return lignes.length > 3 ? `${txt} +${lignes.length - 3}` : txt
  }

  const rembourser = async () => {
    setErreur(null); setOk(null)
    const m = Number(montant)
    if (!m || m <= 0) return setErreur('Saisissez un montant valide.')
    if (m > client.solde_du) return setErreur(`Le solde dû est de ${FCFA(client.solde_du)}.`)
    setEnCours(true)
    try {
      await api.creerRemboursement(
        { client_id: client.id, montant: m, date, note: note || null }, profil!,
      )
      await onRembourse()
      setOk(`Paiement de ${FCFA(m)} enregistré.`)
      setMontant(''); setNote('')
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modale ouvert onFermer={onFermer} titre="Fiche client"
      pied={<Bouton variante="secondaire" className="w-full" onClick={() => window.print()}><Printer size={16} /> Imprimer le relevé</Bouton>}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-bread-900 p-4 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wide text-bread-300">Solde dû</p>
          <p className="mt-0.5 text-3xl font-black">{FCFA(client.solde_du)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Etiquette ton="ambre">{LIBELLE_TYPE_CLIENT[client.type]}</Etiquette>
            <span className="text-[12px] text-bread-100">{client.nom}</span>
            {client.telephone && <span className="text-[12px] text-bread-300">· {client.telephone}</span>}
          </div>
        </div>

        {/* Résumé des achats */}
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <div className="rounded-xl bg-bread-50 px-2 py-2.5">
            <p className="text-[10px] font-bold uppercase text-bread-400">Total achats</p>
            <p className="text-[14px] font-black text-ink">{FCFA(totalComptant + totalCredit)}</p>
            <p className="text-[10px] text-bread-400">{ventesComptant.length + ventesCredit.length} vente{ventesComptant.length + ventesCredit.length > 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-xl bg-bread-50 px-2 py-2.5">
            <p className="text-[10px] font-bold uppercase text-bread-400">Payé / remboursé</p>
            <p className="text-[14px] font-black text-emerald-700">{FCFA(totalComptant + totalRembourse)}</p>
          </div>
          <div className="rounded-xl bg-bread-50 px-2 py-2.5">
            <p className="text-[10px] font-bold uppercase text-bread-400">Crédit accordé</p>
            <p className="text-[14px] font-black text-gold-800">{FCFA(totalCredit)}</p>
            <p className="text-[10px] text-bread-400">{ventesCredit.length} vente{ventesCredit.length > 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-xl bg-bread-50 px-2 py-2.5">
            <p className="text-[10px] font-bold uppercase text-bread-400">Remboursé</p>
            <p className="text-[14px] font-black text-ink">{FCFA(totalRembourse)}</p>
            <p className="text-[10px] text-bread-400">{rembs.length} fois</p>
          </div>
        </div>

        {ok && <Alerte ton="succes">{ok}</Alerte>}

        {client.solde_du > 0 ? (
          <div className="rounded-2xl border-2 border-gold-200 bg-gold-50/60 p-4">
            <p className="mb-2.5 text-[13px] font-black text-ink">Encaisser un paiement</p>
            {erreur && <div className="mb-2"><Alerte>{erreur}</Alerte></div>}
            <div className="space-y-2.5">
              <Champ label="Montant reçu (FCFA)">
                <Input
                  type="number" inputMode="numeric" value={montant}
                  onChange={(e) => setMontant(e.target.value)} placeholder="0"
                />
              </Champ>
              <div className="grid grid-cols-2 gap-2">
                <Bouton variante="secondaire" taille="sm" onClick={() => setMontant(String(client.solde_du))}>
                  Tout ({FCFA(client.solde_du)})
                </Bouton>
                <Bouton variante="secondaire" taille="sm" onClick={() => setMontant(String(Math.round(client.solde_du / 2)))}>
                  Moitié
                </Bouton>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Champ label="Date">
                  <Input type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} />
                </Champ>
                <Champ label="Note">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" />
                </Champ>
              </div>
              <Bouton className="w-full" onClick={rembourser} disabled={enCours}>
                {enCours ? 'Enregistrement…' : <><Check size={18} /> Valider le paiement</>}
              </Bouton>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-800">
            <Check size={18} className="mr-1 inline" /> Ce client n'a pas de dette en cours.
          </div>
        )}

        <div>
          <p className="mb-2 text-[13px] font-black text-ink">Achats au comptant ({ventesComptant.length})</p>
          {ventesComptant.length === 0 ? (
            <p className="rounded-xl bg-bread-50 px-3 py-3 text-[12px] text-bread-500">Aucun achat au comptant.</p>
          ) : (
            <ul className="max-h-44 divide-y divide-bread-100 overflow-y-auto rounded-xl border border-bread-200">
              {ventesComptant.slice(0, 10).map((v) => (
                <li key={v.id} className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="text-[12px] font-bold text-ink">{formatDateFR(v.date)}</p>
                      <Etiquette ton="vert">{LIBELLE_PAIEMENT[v.mode_paiement]}</Etiquette>
                    </div>
                    <span className="text-[13px] font-black text-emerald-700">{FCFA(v.total)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-bread-500" title={v.lignes.map((l) => `${l.quantite}× ${l.produit_nom}`).join(', ')}>
                    {v.lignes.length} article{v.lignes.length > 1 ? 's' : ''} — {resumeLignes(v.lignes)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-[13px] font-black text-ink">Crédits & paiements partiels ({ventesCredit.length})</p>
          {ventesCredit.length === 0 ? (
            <p className="rounded-xl bg-bread-50 px-3 py-3 text-[12px] text-bread-500">Aucune vente à crédit ou partielle.</p>
          ) : (
            <ul className="max-h-44 divide-y divide-bread-100 overflow-y-auto rounded-xl border border-bread-200">
              {ventesCredit.slice(0, 10).map((v) => (
                <li key={v.id} className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="text-[12px] font-bold text-ink">{formatDateFR(v.date)}</p>
                      <Etiquette ton="rouge">{LIBELLE_PAIEMENT[v.mode_paiement]}</Etiquette>
                    </div>
                    <span className="text-[13px] font-black text-red-600">+{FCFA(detteVente(v))}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-bread-500" title={v.lignes.map((l) => `${l.quantite}× ${l.produit_nom}`).join(', ')}>
                    {v.lignes.length} article{v.lignes.length > 1 ? 's' : ''} — {resumeLignes(v.lignes)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-[13px] font-black text-ink">Paiements reçus ({rembs.length})</p>
          {rembs.length === 0 ? (
            <p className="rounded-xl bg-bread-50 px-3 py-3 text-[12px] text-bread-500">Aucun remboursement enregistré.</p>
          ) : (
            <ul className="max-h-44 divide-y divide-bread-100 overflow-y-auto rounded-xl border border-bread-200">
              {rembs.slice(0, 10).map((r) => (
                <li key={r.id} className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-[12px] font-bold text-ink">{formatDateFR(r.date)}</p>
                    <p className="text-[11px] text-bread-500">{r.user_email}{r.note ? ` · ${r.note}` : ''}</p>
                  </div>
                  <span className="text-[13px] font-black text-emerald-700">−{FCFA(r.montant)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Relevé imprimable (visible uniquement à l'impression) */}
      <div className="zone-impression hidden">
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <p style={{ fontSize: 17, fontWeight: 800 }}>GestiPain — Relevé client</p>
          <p style={{ fontWeight: 700 }}>{client.nom}{client.telephone ? ` · ${client.telephone}` : ''} · {LIBELLE_TYPE_CLIENT[client.type]}</p>
          <p>Édité le {formatDateFR(aujourdhui())}</p>
        </div>
        <table>
          <thead>
            <tr><th>Date</th><th>Mode</th><th>Produits</th><th>Total</th><th>Payé</th><th>Reste</th></tr>
          </thead>
          <tbody>
            {toutesVentes.map((v) => (
              <tr key={v.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDateFR(v.date)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{LIBELLE_PAIEMENT[v.mode_paiement]}</td>
                <td>{v.lignes.map((l) => `${l.quantite}× ${l.produit_nom}`).join(', ') || '—'}</td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{FCFA(v.total)}</td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{FCFA(v.montant_paye ?? 0)}</td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{v.mode_paiement === 'comptant' ? '—' : FCFA(detteVente(v))}</td>
              </tr>
            ))}
            {rembs.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDateFR(r.date)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>Paiement</td>
                <td>Paiement reçu{r.note ? ` — ${r.note}` : ''}</td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>−{FCFA(r.montant)}</td>
                <td /><td />
              </tr>
            ))}
          </tbody>
        </table>
        <table style={{ marginTop: 14 }}>
          <tbody>
            <tr className="total-row"><td>Total vendu</td><td style={{ textAlign: 'right' }}>{FCFA(totalVendu)}</td></tr>
            <tr><td>Total payé</td><td style={{ textAlign: 'right' }}>{FCFA(totalPaye)}</td></tr>
            <tr className="total-row"><td>Solde dû</td><td style={{ textAlign: 'right' }}>{FCFA(client.solde_du)}</td></tr>
          </tbody>
        </table>
      </div>
    </Modale>
  )
}
