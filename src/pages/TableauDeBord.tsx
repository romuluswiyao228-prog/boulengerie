// ============================================================================
// TableauDeBord.tsx — Bilan du jour / semaine / mois (propriétaire)
// ----------------------------------------------------------------------------
// Formule du bénéfice (identique à src/lib/utils.ts → calculerBilan) :
//   BÉNÉFICE = VENTES − COÛT DE PRODUCTION DES PRODUITS VENDUS − DÉPENSES − PERTES
// ----------------------------------------------------------------------------
import { useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  Banknote, ChartColumn, ChartPie, ChefHat, HandCoins, PackageSearch, ReceiptText,
  Trash, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { LIBELLE_PAIEMENT, LIBELLE_TYPE_CLIENT, type ModePaiement } from '../lib/types'
import {
  addDays, aujourdhui, calculerBilan, debutMois, debutSemaine, FCFA, FCFAcourt,
  finMois, formatDateFR, formatDateLongueFR, formatHeure, formatJourCourt,
  libelleMois, moisPrecedent, plageDates,
} from '../lib/utils'
import { Carte, Etiquette, TitrePage, Vide, cn } from '../components/ui'

type Periode = 'jour' | 'semaine' | 'mois'
type Icone = ComponentType<{ className?: string; size?: number | string; strokeWidth?: number | string }>

export default function TableauDeBord() {
  const { data } = useStore()
  const [periode, setPeriode] = useState<Periode>('jour')
  const [date, setDate] = useState(aujourdhui())

  const bornes = useMemo(() => {
    if (periode === 'jour') return { debut: date, fin: date }
    if (periode === 'semaine') {
      const d = debutSemaine(date)
      return { debut: d, fin: addDays(d, 6) }
    }
    return { debut: debutMois(date), fin: finMois(date) }
  }, [periode, date])

  const bilan = useMemo(() => calculerBilan(data, bornes.debut, bornes.fin), [data, bornes])

  const parProduit = useMemo(() => {
    const map = new Map<string, { nom: string; montant: number; quantite: number }>()
    for (const v of data.ventes.filter((x) => x.date >= bornes.debut && x.date <= bornes.fin)) {
      for (const l of v.lignes) {
        const cur = map.get(l.produit_id) ?? { nom: l.produit_nom, montant: 0, quantite: 0 }
        cur.montant += l.quantite * l.prix_unitaire
        cur.quantite += l.quantite
        map.set(l.produit_id, cur)
      }
    }
    return [...map.values()].sort((a, b) => b.montant - a.montant)
  }, [data.ventes, bornes])

  const evolution7j = useMemo(() => {
    const finBrute = periode === 'jour' ? date : bornes.fin
    const fin = finBrute > aujourdhui() ? aujourdhui() : finBrute
    const debut = addDays(fin, -6)
    return plageDates(debut, fin).map((d) => {
      const b = calculerBilan(data, d, d)
      return { jour: formatJourCourt(d), ventes: b.totalVentes, benefice: b.benefice, depenses: b.depenses, pertes: b.pertes }
    })
  }, [data, periode, date, bornes.fin])

  const comparaisonMois = useMemo(() => {
    if (periode !== 'mois') return null
    const prec = moisPrecedent(date)
    const jourDuMois = new Date(date + 'T00:00:00').getDate()
    const finPrec = addDays(debutMois(prec), jourDuMois - 1)
    const bPrec = calculerBilan(data, debutMois(prec), finPrec)
    const variation = bPrec.totalVentes > 0 ? ((bilan.totalVentes - bPrec.totalVentes) / bPrec.totalVentes) * 100 : null
    const varBenef = bPrec.benefice !== 0 ? ((bilan.benefice - bPrec.benefice) / Math.abs(bPrec.benefice)) * 100 : null
    return { libelle: libelleMois(prec), bPrec, variation, varBenef, fructueux: bilan.benefice > 0 && bilan.benefice >= bPrec.benefice }
  }, [periode, data, date, bilan])

  const repartitionType = useMemo(() => {
    const ventesPeriode = data.ventes.filter((v) => v.date >= bornes.debut && v.date <= bornes.fin)
    const map: Record<'detail' | 'revendeur', number> = { detail: 0, revendeur: 0 }
    for (const v of ventesPeriode) map[v.type_client] += v.total
    return [
      { nom: LIBELLE_TYPE_CLIENT.detail, valeur: map.detail, couleur: '#a86614' },
      { nom: LIBELLE_TYPE_CLIENT.revendeur, valeur: map.revendeur, couleur: '#5e442f' },
    ].filter((x) => x.valeur > 0)
  }, [data.ventes, bornes])

  const repartitionPaiement = useMemo(() => {
    const ventesPeriode = data.ventes.filter((v) => v.date >= bornes.debut && v.date <= bornes.fin)
    const map: Record<ModePaiement, number> = { comptant: 0, credit: 0, partiel: 0 }
    for (const v of ventesPeriode) map[v.mode_paiement] += v.total
    return [
      { nom: 'Comptant', valeur: map.comptant, couleur: '#15803d' },
      { nom: 'Crédit', valeur: map.credit, couleur: '#c67f1d' },
      { nom: 'Partiel', valeur: map.partiel, couleur: '#0284c7' },
    ].filter((x) => x.valeur > 0)
  }, [data.ventes, bornes])

  const creditsClients = useMemo(() => {
    const endettes = data.clients.filter((c) => c.solde_du > 0)
    return {
      nombre: endettes.length,
      total: endettes.reduce((s, c) => s + c.solde_du, 0),
    }
  }, [data.clients])

  const productionPeriode = useMemo(() => {
    return data.productions
      .filter((p) => p.date >= bornes.debut && p.date <= bornes.fin)
      .reduce((acc, p) => {
        const produit = data.produits.find((x) => x.id === p.produit_id)
        acc.quantite += p.quantite
        acc.cout += p.quantite * (produit?.cout_production ?? 0)
        return acc
      }, { quantite: 0, cout: 0 })
  }, [data.productions, data.produits, bornes])

  const dernieresVentes = useMemo(
    () => [...data.ventes].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6),
    [data.ventes],
  )

  const meilleursProduits = parProduit.slice(0, 5)
  const evolutionVide = evolution7j.every((x) => x.ventes === 0)
  const transactionsVides = dernieresVentes.length === 0

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <TitrePage titre="Tableau de bord" sousTitre="Pilotage des ventes, stocks et trésorerie" />

      {/* Sélecteur de période */}
      <Carte className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-xl bg-bread-100 p-1">
            {([['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois']] as const).map(([p, l]) => (
              <button
                key={p}
                onClick={() => setPeriode(p)}
                className={cn(
                  'flex-1 rounded-lg px-4 py-2 text-[13px] font-bold transition-all sm:flex-none',
                  periode === p ? 'bg-bread-800 text-cream shadow-sm' : 'text-bread-600 hover:text-bread-900',
                )}
              >{l}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              max={aujourdhui()}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 flex-1 rounded-xl border border-bread-200 bg-white px-3 text-[13px] font-semibold text-bread-800 outline-none transition-all focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15 sm:flex-none"
            />
            {date !== aujourdhui() && (
              <button onClick={() => setDate(aujourdhui())} className="rounded-xl bg-gold-100 px-3 py-2 text-[12px] font-bold text-gold-900 transition-colors hover:bg-gold-200">
                Aujourd'hui
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 px-1 text-[12px] font-medium text-bread-500">
          {periode === 'jour'
            ? formatDateLongueFR(bornes.debut)
            : `Du ${formatJourCourt(bornes.debut)} au ${formatJourCourt(bornes.fin)} — ${periode === 'mois' ? libelleMois(date) : 'semaine en cours'}`}
        </p>
      </Carte>

      {/* KPI principaux */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Chiffre d'affaires" valeur={FCFA(bilan.totalVentes)} icone={Banknote}
          teinte="chocolat" to="/historique" sous="Ventes comptant et crédit"
        />
        <KpiCard
          label="Nombre de ventes" valeur={String(bilan.nbVentes)} icone={ReceiptText}
          teinte="or" to="/historique" sous="Opérations sur la période"
        />
        <KpiCard
          label="Bénéfice" valeur={FCFA(bilan.benefice)}
          icone={bilan.benefice >= 0 ? TrendingUp : TrendingDown}
          teinte={bilan.benefice >= 0 ? 'vert' : 'rouge'} to="/historique"
          sous={`Marge ${bilan.marge.toFixed(1)} %`}
        />
        <KpiCard
          label="Dépenses" valeur={FCFA(bilan.depenses)} icone={Wallet}
          teinte="sauge" to="/depenses" sous="Charges de la période"
        />
      </div>

      {/* Indicateurs opérationnels */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicateur
          label="Encaissé" valeur={FCFA(bilan.encaisse)} icone={Banknote} to="/historique"
          details={`${FCFA(bilan.remboursementsRecus)} remboursés · crédit ${FCFA(bilan.creditAccorde)}`}
        />
        <Indicateur
          label="Crédits clients" valeur={FCFA(creditsClients.total)} icone={HandCoins} to="/credits"
          details={`${creditsClients.nombre} client${creditsClients.nombre > 1 ? 's' : ''} débiteur${creditsClients.nombre > 1 ? 's' : ''}`}
          alerte={creditsClients.total > 0}
        />
        <Indicateur
          label="Production" valeur={`${productionPeriode.quantite} unités`} icone={ChefHat} to="/production"
          details={`Coût estimé ${FCFA(productionPeriode.cout)}`}
        />
        <Indicateur
          label="Pertes" valeur={FCFA(bilan.pertes)} icone={Trash} to="/invendus"
          details="Invendus valorisés sur la période"
          alerte={bilan.pertes > 0}
        />
      </div>

      {/* Formule + comparaison mensuelle */}
      <Carte className="border-gold-200 bg-gold-50/70 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gold-800">Formule du bénéfice</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] leading-relaxed text-bread-700">
          <span className="font-semibold">Bénéfice =</span>
          <span>Ventes <strong>{FCFA(bilan.totalVentes)}</strong></span>
          <span className="text-bread-400">−</span>
          <span>Coût production <strong>{FCFA(bilan.coutProduction)}</strong></span>
          <span className="text-bread-400">−</span>
          <span>Dépenses <strong>{FCFA(bilan.depenses)}</strong></span>
          <span className="text-bread-400">−</span>
          <span>Pertes <strong>{FCFA(bilan.pertes)}</strong></span>
          <span className="text-bread-400">=</span>
          <strong className={cn('text-[14px]', bilan.benefice >= 0 ? 'text-emerald-700' : 'text-red-600')}>
            {FCFA(bilan.benefice)}
          </strong>
        </div>
      </Carte>

      {periode === 'mois' && comparaisonMois && (
        <Carte className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-black text-ink">{libelleMois(date)}</p>
              <p className="text-[11px] text-bread-500">Comparaison avec {comparaisonMois.libelle} (même nombre de jours)</p>
            </div>
            <Etiquette ton={comparaisonMois.fructueux ? 'vert' : 'rouge'}>
              {comparaisonMois.fructueux ? 'Mois fructueux' : 'Mois moins fructueux'}
            </Etiquette>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Compare label="Ventes" actuel={bilan.totalVentes} precedent={comparaisonMois.bPrec.totalVentes} />
            <Compare label="Bénéfice" actuel={bilan.benefice} precedent={comparaisonMois.bPrec.benefice} />
            <Compare label="Dépenses" actuel={bilan.depenses} precedent={comparaisonMois.bPrec.depenses} inverse />
            <Compare label="Pertes" actuel={bilan.pertes} precedent={comparaisonMois.bPrec.pertes} inverse />
          </div>
        </Carte>
      )}

      {/* Évolution des ventes */}
      <Carte className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-black text-ink">Évolution des ventes</h2>
            <p className="text-[12px] text-bread-500">7 derniers jours glissants</p>
          </div>
          <Etiquette ton="ambre">{periode === 'jour' ? 'Aujourd’hui' : 'Période sélectionnée'}</Etiquette>
        </div>
        {evolutionVide ? (
          <Vide texte="Aucune vente enregistrée sur les 7 derniers jours." icone={<ChartColumn size={26} />} />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolution7j} margin={{ left: -18, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gVentes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d99a35" stopOpacity={0.38} />
                    <stop offset="100%" stopColor="#d99a35" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#eadcc7" />
                <XAxis dataKey="jour" tick={{ fontSize: 11, fill: '#8f7a63' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={FCFAcourt} tick={{ fontSize: 11, fill: '#8f7a63' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => [FCFA(Number(v)), 'Ventes']} contentStyle={styleTooltip} />
                <Area type="monotone" dataKey="ventes" stroke="#a86614" strokeWidth={3} fill="url(#gVentes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Carte>

      {/* Répartition + produits + transactions */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Carte className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-black text-ink">Ventes par type de client</h2>
              <p className="text-[11px] text-bread-500">Répartition sur la période</p>
            </div>
            <ChartPie size={18} className="text-gold-600" />
          </div>
          {repartitionType.length === 0 ? (
            <Vide texte="Aucune vente sur la période." icone={<ChartPie size={24} />} />
          ) : (
            <>
              <div className="relative h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={repartitionType} dataKey="valeur" nameKey="nom" innerRadius={54} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                      {repartitionType.map((r, i) => <Cell key={i} fill={r.couleur} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => FCFA(Number(v))} contentStyle={styleTooltip} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-bread-400">Total</p>
                    <p className="text-lg font-black text-ink">{FCFAcourt(bilan.totalVentes)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {repartitionType.map((r) => (
                  <div key={r.nom} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2 font-semibold text-bread-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.couleur }} />
                      {r.nom}
                    </span>
                    <span className="font-bold text-ink">
                      {FCFA(r.valeur)}
                      <span className="ml-1 text-[11px] font-medium text-bread-400">
                        ({bilan.totalVentes > 0 ? Math.round((r.valeur / bilan.totalVentes) * 100) : 0} %)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Carte>

        <Carte className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-black text-ink">Produits les plus vendus</h2>
              <p className="text-[11px] text-bread-500">Classement par montant</p>
            </div>
            <PackageSearch size={18} className="text-gold-600" />
          </div>
          {meilleursProduits.length === 0 ? (
            <Vide texte="Aucun produit vendu sur la période." icone={<PackageSearch size={24} />} />
          ) : (
            <ul className="space-y-3">
              {meilleursProduits.map((p, i) => {
                const max = meilleursProduits[0].montant || 1
                return (
                  <li key={p.nom}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                      <span className="flex min-w-0 items-center gap-2 font-semibold text-bread-800">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-bread-800 text-[10px] font-black text-cream">{i + 1}</span>
                        <span className="truncate">{p.nom}</span>
                      </span>
                      <span className="shrink-0 font-black text-ink">{FCFA(p.montant)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bread-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-700" style={{ width: `${(p.montant / max) * 100}%` }} />
                    </div>
                    <p className="mt-0.5 text-[10px] font-medium text-bread-400">{p.quantite} unités vendues</p>
                  </li>
                )
              })}
            </ul>
          )}
        </Carte>

        <Carte className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-black text-ink">Paiements</h2>
              <p className="text-[11px] text-bread-500">Comptant vs crédit</p>
            </div>
            <Wallet size={18} className="text-gold-600" />
          </div>
          {repartitionPaiement.length === 0 ? (
            <Vide texte="Aucune vente sur la période." icone={<Wallet size={24} />} />
          ) : (
            <div className="space-y-3">
              {repartitionPaiement.map((r) => (
                <div key={r.nom} className="rounded-2xl border border-bread-100 bg-bread-50/70 p-3">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-bold text-bread-700">{r.nom}</span>
                    <span className="font-black text-ink">{FCFA(r.valeur)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-bread-200">
                    <div className="h-full rounded-full" style={{ width: `${(r.valeur / (repartitionPaiement[0].valeur || 1)) * 100}%`, background: r.couleur }} />
                  </div>
                  <p className="mt-1.5 text-[10px] font-semibold text-bread-400">
                    {bilan.totalVentes > 0 ? Math.round((r.valeur / bilan.totalVentes) * 100) : 0} % des ventes
                  </p>
                </div>
              ))}
            </div>
          )}
        </Carte>
      </div>

      {/* Dernières transactions */}
      <Carte className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-bread-100 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-[15px] font-black text-ink">Dernières transactions</h2>
            <p className="text-[11px] text-bread-500">Ventes les plus récentes</p>
          </div>
          <Link to="/historique" className="rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-gold-800 transition-colors hover:bg-gold-50">
            Voir tout
          </Link>
        </div>
        {transactionsVides ? (
          <Vide texte="Aucune transaction enregistrée pour le moment." icone={<ReceiptText size={24} />} />
        ) : (
          <ul className="divide-y divide-bread-100">
            {dernieresVentes.map((v) => (
              <li key={v.id}>
                <Link to="/historique" className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gold-50/60 sm:px-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bread-100 text-bread-700">
                    <ReceiptText size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[13px] font-bold text-ink">{v.client_nom ?? 'Client de passage'}</p>
                      <Etiquette ton={v.mode_paiement === 'comptant' ? 'vert' : 'ambre'}>{LIBELLE_PAIEMENT[v.mode_paiement]}</Etiquette>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-bread-500">
                      {formatDateFR(v.date)} · {formatHeure(v.created_at)} · {v.lignes.length} article{v.lignes.length > 1 ? 's' : ''} · {v.user_email}
                    </p>
                  </div>
                  <span className="shrink-0 text-[14px] font-black text-ink">{FCFA(v.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      {/* Crédits ouverts du jour */}
      <Carte className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-bread-100 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-[15px] font-black text-ink">Crédits ouverts</h2>
            <p className="text-[11px] text-bread-500">Ventes à crédit à suivre</p>
          </div>
          <Link to="/credits" className="rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-gold-800 transition-colors hover:bg-gold-50">
            Clients & crédits
          </Link>
        </div>
        {data.ventes.filter((v) => v.mode_paiement === 'credit').length === 0 ? (
          <Vide texte="Aucun crédit accordé pour le moment." icone={<HandCoins size={24} />} />
        ) : (
          <ul className="divide-y divide-bread-100">
            {data.ventes
              .filter((v) => v.mode_paiement === 'credit')
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 5)
              .map((v) => (
                <li key={v.id}>
                  <Link to="/credits" className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-gold-50/60 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-ink">{v.client_nom ?? '—'}</p>
                      <p className="truncate text-[11px] text-bread-500">
                        {formatDateFR(v.date)} · {v.lignes.map((l) => `${l.quantite}× ${l.produit_nom}`).join(', ')}
                      </p>
                    </div>
                    <span className="shrink-0 text-[14px] font-black text-gold-800">{FCFA(v.total)}</span>
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </Carte>

      <p className="pt-1 text-center text-[11px] font-medium text-bread-400">
        {bilan.nbVentes} vente{bilan.nbVentes > 1 ? 's' : ''} sur la période · comptant {FCFA(bilan.ventesComptant)} · crédit {FCFA(bilan.creditAccorde)}
      </p>
    </div>
  )
}

const styleTooltip = {
  borderRadius: 14,
  border: '1px solid #e7dac2',
  background: '#fffdf8',
  fontSize: 12,
  color: '#342b23',
}

function KpiCard({
  label, valeur, icone: Icone, sous, teinte, to,
}: {
  label: string
  valeur: string
  icone: Icone
  sous?: string
  teinte: 'chocolat' | 'or' | 'vert' | 'rouge' | 'sauge'
  to: string
}) {
  const teintes = {
    chocolat: 'bg-bread-800 text-cream',
    or: 'bg-gold-100 text-gold-800',
    vert: 'bg-emerald-100 text-emerald-800',
    rouge: 'bg-red-100 text-red-700',
    sauge: 'bg-[#e8f1ec] text-[#356859]',
  }
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-bread-200/80 bg-ivory p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-pop"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-bread-500">{label}</p>
          <p className="mt-2 truncate text-[22px] font-black tracking-tight text-ink sm:text-2xl">{valeur}</p>
          {sous && <p className="mt-1 truncate text-[11px] font-medium text-bread-400">{sous}</p>}
        </div>
        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-transform group-hover:scale-105', teintes[teinte])}>
          <Icone size={20} strokeWidth={2.2} />
        </span>
      </div>
    </Link>
  )
}

function Indicateur({
  label, valeur, details, icone: Icone, to, alerte,
}: {
  label: string
  valeur: string
  details: string
  icone: Icone
  to: string
  alerte?: boolean
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group rounded-2xl border bg-ivory p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-pop',
        alerte ? 'border-gold-300' : 'border-bread-200/80',
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', alerte ? 'bg-gold-100 text-gold-800' : 'bg-bread-100 text-bread-700')}>
          <Icone size={18} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-bread-400">{label}</p>
          <p className="truncate text-[17px] font-black text-ink">{valeur}</p>
          <p className="truncate text-[11px] font-medium text-bread-500">{details}</p>
        </div>
      </div>
    </Link>
  )
}

function Compare({
  label, actuel, precedent, inverse,
}: { label: string; actuel: number; precedent: number; inverse?: boolean }) {
  const diff = precedent !== 0 ? ((actuel - precedent) / Math.abs(precedent)) * 100 : null
  const positif = inverse ? (diff ?? 0) <= 0 : (diff ?? 0) >= 0
  return (
    <div className="rounded-xl bg-bread-50 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-bread-500">{label}</p>
      <p className="mt-0.5 text-[13px] font-black text-ink">{FCFA(actuel)}</p>
      <p className="text-[10px] text-bread-400">vs {FCFA(precedent)}</p>
      {diff !== null && (
        <p className={cn('mt-0.5 text-[11px] font-bold',
          Math.abs(diff) < 0.5 ? 'text-bread-400' : positif ? 'text-emerald-600' : 'text-red-500')}>
          {Math.abs(diff) < 0.5 ? '=' : diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(0)} %
        </p>
      )}
    </div>
  )
}
