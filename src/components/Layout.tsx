// ============================================================================
// Layout.tsx — Coquille applicative GestiPain
// Sidebar desktop rétractable + topbar + navigation mobile.
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, ChefHat, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck,
  ClipboardList, Croissant, HandCoins, History, LayoutDashboard, LogOut,
  ReceiptText, Search, ShoppingCart, Sparkles, Trash, UserRound, Users, Wallet,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { MODE_DEMO } from '../lib/supabase'
import { FCFA, formatDateFR, formatHeure } from '../lib/utils'
import { cn } from './ui'

type Icone = ComponentType<{ className?: string; size?: number | string; strokeWidth?: number | string }>

export interface ItemNav {
  to: string
  label: string
  court: string
  icone: Icone
  sousTitre: string
  proprietaireSeulement?: boolean
}

export interface GroupeNav {
  titre: string
  items: ItemNav[]
}

export const NAV_GROUPS: GroupeNav[] = [
  {
    titre: 'Pilotage',
    items: [
      { to: '/', label: 'Tableau de bord', court: 'Bilan', icone: LayoutDashboard, sousTitre: "Vue d'ensemble de l'activité", proprietaireSeulement: true },
    ],
  },
  {
    titre: 'Ventes & caisse',
    items: [
      { to: '/ventes', label: 'Nouvelle vente', court: 'Vente', icone: ShoppingCart, sousTitre: 'Saisie rapide au comptoir' },
      { to: '/historique', label: 'Historique', court: 'Histo.', icone: History, sousTitre: 'Ventes et opérations passées' },
      { to: '/credits', label: 'Clients & crédits', court: 'Crédits', icone: HandCoins, sousTitre: 'Dettes et remboursements' },
      { to: '/commandes', label: 'Précommandes', court: 'Précmd', icone: ClipboardList, sousTitre: 'Préparation et livraisons' },
    ],
  },
  {
    titre: 'Catalogue & stocks',
    items: [
      { to: '/produits', label: 'Produits', court: 'Produits', icone: Croissant, sousTitre: 'Catalogue et prix' },
      { to: '/production', label: 'Production', court: 'Prod.', icone: ChefHat, sousTitre: 'Fabrication quotidienne', proprietaireSeulement: true },
      { to: '/invendus', label: 'Invendus & pertes', court: 'Pertes', icone: Trash, sousTitre: 'Pertes et fin de journée' },
    ],
  },
  {
    titre: 'Finances',
    items: [
      { to: '/depenses', label: 'Achats & dépenses', court: 'Dépens.', icone: Wallet, sousTitre: 'Charges et achats', proprietaireSeulement: true },
    ],
  },
  {
    titre: 'Réglages',
    items: [
      { to: '/utilisateurs', label: 'Utilisateurs', court: 'Équipe', icone: Users, sousTitre: 'Accès et rôles', proprietaireSeulement: true },
    ],
  },
]

export const NAV_ITEMS: ItemNav[] = NAV_GROUPS.flatMap((g) => g.items)

const MOBILE_PRIORITAIRES = ['/ventes', '/commandes', '/invendus', '/credits']
const CLE_SIDEBAR = 'gestipain.sidebar.reduit'

const normaliser = (texte: string) =>
  texte.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

interface ResultatRecherche {
  id: string
  titre: string
  details: string
  to: string
  icone: Icone
}

export default function Layout() {
  const { profil, data, deconnexion, estProprietaire } = useStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [plusOuvert, setPlusOuvert] = useState(false)
  const [reduit, setReduit] = useState(() => localStorage.getItem(CLE_SIDEBAR) === '1')
  const [recherche, setRecherche] = useState('')
  const [rechercheOuverte, setRechercheOuverte] = useState(false)
  const [notificationsOuvertes, setNotificationsOuvertes] = useState(false)
  const [profilOuvert, setProfilOuvert] = useState(false)

  useEffect(() => { setPlusOuvert(false) }, [location.pathname])
  useEffect(() => {
    setNotificationsOuvertes(false)
    setProfilOuvert(false)
    setRechercheOuverte(false)
  }, [location.pathname])
  useEffect(() => { localStorage.setItem(CLE_SIDEBAR, reduit ? '1' : '0') }, [reduit])

  const groupes = useMemo(
    () => NAV_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((i) => !i.proprietaireSeulement || estProprietaire) }))
      .filter((g) => g.items.length > 0),
    [estProprietaire],
  )
  const items = useMemo(() => groupes.flatMap((g) => g.items), [groupes])

  const courant = useMemo(() => {
    const exact = items.find((i) => i.to === location.pathname)
    if (exact) return exact
    return [...items]
      .filter((i) => i.to !== '/')
      .sort((a, b) => b.to.length - a.to.length)
      .find((i) => location.pathname.startsWith(i.to)) ?? items[0]
  }, [items, location.pathname])
  const groupeCourant = groupes.find((g) => g.items.some((i) => i.to === courant?.to))

  const resultatsRecherche = useMemo<ResultatRecherche[]>(() => {
    const q = normaliser(recherche.trim())
    if (q.length < 2) return []
    const correspond = (texte: string) => normaliser(texte).includes(q)
    const out: ResultatRecherche[] = []

    for (const p of data.produits.filter((x) => correspond(x.nom)).slice(0, 4)) {
      out.push({
        id: `p-${p.id}`, titre: p.nom, to: '/produits', icone: Croissant,
        details: `${p.actif ? 'Produit actif' : 'Produit inactif'} · ${FCFA(p.prix_detail)}`,
      })
    }
    for (const c of data.clients.filter((x) => correspond(x.nom) || (x.telephone ?? '').includes(recherche.trim())).slice(0, 4)) {
      out.push({
        id: `c-${c.id}`, titre: c.nom, to: '/credits', icone: UserRound,
        details: `${c.solde_du > 0 ? `Dette ${FCFA(c.solde_du)}` : 'Client à jour'} · ${c.telephone ?? 'sans téléphone'}`,
      })
    }
    for (const v of [...data.ventes].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 80)) {
      if (out.length >= 10) break
      const texte = `${v.client_nom ?? ''} ${v.lignes.map((l) => l.produit_nom).join(' ')}`
      if (!correspond(texte)) continue
      out.push({
        id: `v-${v.id}`, titre: v.client_nom ?? 'Client de passage', to: '/historique', icone: ReceiptText,
        details: `${formatDateFR(v.date)} ${formatHeure(v.created_at)} · ${FCFA(v.total)}`,
      })
    }
    for (const c of data.commandes.filter((x) => correspond(x.client_nom)).slice(0, 3)) {
      out.push({
        id: `cmd-${c.id}`, titre: c.client_nom, to: '/commandes', icone: ClipboardList,
        details: `Livraison ${formatDateFR(c.date_livraison)} · ${FCFA(c.total)}`,
      })
    }
    return out.slice(0, 10)
  }, [recherche, data])

  const notifications = useMemo(() => {
    const commandesActives = data.commandes.filter((c) => c.statut === 'a_preparer' || c.statut === 'prete')
    const clientsDettes = data.clients.filter((c) => c.solde_du > 0)
    const totalDettes = clientsDettes.reduce((s, c) => s + c.solde_du, 0)
    const out: { id: string; label: string; details: string; to: string; icone: Icone }[] = []
    if (commandesActives.length > 0) {
      out.push({
        id: 'commandes', icone: ClipboardCheck, to: '/commandes',
        label: `${commandesActives.length} précommande${commandesActives.length > 1 ? 's' : ''} en cours`,
        details: 'Préparation ou livraison à suivre',
      })
    }
    if (clientsDettes.length > 0) {
      out.push({
        id: 'credits', icone: HandCoins, to: '/credits',
        label: `${clientsDettes.length} client${clientsDettes.length > 1 ? 's' : ''} avec crédit`,
        details: `Dettes clients : ${FCFA(totalDettes)}`,
      })
    }
    if (MODE_DEMO && estProprietaire) {
      out.push({
        id: 'demo', icone: Sparkles, to: '/utilisateurs',
        label: 'Mode démo actif', details: 'Données locales de démonstration',
      })
    }
    return out
  }, [data.commandes, data.clients, estProprietaire])

  const mobileItems = MOBILE_PRIORITAIRES
    .map((p) => items.find((i) => i.to === p))
    .filter(Boolean) as ItemNav[]
  const autresItems = items.filter((i) => !MOBILE_PRIORITAIRES.includes(i.to))
  const initiales = (profil?.nom || profil?.email || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0])
    .join('')
    .toUpperCase()

  const choisirResultat = (r: ResultatRecherche) => {
    setRecherche('')
    setRechercheOuverte(false)
    navigate(r.to)
  }

  return (
    <div className="min-h-full bg-cream lg:flex">
      {/* ---------------- Sidebar desktop ---------------- */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/10 bg-bread-950 text-cream transition-[width] duration-300 lg:flex',
          reduit ? 'w-[84px]' : 'w-[288px]',
        )}
      >
        <div className={cn('flex items-center gap-3 px-5 py-6', reduit && 'justify-center px-0')}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-gold-400 to-bread-700 text-bread-950 shadow-lg shadow-black/20">
            <Croissant size={22} strokeWidth={2.2} />
          </span>
          {!reduit && (
            <div className="min-w-0">
              <p className="text-[16px] font-black leading-tight tracking-tight">GestiPain</p>
              <p className="text-[11px] font-medium text-bread-300">Gestion de boulangerie</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {groupes.map((g) => (
            <div key={g.titre}>
              {!reduit && (
                <p className="mb-1.5 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-bread-500">
                  {g.titre}
                </p>
              )}
              <div className="space-y-1">
                {g.items.map((i) => (
                  <NavLink
                    key={i.to}
                    to={i.to}
                    end={i.to === '/'}
                    title={reduit ? i.label : undefined}
                    className={({ isActive }) => cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
                      isActive
                        ? 'bg-gold-400/15 text-gold-200'
                        : 'text-bread-300 hover:bg-white/5 hover:text-cream',
                      reduit && 'justify-center px-0',
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <span className={cn('absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gold-400 transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} />
                        <i.icone size={18} strokeWidth={2} className={cn('shrink-0', isActive ? 'text-gold-300' : 'text-bread-400 group-hover:text-gold-200')} />
                        {!reduit && <span className="truncate">{i.label}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            onClick={() => setReduit((v) => !v)}
            className={cn(
              'mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[12px] font-bold text-bread-400 transition-colors hover:bg-white/5 hover:text-cream',
              reduit && 'justify-center px-0',
            )}
          >
            {reduit ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!reduit && 'Réduire le menu'}
          </button>
          {MODE_DEMO && !reduit && (
            <p className="mb-2 rounded-xl border border-gold-400/20 bg-gold-400/10 px-3 py-2 text-[11px] font-semibold text-gold-200">
              Mode démo — données locales
            </p>
          )}
          <div className={cn('flex items-center gap-2.5 rounded-xl bg-white/5 p-2.5 ring-1 ring-white/10', reduit && 'justify-center')}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 text-[11px] font-black text-bread-950">
              {initiales}
            </span>
            {!reduit && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold">{profil?.nom}</p>
                <p className="truncate text-[11px] text-bread-400">
                  {estProprietaire ? 'Propriétaire' : 'Employé'}
                </p>
              </div>
            )}
            {!reduit && (
              <button
                onClick={() => deconnexion()}
                className="shrink-0 rounded-lg p-1.5 text-bread-400 transition-colors hover:bg-white/10 hover:text-red-300"
                title="Se déconnecter"
                aria-label="Se déconnecter"
              ><LogOut size={16} /></button>
            )}
          </div>
        </div>
      </aside>

      {/* ---------------- Colonne principale ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-bread-200/80 bg-ivory/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gold-700">
                {groupeCourant?.titre ?? 'Espace de travail'}
              </p>
              <h1 className="truncate text-lg font-black tracking-tight text-ink sm:text-xl">
                {courant?.label ?? 'GestiPain'}
              </h1>
            </div>

            {/* Recherche globale */}
            <div className="relative hidden w-64 md:block xl:w-80">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-bread-400" />
              <input
                value={recherche}
                onChange={(e) => { setRecherche(e.target.value); setRechercheOuverte(true) }}
                onFocus={() => setRechercheOuverte(true)}
                onBlur={() => setTimeout(() => setRechercheOuverte(false), 150)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setRecherche(''); setRechercheOuverte(false) } }}
                placeholder="Rechercher produit, client, vente…"
                className="h-10 w-full rounded-full border border-bread-200 bg-white/80 pl-9 pr-3 text-[13px] font-medium text-ink outline-none transition-all placeholder:text-bread-400 focus:border-gold-500 focus:bg-white focus:ring-4 focus:ring-gold-500/15"
              />
              {rechercheOuverte && recherche.trim().length >= 2 && (
                <div className="anim-apparition absolute right-0 top-[calc(100%+10px)] z-50 w-[min(92vw,420px)] overflow-hidden rounded-2xl border border-bread-200 bg-ivory shadow-pop">
                  {resultatsRecherche.length === 0 ? (
                    <p className="px-4 py-4 text-[13px] font-medium text-bread-500">Aucun résultat pour « {recherche} ».</p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto p-1.5">
                      {resultatsRecherche.map((r) => (
                        <button
                          key={r.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => choisirResultat(r)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-gold-50"
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bread-100 text-bread-700">
                            <r.icone size={17} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-bold text-ink">{r.titre}</span>
                            <span className="block truncate text-[11px] text-bread-500">{r.details}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="relative">
              {notificationsOuvertes && (
                <button className="fixed inset-0 z-40 cursor-default" onClick={() => setNotificationsOuvertes(false)} aria-hidden />
              )}
              <button
                onClick={() => setNotificationsOuvertes((v) => !v)}
                className="relative grid h-10 w-10 place-items-center rounded-full border border-bread-200 bg-white/80 text-bread-600 transition-colors hover:border-gold-400 hover:text-gold-700"
                aria-label="Notifications"
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
                    {notifications.length}
                  </span>
                )}
              </button>
              {notificationsOuvertes && (
                <div className="anim-apparition absolute right-0 top-[calc(100%+10px)] z-50 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-bread-200 bg-ivory shadow-pop">
                  <div className="flex items-center justify-between border-b border-bread-100 px-4 py-3">
                    <p className="text-[14px] font-black text-ink">Notifications</p>
                    <span className="rounded-full bg-bread-100 px-2 py-0.5 text-[10px] font-black text-bread-600">{notifications.length}</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-1.5">
                    {notifications.length === 0 ? (
                      <p className="px-3 py-6 text-center text-[13px] font-medium text-bread-500">Aucune alerte pour le moment.</p>
                    ) : notifications.map((n) => (
                      <Link
                        key={n.id}
                        to={n.to}
                        onClick={() => setNotificationsOuvertes(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gold-50"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold-100 text-gold-800">
                          <n.icone size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-bold text-ink">{n.label}</span>
                          <span className="block truncate text-[11px] text-bread-500">{n.details}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profil */}
            <div className="relative">
              {profilOuvert && (
                <button className="fixed inset-0 z-40 cursor-default" onClick={() => setProfilOuvert(false)} aria-hidden />
              )}
              <button
                onClick={() => setProfilOuvert((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-bread-200 bg-white/80 py-1.5 pl-1.5 pr-2 transition-colors hover:border-gold-400"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 text-[11px] font-black text-bread-950">
                  {initiales}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-28 truncate text-[12px] font-black leading-tight text-ink">{profil?.nom}</span>
                  <span className="block text-[10px] font-semibold text-bread-500">{estProprietaire ? 'Propriétaire' : 'Employé'}</span>
                </span>
                <ChevronDown size={15} className={cn('text-bread-400 transition-transform', profilOuvert && 'rotate-180')} />
              </button>
              {profilOuvert && (
                <div className="anim-apparition absolute right-0 top-[calc(100%+10px)] z-50 w-64 overflow-hidden rounded-2xl border border-bread-200 bg-ivory shadow-pop">
                  <div className="border-b border-bread-100 bg-bread-50/80 px-4 py-3">
                    <p className="truncate text-[14px] font-black text-ink">{profil?.nom}</p>
                    <p className="truncate text-[11px] text-bread-500">{profil?.email}</p>
                    <div className="mt-2 flex gap-1.5">
                      <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gold-900">
                        {estProprietaire ? 'Propriétaire' : 'Employé'}
                      </span>
                      {MODE_DEMO && <span className="rounded-full bg-bread-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-bread-800">Démo</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => deconnexion()}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-bold text-red-700 transition-colors hover:bg-red-50"
                  >
                    <LogOut size={16} /> Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-7">
          <Outlet />
        </main>

        {/* ---------------- Navigation mobile ---------------- */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-bread-200 bg-ivory/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-lg items-stretch">
            {mobileItems.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                className={({ isActive }) => cn(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition-colors',
                  isActive ? 'text-gold-800' : 'text-bread-500',
                )}
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('grid h-8 w-12 place-items-center rounded-xl transition-colors', isActive && 'bg-gold-100 text-gold-800')}>
                      <i.icone size={18} strokeWidth={2.2} />
                    </span>
                    {i.court}
                  </>
                )}
              </NavLink>
            ))}
            <button
              onClick={() => setPlusOuvert(true)}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-bold text-bread-500 transition-colors"
            >
              <span className="grid h-8 w-12 place-items-center rounded-xl">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M12 5v14"/></svg>
              </span>
              Plus
            </button>
          </div>
        </nav>

        {/* Tiroir « Plus » mobile */}
        {plusOuvert && (
          <div className="anim-fondu fixed inset-0 z-50 flex flex-col justify-end bg-bread-950/45 backdrop-blur-sm lg:hidden" onClick={() => setPlusOuvert(false)}>
            <div className="anim-apparition max-h-[82vh] overflow-y-auto rounded-t-[28px] bg-cream p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between px-1">
                <div>
                  <h2 className="text-lg font-black text-ink">Menu</h2>
                  <p className="text-[12px] font-medium text-bread-500">{profil?.nom} · {estProprietaire ? 'Propriétaire' : 'Employé'}</p>
                </div>
                <button onClick={() => setPlusOuvert(false)} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-bread-700 ring-1 ring-bread-200">
                  Fermer
                </button>
              </div>
              <div className="space-y-4">
                {groupes.map((g) => (
                  <div key={g.titre}>
                    <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-gold-700">{g.titre}</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {g.items.filter((i) => autresItems.includes(i)).map((i) => (
                        <NavLink
                          key={i.to}
                          to={i.to}
                          className="flex items-center gap-3 rounded-2xl border border-bread-200 bg-white p-3.5 transition-colors hover:border-gold-400 hover:bg-gold-50"
                        >
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bread-100 text-bread-700">
                            <i.icone size={19} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-black text-ink">{i.label}</span>
                            <span className="block truncate text-[10px] font-medium text-bread-500">{i.sousTitre}</span>
                          </span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
