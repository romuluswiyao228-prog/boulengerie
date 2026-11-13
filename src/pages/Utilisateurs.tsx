// ============================================================================
// Utilisateurs.tsx — Gestion de l'équipe et des rôles (propriétaire)
// ============================================================================
import { useEffect, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { api, reinitialiserDemo } from '../lib/api'
import { MODE_DEMO } from '../lib/supabase'
import type { Profil, Role } from '../lib/types'
import { Alerte, Bouton, Carte, Etiquette, Modale, TitrePage, cn } from '../components/ui'

export default function Utilisateurs() {
  const { profil, estProprietaire } = useStore()
  const [users, setUsers] = useState<Profil[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmationReinit, setConfirmationReinit] = useState(false)
  const [infoCreation, setInfoCreation] = useState(false)

  const charger = async () => {
    try {
      setUsers(await api.listerUtilisateurs())
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur de chargement')
    }
  }

  useEffect(() => { charger() }, [])

  const changerRole = async (id: string, role: Role) => {
    await api.changerRole(id, role)
    await charger()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <TitrePage
        titre="Utilisateurs"
        sousTitre="Équipe et niveaux d'accès"
        action={<Bouton onClick={() => setInfoCreation(true)}><Plus size={18} /> Inviter</Bouton>}
      />

      {erreur && <div className="mb-4"><Alerte>{erreur}</Alerte></div>}

      <Carte className="mb-4 overflow-hidden">
        <ul className="divide-y divide-stone-100">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-[13px] font-black text-amber-900">
                {u.nom.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-stone-900">
                  {u.nom} {u.id === profil?.id && <span className="text-[11px] font-semibold text-stone-400">(vous)</span>}
                </p>
                <p className="truncate text-[11px] text-stone-500">{u.email}</p>
              </div>
              {u.id === profil?.id ? (
                <Etiquette ton="ambre">{u.role === 'proprietaire' ? 'Propriétaire' : 'Employé'}</Etiquette>
              ) : (
                <select
                  value={u.role}
                  onChange={(e) => changerRole(u.id, e.target.value as Role)}
                  className="shrink-0 rounded-lg border-2 border-stone-200 bg-white px-2 py-1.5 text-[12px] font-bold text-stone-700"
                >
                  <option value="employe">Employé</option>
                  <option value="proprietaire">Propriétaire</option>
                </select>
              )}
            </li>
          ))}
        </ul>
      </Carte>

      <Carte className="mb-4 p-4">
        <h2 className="mb-2 text-[14px] font-black text-stone-900">Droits par rôle</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-stone-400">
                <th className="pb-2 font-bold">Module</th>
                <th className="pb-2 text-center font-bold">Propriétaire</th>
                <th className="pb-2 text-center font-bold">Employé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {[
                ['Ventes (saisie)', true, true],
                ['Crédits & remboursements', true, true],
                ['Précommandes', true, true],
                ['Invendus & pertes', true, true],
                ['Produits (lecture)', true, true],
                ['Produits (création / prix / coûts)', true, false],
                ['Production', true, false],
                ['Dépenses', true, false],
                ['Tableau de bord & bénéfices', true, false],
                ['Utilisateurs', true, false],
              ].map(([m, p, e]) => (
                <tr key={m as string}>
                  <td className="py-2 font-semibold text-stone-700">{m}</td>
                  <td className="py-2 text-center">{p ? <Check size={16} className="mx-auto text-emerald-600" /> : <span className="text-stone-300">—</span>}</td>
                  <td className="py-2 text-center">{e ? <Check size={16} className="mx-auto text-emerald-600" /> : <X size={16} className="mx-auto text-red-400" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
          Ces droits sont appliqués côté interface <em>et</em> par les politiques RLS de Supabase
          (voir <code className="rounded bg-stone-100 px-1">supabase/schema.sql</code>).
        </p>
      </Carte>

      {MODE_DEMO && (
        <Carte className="border-amber-200 bg-amber-50/60 p-4">
          <h2 className="text-[14px] font-black text-stone-900">Données de démonstration</h2>
          <p className="mt-1 text-[12px] text-stone-600">
            Les données sont stockées dans votre navigateur. Vous pouvez les réinitialiser pour
            revenir au jeu de démonstration d'origine (60 jours de ventes, clients, commandes).
          </p>
          <Bouton variante="secondaire" taille="sm" className="mt-3" onClick={() => setConfirmationReinit(true)}>
            Réinitialiser les données démo
          </Bouton>
        </Carte>
      )}

      <Modale ouvert={confirmationReinit} onFermer={() => setConfirmationReinit(false)} titre="Réinitialiser ?"
        pied={<Bouton variante="danger" className="w-full" onClick={reinitialiserDemo}>Oui, réinitialiser</Bouton>}
      >
        <p className="text-[13px] text-stone-600">
          Toutes les données saisies dans le navigateur seront remplacées par le jeu de démonstration.
          Cette action est irréversible.
        </p>
      </Modale>

      <Modale ouvert={infoCreation} onFermer={() => setInfoCreation(false)} titre="Ajouter un utilisateur">
        <div className="space-y-3 text-[13px] text-stone-600">
          <p>
            {MODE_DEMO
              ? "En mode démonstration, les comptes sont fixes (propriétaire et employé)."
              : "Les comptes sont créés depuis Supabase (Authentication → Users → Add user)."}
          </p>
          {!MODE_DEMO && (
            <ol className="list-decimal space-y-1.5 pl-4">
              <li>Ouvrez votre projet Supabase → <strong>Authentication → Users</strong>.</li>
              <li>Cliquez sur <strong>Add user</strong> (e-mail + mot de passe, cochez « auto confirm »).</li>
              <li>Dans <strong>User metadata</strong>, ajoutez <code className="rounded bg-stone-100 px-1">{'{"role":"employe","nom":"Prénom Nom"}'}</code>.</li>
              <li>Le profil est créé automatiquement avec le bon rôle.</li>
            </ol>
          )}
          <Alerte ton="info">
            Un nouveau compte démarre toujours avec le rôle <strong>employé</strong>. Seul un propriétaire
            peut élever un compte au rôle propriétaire (menu ci-dessus).
          </Alerte>
        </div>
      </Modale>
    </div>
  )
}
