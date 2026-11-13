// ============================================================================
// App.tsx — Routage et garde-fous par rôle
// ============================================================================
import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Croissant, Lock } from 'lucide-react'
import { useStore } from './lib/store'
import Layout from './components/Layout'
import Connexion from './pages/Connexion'
import TableauDeBord from './pages/TableauDeBord'
import Ventes from './pages/Ventes'
import Historique from './pages/Historique'
import Credits from './pages/Credits'
import Commandes from './pages/Commandes'
import Produits from './pages/Produits'
import Production from './pages/Production'
import Invendus from './pages/Invendus'
import Depenses from './pages/Depenses'
import Utilisateurs from './pages/Utilisateurs'

export default function App() {
  const { profil, chargement, estProprietaire } = useStore()

  if (chargement) {
    return (
      <div className="grid min-h-full place-items-center bg-cream">
        <div className="flex flex-col items-center gap-4">
          <span className="grid h-16 w-16 animate-pulse place-items-center rounded-3xl bg-gradient-to-br from-gold-400 to-bread-800 text-bread-950 shadow-card">
            <Croissant size={30} strokeWidth={2.2} />
          </span>
          <p className="text-sm font-semibold text-bread-500">Chargement de GestiPain…</p>
        </div>
      </div>
    )
  }

  if (!profil) return <Connexion />

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* L'employé n'a pas accès au tableau de bord : on l'envoie sur la saisie de vente */}
        <Route index element={estProprietaire ? <TableauDeBord /> : <Navigate to="/ventes" replace />} />
        <Route path="ventes" element={<Ventes />} />
        <Route path="historique" element={<Historique />} />
        <Route path="credits" element={<Credits />} />
        <Route path="commandes" element={<Commandes />} />
        <Route path="produits" element={<Produits />} />
        <Route path="production" element={<Protege role="proprietaire"><Production /></Protege>} />
        <Route path="invendus" element={<Invendus />} />
        <Route path="depenses" element={<Protege role="proprietaire"><Depenses /></Protege>} />
        <Route path="utilisateurs" element={<Protege role="proprietaire"><Utilisateurs /></Protege>} />
        <Route path="*" element={<Navigate to="/ventes" replace />} />
      </Route>
    </Routes>
  )
}

/** Bloque l'accès aux modules réservés au propriétaire */
function Protege({ role, children }: { role: 'proprietaire'; children: ReactNode }) {
  const { profil } = useStore()
  const location = useLocation()
  if (profil?.role !== role) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-bread-200 bg-ivory px-6 py-12 text-center shadow-card">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-red-100 text-red-600">
          <Lock size={28} />
        </div>
        <h2 className="text-xl font-black text-ink">Accès réservé</h2>
        <p className="mt-2 text-sm leading-relaxed text-bread-500">
          Cette section ({location.pathname}) est réservée au propriétaire.<br />
          Votre compte employé ne peut pas y accéder.
        </p>
      </div>
    )
  }
  return <>{children}</>
}
