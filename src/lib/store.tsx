// ============================================================================
// store.tsx — Contexte global : session, profil et données
// ============================================================================
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, MODE_DEMO } from './supabase'
import { api, connexionDemo, deconnexionDemo, sessionDemo } from './api'
import type { AppData, Profil, Role } from './types'

const VIDE: AppData = {
  categories: [], produits: [], clients: [], ventes: [], remboursements: [],
  commandes: [], productions: [], invendus: [], depenses: [],
}

interface Store {
  profil: Profil | null
  chargement: boolean
  data: AppData
  erreur: string | null
  estProprietaire: boolean
  connexion: (email: string, mdp: string) => Promise<void>
  deconnexion: () => Promise<void>
  rafraichir: () => Promise<void>
  /** Met à jour les données locales sans recharger toute la base */
  patchData: (fn: (d: AppData) => AppData) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [profil, setProfil] = useState<Profil | null>(null)
  const [data, setData] = useState<AppData>(VIDE)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const chargerDonnees = useCallback(async (roleCourant?: Role) => {
    try {
      const d = await api.charger(roleCourant ?? profil?.role ?? 'employe')
      setData(d)
      setErreur(null)
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur de chargement des données')
    }
  }, [profil?.role])

  // Restauration de session
  useEffect(() => {
    let actif = true
    ;(async () => {
      if (MODE_DEMO) {
        const p = sessionDemo()
        if (actif && p) {
          setProfil(p)
          await chargerDonnees(p.role)
        }
        if (actif) setChargement(false)
        return
      }
      if (!supabase) {
        if (actif) {
          setErreur('Supabase n’est pas configuré. Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.')
          setChargement(false)
        }
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: prof } = await supabase!.from('profils').select('*').eq('id', session.user.id).single()
        if (actif) {
          const profilCourant =
            (prof as Profil) ?? {
              id: session.user.id,
              email: session.user.email ?? '',
              nom: session.user.email ?? '',
              role: 'employe' as const,
            }
          setProfil(profilCourant)
          await chargerDonnees(profilCourant.role)
        }
      }
      if (actif) setChargement(false)
    })()
    return () => { actif = false }
  }, [chargerDonnees])

  const connexion = useCallback(async (email: string, mdp: string) => {
    setErreur(null)
    if (MODE_DEMO) {
      const p = await connexionDemo(email, mdp)
      setProfil(p)
      const d = await api.charger(p.role)
      setData(d)
      return
    }
    if (!supabase) throw new Error('Supabase n’est pas configuré. Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.')
    const { data: res, error } = await supabase.auth.signInWithPassword({ email, password: mdp })
    if (error) throw new Error(traduireErreur(error.message))
    const { data: prof } = await supabase!.from('profils').select('*').eq('id', res.user.id).single()
    const profilCourant =
      (prof as Profil) ?? { id: res.user.id, email: res.user.email ?? email, nom: email, role: 'employe' as const }
    setProfil(profilCourant)
    setData(await api.charger(profilCourant.role))
  }, [chargerDonnees])

  const deconnexion = useCallback(async () => {
    if (MODE_DEMO) deconnexionDemo()
    else if (supabase) await supabase.auth.signOut()
    setProfil(null)
    setData(VIDE)
  }, [])

  const valeur = useMemo<Store>(() => ({
    profil,
    chargement,
    data,
    erreur,
    estProprietaire: profil?.role === 'proprietaire',
    connexion,
    deconnexion,
    rafraichir: () => chargerDonnees(),
    patchData: (fn) => setData((d) => fn(d)),
  }), [profil, chargement, data, erreur, connexion, deconnexion, chargerDonnees])

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore doit être utilisé dans <StoreProvider>')
  return ctx
}

function traduireErreur(msg: string) {
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.'
  if (/Email not confirmed/i.test(msg)) return 'E-mail non confirmé. Vérifiez votre boîte mail.'
  return msg
}
