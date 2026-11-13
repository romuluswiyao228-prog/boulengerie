// ============================================================================
// Connexion.tsx — Authentification (Supabase ou comptes de démonstration)
// ============================================================================
import { useState } from 'react'
import { ChefHat, Croissant, Store } from 'lucide-react'
import { useStore } from '../lib/store'
import { MODE_DEMO } from '../lib/supabase'
import { Alerte, Bouton, Champ, Input } from '../components/ui'

const COMPTES_DEMO = [
  { role: 'Propriétaire', email: 'proprietaire@boulangerie.tg', mdp: 'demo1234', icone: Store, desc: 'Accès complet : bilans, dépenses, réglages' },
  { role: 'Employé', email: 'employe@boulangerie.tg', mdp: 'demo1234', icone: ChefHat, desc: 'Saisie ventes, crédits, commandes, invendus' },
]

export default function Connexion() {
  const { connexion } = useStore()
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      await connexion(email, mdp)
    } catch (err: any) {
      setErreur(err?.message ?? 'Connexion impossible')
    } finally {
      setEnCours(false)
    }
  }

  const remplir = (e: string, m: string) => { setEmail(e); setMdp(m); setErreur(null) }

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-cream">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-gold-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-bread-200/60 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-[26px] bg-gradient-to-br from-gold-400 to-bread-800 text-cream shadow-pop">
            <Croissant size={38} strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-ink">GestiPain</h1>
          <p className="mt-1.5 text-sm font-medium text-bread-500">Gestion de boulangerie artisanale</p>
        </div>

        <div className="rounded-[28px] border border-bread-200/80 bg-ivory p-6 shadow-card">
          <form onSubmit={soumettre} className="space-y-4">
            <Champ label="Adresse e-mail">
              <Input
                type="email" required autoComplete="email" inputMode="email"
                placeholder="vous@boulangerie.tg"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </Champ>
            <Champ label="Mot de passe">
              <Input
                type="password" required autoComplete="current-password"
                placeholder="••••••••"
                value={mdp} onChange={(e) => setMdp(e.target.value)}
              />
            </Champ>
            {erreur && <Alerte>{erreur}</Alerte>}
            <Bouton type="submit" taille="lg" className="w-full" disabled={enCours}>
              {enCours ? 'Connexion…' : 'Se connecter'}
            </Bouton>
          </form>
        </div>

        {MODE_DEMO && (
          <div className="mt-6">
            <p className="mb-3 text-center text-[11px] font-black uppercase tracking-[0.16em] text-bread-400">
              Comptes de démonstration
            </p>
            <div className="space-y-2.5">
              {COMPTES_DEMO.map((c) => (
                <button
                  key={c.email}
                  onClick={() => remplir(c.email, c.mdp)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-bread-200 bg-ivory p-3.5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-gold-400 hover:bg-gold-50 active:scale-[0.99]"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-bread-100 text-bread-800">
                    <c.icone size={20} strokeWidth={2.1} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-black text-ink">{c.role}</span>
                    <span className="block truncate text-[11px] font-medium text-bread-500">{c.email} · {c.mdp}</span>
                    <span className="mt-0.5 block text-[11px] text-bread-400">{c.desc}</span>
                  </span>
                  <span className="text-bread-300">→</span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-bread-400">
              Mode démonstration : les données sont stockées dans votre navigateur.<br />
              Configurez Supabase pour la persistance réelle.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
