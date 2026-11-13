// ============================================================================
// Credits.tsx — Clients, soldes dus et remboursements (partiels ou totaux)
// ============================================================================
import { useMemo, useState } from 'react'
import { Check, Plus, UserRound } from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import type { Client } from '../lib/types'
import { LIBELLE_TYPE_CLIENT } from '../lib/types'
import { aujourdhui, FCFA, formatDateFR } from '../lib/utils'
import {
  Alerte, Bouton, Carte, Champ, Etiquette, Input, Modale, Select, TitrePage, Vide, ZoneTexte, cn,
} from '../components/ui'
import { NouveauClientModale } from './Ventes'

export default function Credits() {
  const { data, profil, rafraichir } = useStore()
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<'tous' | 'dette' | 'detail' | 'revendeur'>('tous')
  const [clientActif, setClientActif] = useState<Client | null>(null)
  const [nouveau, setNouveau] = useState(false)

  const clients = useMemo(() => {
    return data.clients
      .filter((c) => (filtre === 'dette' ? c.solde_du > 0 : filtre === 'tous' ? true : c.type === filtre))
      .filter((c) =>
        (!recherche ||
          c.nom.toLowerCase().includes(recherche.toLowerCase()) ||
          (c.telephone ?? '').includes(recherche)),
      )
      .sort((a, b) => b.solde_du - a.solde_du || a.nom.localeCompare(b.nom))
  }, [data.clients, filtre, recherche])

  const totalDu = data.clients.reduce((s, c) => s + c.solde_du, 0)
  const nbEndettes = data.clients.filter((c) => c.solde_du > 0).length

  return (
    <div className="mx-auto max-w-4xl">
      <TitrePage
        titre="Clients & crédits"
        sousTitre="Soldes dus et remboursements"
        action={<Bouton taille="md" onClick={() => setNouveau(true)}><Plus size={18} /> Client</Bouton>}
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5">
        <Carte className="bg-stone-900 border-stone-900 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Total des dettes</p>
          <p className="mt-0.5 text-xl font-black text-white">{FCFA(totalDu)}</p>
        </Carte>
        <Carte className="px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Clients à crédit</p>
          <p className="mt-0.5 text-xl font-black text-stone-900">{nbEndettes}</p>
        </Carte>
      </div>

      <div className="mb-4 space-y-2.5">
        <Input
          placeholder="Rechercher un client (nom ou téléphone)…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            ['tous', 'Tous'],
            ['dette', 'Avec dette'],
            ['revendeur', 'Revendeurs'],
            ['detail', 'Détail'],
          ] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFiltre(v)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors',
                filtre === v ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200',
              )}
            >{l}</button>
          ))}
        </div>
      </div>

      {clients.length === 0 ? (
        <Carte><Vide texte="Aucun client pour ce filtre." icone={<UserRound size={24} />} /></Carte>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <Carte key={c.id} className="overflow-hidden">
              <button
                onClick={() => setClientActif(c)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-stone-50"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-[13px] font-black text-amber-900">
                  {c.nom.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-stone-900">{c.nom}</p>
                  <p className="truncate text-[11px] text-stone-500">
                    {LIBELLE_TYPE_CLIENT[c.type]} · {c.telephone ?? 'sans téléphone'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn('text-[15px] font-black', c.solde_du > 0 ? 'text-red-600' : 'text-emerald-600')}>
                    {FCFA(c.solde_du)}
                  </p>
                  <p className="text-[10px] font-semibold uppercase text-stone-400">
                    {c.solde_du > 0 ? 'à payer' : 'à jour'}
                  </p>
                </div>
              </button>
            </Carte>
          ))}
        </div>
      )}

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
        onCree={async () => { await rafraichir(); setNouveau(false) }}
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

  const ventesCredit = data.ventes
    .filter((v) => v.client_id === client.id && v.mode_paiement === 'credit')
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const rembs = data.remboursements
    .filter((r) => r.client_id === client.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

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
      setOk(`Remboursement de ${FCFA(m)} enregistré.`)
      setMontant(''); setNote('')
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modale ouvert onFermer={onFermer} titre="Fiche client">
      <div className="space-y-4">
        <div className="rounded-2xl bg-stone-900 p-4 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Solde dû</p>
          <p className="mt-0.5 text-3xl font-black">{FCFA(client.solde_du)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Etiquette ton="ambre">{LIBELLE_TYPE_CLIENT[client.type]}</Etiquette>
            <span className="text-[12px] text-stone-300">{client.nom}</span>
            {client.telephone && <span className="text-[12px] text-stone-400">· {client.telephone}</span>}
          </div>
        </div>

        {ok && <Alerte ton="succes">{ok}</Alerte>}

        {client.solde_du > 0 ? (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-4">
            <p className="mb-2.5 text-[13px] font-black text-stone-900">Enregistrer un remboursement</p>
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
                {enCours ? 'Enregistrement…' : <><Check size={18} /> Valider le remboursement</>}
              </Bouton>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-800">
            <Check size={18} className="mr-1 inline" /> Ce client n'a plus de dette en cours.
          </div>
        )}

        <div>
          <p className="mb-2 text-[13px] font-black text-stone-900">Crédits accordés ({ventesCredit.length})</p>
          {ventesCredit.length === 0 ? (
            <p className="rounded-xl bg-stone-50 px-3 py-3 text-[12px] text-stone-500">Aucun crédit pour ce client.</p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
              {ventesCredit.slice(0, 8).map((v) => (
                <li key={v.id} className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-[12px] font-bold text-stone-800">{formatDateFR(v.date)}</p>
                    <p className="text-[11px] text-stone-500">{v.lignes.length} article{v.lignes.length > 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-[13px] font-black text-red-600">+{FCFA(v.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-[13px] font-black text-stone-900">Remboursements ({rembs.length})</p>
          {rembs.length === 0 ? (
            <p className="rounded-xl bg-stone-50 px-3 py-3 text-[12px] text-stone-500">Aucun remboursement enregistré.</p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
              {rembs.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-[12px] font-bold text-stone-800">{formatDateFR(r.date)}</p>
                    <p className="text-[11px] text-stone-500">{r.user_email}{r.note ? ` · ${r.note}` : ''}</p>
                  </div>
                  <span className="text-[13px] font-black text-emerald-600">−{FCFA(r.montant)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modale>
  )
}
