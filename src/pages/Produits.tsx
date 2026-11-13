// ============================================================================
// Produits.tsx — Catalogue visuel des produits (grille / tableau)
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import {
  Check, Croissant, Eye, ImagePlus, LayoutGrid, Loader2, PackageSearch, Pencil, Search,
  Table, Tags, Trash2, X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import type { CategorieProduit, Produit } from '../lib/types'
import { CATEGORIES_PRODUITS_DEFAUT } from '../lib/types'
import { FCFA, formatDateFR } from '../lib/utils'
import {
  Alerte, Bouton, Carte, Champ, Etiquette, Input, Modale, Select, TitrePage, Vide,
  ZoneTexte, cn,
} from '../components/ui'

type Vue = 'grille' | 'tableau'
type Tri = 'nom' | 'prix_asc' | 'prix_desc' | 'stock'
type Disponibilite = 'tous' | 'dispo' | 'rupture' | 'alerte'
type FormProduit = Partial<Produit> & { nom: string }

const UNITES = ['unité', 'pièce', 'lot', 'kg', 'kilogramme', 'g', 'litre', 'ml', 'paquet', 'boîte', 'douzaine']
const FORM_VIDE: FormProduit = {
  nom: '', prix_detail: 0, prix_revendeur: 0, cout_production: 0,
  categorie: CATEGORIES_PRODUITS_DEFAUT[0], photo_url: null, description: null,
  stock: 0, seuil_alerte: 0, unite: 'unité', actif: true,
}

export default function Produits() {
  const { data, estProprietaire, patchData } = useStore()
  const [vue, setVue] = useState<Vue>('grille')
  const [recherche, setRecherche] = useState('')
  const [categorie, setCategorie] = useState('')
  const [tri, setTri] = useState<Tri>('nom')
  const [dispo, setDispo] = useState<Disponibilite>('tous')
  const [edition, setEdition] = useState<FormProduit | null>(null)
  const [consultation, setConsultation] = useState<Produit | null>(null)
  const [aSupprimer, setASupprimer] = useState<Produit | null>(null)
  const [categoriesOuvertes, setCategoriesOuvertes] = useState(false)
  const [message, setMessage] = useState<{ ton: 'succes' | 'erreur'; texte: string } | null>(null)

  const categories = useMemo(() => {
    const base = data.categories.length
      ? data.categories.filter((c) => c.actif).map((c) => c.nom)
      : [...CATEGORIES_PRODUITS_DEFAUT]
    const extra = data.produits.map((p) => p.categorie).filter((x): x is string => Boolean(x))
    return Array.from(new Set([...base, ...extra])).sort((a, b) => a.localeCompare(b))
  }, [data.categories, data.produits])

  const produits = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return data.produits
      .filter((p) => !q || p.nom.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q))
      .filter((p) => !categorie || (p.categorie ?? 'Sans catégorie') === categorie)
      .filter((p) => {
        const stock = p.stock
        if (dispo === 'dispo') return p.actif && (stock == null || stock > 0)
        if (dispo === 'rupture') return stock === 0
        if (dispo === 'alerte') return stock != null && stock > 0 && stock <= (p.seuil_alerte ?? 0)
        return true
      })
      .sort((a, b) => {
        if (tri === 'prix_asc') return a.prix_detail - b.prix_detail
        if (tri === 'prix_desc') return b.prix_detail - a.prix_detail
        if (tri === 'stock') return (a.stock ?? 0) - (b.stock ?? 0)
        return a.nom.localeCompare(b.nom)
      })
  }, [data.produits, recherche, categorie, tri, dispo])

  const supprimer = async () => {
    if (!aSupprimer) return
    const p = aSupprimer
    setASupprimer(null)
    try {
      await Promise.all([api.supprimerProduit(p.id), api.supprimerPhoto(p.photo_url).catch(() => {})])
      patchData((d) => ({ ...d, produits: d.produits.filter((x) => x.id !== p.id) }))
      setMessage({ ton: 'succes', texte: `« ${p.nom} » supprimé du catalogue.` })
    } catch {
      setMessage({ ton: 'erreur', texte: 'Suppression impossible. Réessayez.' })
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <TitrePage
        titre="Catalogue produits"
        sousTitre="Photos, prix, catégories et stocks"
        action={estProprietaire ? <Bouton onClick={() => setEdition({ ...FORM_VIDE })}><ImagePlus size={18} /> Ajouter un produit</Bouton> : undefined}
      />

      {message && <div className="mb-4"><Alerte ton={message.ton}>{message.texte}</Alerte></div>}

      <Carte className="mb-4 p-3 sm:p-4">
        <div className="grid gap-2.5 lg:grid-cols-[1fr_180px_160px_160px_auto]">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-bread-400" />
            <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un produit…" className="pl-9" />
          </div>
          <Select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            <option value="">Toutes catégories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={dispo} onChange={(e) => setDispo(e.target.value as Disponibilite)}>
            <option value="tous">Toutes disponibilités</option>
            <option value="dispo">Disponibles</option>
            <option value="rupture">Rupture</option>
            <option value="alerte">Stock bas</option>
          </Select>
          <Select value={tri} onChange={(e) => setTri(e.target.value as Tri)}>
            <option value="nom">Tri : nom</option>
            <option value="prix_asc">Prix croissant</option>
            <option value="prix_desc">Prix décroissant</option>
            <option value="stock">Stock</option>
          </Select>
          <div className="flex items-center gap-2">
            {estProprietaire && <Bouton variante="secondaire" taille="sm" onClick={() => setCategoriesOuvertes(true)}><Tags size={16} /> Catégories</Bouton>}
            <div className="flex rounded-xl bg-bread-100 p-1">
              <button onClick={() => setVue('grille')} className={cn('grid h-9 w-10 place-items-center rounded-lg', vue === 'grille' ? 'bg-ivory text-gold-800 shadow-sm' : 'text-bread-500')} aria-label="Vue grille"><LayoutGrid size={17} /></button>
              <button onClick={() => setVue('tableau')} className={cn('grid h-9 w-10 place-items-center rounded-lg', vue === 'tableau' ? 'bg-ivory text-gold-800 shadow-sm' : 'text-bread-500')} aria-label="Vue tableau"><Table size={17} /></button>
            </div>
          </div>
        </div>
      </Carte>

      {produits.length === 0 ? (
        <Carte><Vide texte={data.produits.length === 0 ? 'Aucun produit. Créez votre premier produit pour commencer.' : 'Aucun produit ne correspond aux filtres.'} icone={<PackageSearch size={26} />} /></Carte>
      ) : vue === 'grille' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {produits.map((p) => <CarteProduit key={p.id} p={p} proprietaire={estProprietaire} onVoir={() => setConsultation(p)} onEditer={estProprietaire ? () => setEdition({ ...p }) : undefined} onSupprimer={estProprietaire ? () => setASupprimer(p) : undefined} />)}
        </div>
      ) : (
        <Carte className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="bg-bread-50 text-[11px] uppercase tracking-wide text-bread-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Produit</th>
                  <th className="px-4 py-3 font-bold">Catégorie</th>
                  <th className="px-4 py-3 text-right font-bold">Prix</th>
                  <th className="px-4 py-3 text-right font-bold">Stock</th>
                  <th className="px-4 py-3 font-bold">Statut</th>
                  <th className="px-4 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bread-100">
                {produits.map((p) => (
                  <tr key={p.id} className="align-middle hover:bg-gold-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Photo p={p} className="h-11 w-11 rounded-xl" />
                        <div className="min-w-0">
                          <p className="truncate font-black text-ink">{p.nom}</p>
                          <p className="truncate text-[11px] text-bread-500">{p.unite ?? 'unité'}{estProprietaire ? ` · revient ${FCFA(p.cout_production)}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-bread-700">{p.categorie ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-black text-ink">{FCFA(p.prix_detail)}</td>
                    <td className="px-4 py-3 text-right font-bold text-bread-700">{p.stock ?? '—'}</td>
                    <td className="px-4 py-3"><Statut p={p} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setConsultation(p)} className="rounded-lg border border-bread-200 px-2.5 py-1.5 text-[11px] font-bold text-bread-600 hover:bg-gold-50" title="Consulter"><Eye size={14} className="inline" /> Voir</button>
                        {estProprietaire && <button onClick={() => setEdition({ ...p })} className="rounded-lg border border-bread-200 px-2.5 py-1.5 text-[11px] font-bold text-bread-600 hover:bg-gold-50" title="Modifier"><Pencil size={14} className="inline" /> Modifier</button>}
                        {estProprietaire && <button onClick={() => setASupprimer(p)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50" title="Supprimer"><Trash2 size={14} className="inline" /> Suppr.</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Carte>
      )}

      {consultation && <ConsultationProduit p={consultation} proprietaire={estProprietaire} onFermer={() => setConsultation(null)} />}
      <CategoriesModale ouvert={categoriesOuvertes} onFermer={() => setCategoriesOuvertes(false)} />
      {edition && <FormulaireProduit initial={edition} categories={categories} onFermer={() => setEdition(null)} onEnregistre={async (p) => {
        patchData((d) => ({
          ...d,
          produits: d.produits.some((x) => x.id === p.id)
            ? d.produits.map((x) => (x.id === p.id ? p : x))
            : [...d.produits, p],
        }))
        setEdition(null)
        setMessage({ ton: 'succes', texte: 'Produit enregistré.' })
      }} />}
      <Modale ouvert={Boolean(aSupprimer)} onFermer={() => setASupprimer(null)} titre="Supprimer le produit ?"
        pied={<div className="flex gap-2"><Bouton variante="secondaire" className="flex-1" onClick={() => setASupprimer(null)}><X size={16} /> Annuler</Bouton><Bouton variante="danger" className="flex-1" onClick={supprimer}><Trash2 size={16} /> Supprimer</Bouton></div>}>
        <p className="text-[13px] text-bread-600">« {aSupprimer?.nom} » sera retiré du catalogue. Les ventes passées conservent leur historique.</p>
      </Modale>
    </div>
  )
}

function Photo({ p, className }: { p: Produit; className?: string }) {
  if (p.photo_url) return <img src={p.photo_url} alt={p.nom} className={cn('shrink-0 object-cover', className)} />
  return <span className={cn('grid shrink-0 place-items-center bg-gradient-to-br from-bread-100 to-gold-100 text-bread-500', className)}><Croissant size={22} /></span>
}

function Statut({ p }: { p: Produit }) {
  const stock = p.stock
  if (!p.actif) return <Etiquette ton="gris">Inactif</Etiquette>
  if (stock === 0) return <Etiquette ton="rouge">Rupture</Etiquette>
  if (stock != null && stock <= (p.seuil_alerte ?? 0)) return <Etiquette ton="ambre">Stock bas</Etiquette>
  return <Etiquette ton="vert">{stock == null ? 'Disponible' : 'En stock'}</Etiquette>
}

function CarteProduit({ p, proprietaire, onVoir, onEditer, onSupprimer }: { p: Produit; proprietaire: boolean; onVoir: () => void; onEditer?: () => void; onSupprimer?: () => void }) {
  const stock = p.stock
  return (
    <Carte className={cn('overflow-hidden', !p.actif && 'opacity-60')}>
      <div className="relative">
        {p.photo_url ? <img src={p.photo_url} alt={p.nom} className="h-44 w-full object-cover" /> : <div className="grid h-44 place-items-center bg-gradient-to-br from-bread-100 via-gold-50 to-bread-200 text-bread-400"><Croissant size={44} strokeWidth={1.4} /></div>}
        <div className="absolute left-3 top-3"><Statut p={p} /></div>
      </div>
      <div className="p-4">
        <p className="truncate text-[16px] font-black text-ink">{p.nom}</p>
        <p className="mt-0.5 truncate text-[12px] font-medium text-bread-500">{p.categorie ?? 'Sans catégorie'} · {p.unite ?? 'unité'}</p>
        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-bread-400">Prix vente</p>
            <p className="text-[18px] font-black text-gold-800">{FCFA(p.prix_detail)}</p>
            {proprietaire && <p className="text-[10px] font-semibold text-bread-400">revient {FCFA(p.cout_production)}</p>}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-bread-400">Stock</p>
            <p className={cn('text-[15px] font-black', stock === 0 ? 'text-red-600' : stock != null && stock <= (p.seuil_alerte ?? 0) ? 'text-gold-700' : 'text-ink')}>{stock ?? '—'}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5">
          <Bouton variante="secondaire" taille="sm" className="flex-1" onClick={onVoir}><Eye size={15} /> Voir</Bouton>
          {onEditer && <Bouton variante="secondaire" taille="sm" className="flex-1" onClick={onEditer}><Pencil size={15} /> Modifier</Bouton>}
          {onSupprimer && <Bouton variante="danger" taille="sm" onClick={onSupprimer} aria-label="Supprimer"><Trash2 size={15} /></Bouton>}
        </div>
      </div>
    </Carte>
  )
}

function ConsultationProduit({ p, proprietaire, onFermer }: { p: Produit; proprietaire: boolean; onFermer: () => void }) {
  return (
    <Modale ouvert onFermer={onFermer} titre="Fiche produit">
      <div className="space-y-4">
        {p.photo_url ? <img src={p.photo_url} alt={p.nom} className="h-56 w-full rounded-2xl object-cover" /> : <div className="grid h-40 place-items-center rounded-2xl bg-gradient-to-br from-bread-100 to-gold-100 text-bread-400"><Croissant size={48} /></div>}
        <div>
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black text-ink">{p.nom}</h3><Statut p={p} /></div>
          <p className="mt-1 text-[13px] text-bread-500">{p.categorie ?? 'Sans catégorie'} · {p.unite ?? 'unité'} · créé le {formatDateFR(p.created_at.slice(0, 10))}</p>
          {p.description && <p className="mt-3 rounded-xl bg-bread-50 px-3 py-2 text-[13px] text-bread-700">{p.description}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-gold-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase text-gold-800">Prix détail</p><p className="text-lg font-black text-ink">{FCFA(p.prix_detail)}</p></div>
          <div className="rounded-xl bg-bread-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase text-bread-500">Prix revendeur</p><p className="text-lg font-black text-ink">{FCFA(p.prix_revendeur)}</p></div>
          <div className="rounded-xl bg-bread-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase text-bread-500">Stock</p><p className="text-lg font-black text-ink">{p.stock ?? '—'} {p.stock != null ? (p.unite ?? '') : ''}</p></div>
          <div className="rounded-xl bg-bread-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase text-bread-500">Seuil d'alerte</p><p className="text-lg font-black text-ink">{p.seuil_alerte ?? 0}</p></div>
          {proprietaire && <div className="rounded-xl bg-bread-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase text-bread-500">Prix revient</p><p className="text-lg font-black text-ink">{FCFA(p.cout_production)}</p></div>}
          {proprietaire && <div className="rounded-xl bg-bread-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase text-bread-500">Marge détail</p><p className="text-lg font-black text-emerald-700">{FCFA(p.prix_detail - p.cout_production)}</p></div>}
        </div>
      </div>
    </Modale>
  )
}

function CategoriesModale({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  const { data, rafraichir } = useStore()
  const [noms, setNoms] = useState<Record<string, string>>({})
  const [actifs, setActifs] = useState<Record<string, boolean>>({})
  const [nouvelle, setNouvelle] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    if (!ouvert) return
    setNoms(Object.fromEntries(data.categories.map((c) => [c.id, c.nom])))
    setActifs(Object.fromEntries(data.categories.map((c) => [c.id, c.actif])))
    setNouvelle(''); setErreur(null)
  }, [ouvert, data.categories])

  const enregistrer = async (c: CategorieProduit) => {
    setEnCours(true); setErreur(null)
    try {
      await api.enregistrerCategorie({ id: c.id, nom: noms[c.id] ?? c.nom, actif: actifs[c.id] ?? c.actif })
      await rafraichir()
    } catch (e: any) { setErreur(e?.message ?? 'Erreur') } finally { setEnCours(false) }
  }
  const ajouter = async () => {
    if (!nouvelle.trim()) return setErreur('Nom obligatoire.')
    setEnCours(true); setErreur(null)
    try { await api.enregistrerCategorie({ nom: nouvelle }); setNouvelle(''); await rafraichir() }
    catch (e: any) { setErreur(e?.message ?? 'Erreur') } finally { setEnCours(false) }
  }
  const supprimer = async (c: CategorieProduit) => {
    if (!window.confirm(`Supprimer la catégorie « ${c.nom} » ? Les produits gardent leur texte de catégorie.`)) return
    setEnCours(true); setErreur(null)
    try { await api.supprimerCategorie(c.id); await rafraichir() }
    catch (e: any) { setErreur(e?.message ?? 'Erreur') } finally { setEnCours(false) }
  }

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Catégories produits"
      pied={<Bouton variante="secondaire" className="w-full" onClick={onFermer}><X size={16} /> Fermer</Bouton>}>
      <div className="space-y-3">
        {erreur && <Alerte>{erreur}</Alerte>}
        <div className="flex gap-2">
          <Input value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} placeholder="Nouvelle catégorie…" />
          <Bouton className="shrink-0" onClick={ajouter} disabled={enCours}><Check size={16} /> Ajouter</Bouton>
        </div>
        <ul className="max-h-[46vh] space-y-2 overflow-y-auto">
          {data.categories.length === 0 && <Vide texte="Aucune catégorie. Ajoutez la première." icone={<Tags size={22} />} />}
          {data.categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-xl border border-bread-200 bg-ivory px-2.5 py-2">
              <input value={noms[c.id] ?? c.nom} onChange={(e) => setNoms((n) => ({ ...n, [c.id]: e.target.value }))} className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[13px] font-bold text-ink outline-none focus:border-gold-400 focus:bg-white" />
              <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-bread-600">
                <input type="checkbox" checked={actifs[c.id] ?? c.actif} onChange={(e) => setActifs((a) => ({ ...a, [c.id]: e.target.checked }))} className="h-4 w-4 accent-gold-600" /> Actif
              </label>
              <button onClick={() => enregistrer(c)} disabled={enCours} className="rounded-lg border border-bread-200 px-2 py-1.5 text-bread-600 hover:bg-gold-50" title="Enregistrer"><Check size={15} /></button>
              <button onClick={() => supprimer(c)} disabled={enCours} className="rounded-lg border border-red-200 px-2 py-1.5 text-red-600 hover:bg-red-50" title="Supprimer"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      </div>
    </Modale>
  )
}

/** Redimensionne l'image (max 800 px, WebP qualité 0,8) pour alléger l'upload Storage */
async function preparerImage(fichier: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(fichier)
    const echelle = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * echelle))
    canvas.height = Math.max(1, Math.round(bitmap.height * echelle))
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.8))
    if (!blob || blob.size >= fichier.size) return fichier
    const nom = fichier.name.replace(/\.[^.]+$/, '') + '.webp'
    return new File([blob], nom, { type: blob.type || 'image/webp' })
  } catch {
    return fichier
  }
}

function FormulaireProduit({ initial, categories, onFermer, onEnregistre }: { initial: FormProduit; categories: string[]; onFermer: () => void; onEnregistre: (p: Produit) => Promise<void> }) {
  const [form, setForm] = useState<FormProduit>(initial)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [envoiPhoto, setEnvoiPhoto] = useState(false)
  const set = <K extends keyof FormProduit>(k: K, v: FormProduit[K]) => setForm((f) => ({ ...f, [k]: v }))

  const lirePhoto = async (fichier?: File | null) => {
    if (!fichier) return
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(fichier.type)
    if (!ok) return setErreur('Format accepté : JPG, JPEG, PNG ou WEBP.')
    if (fichier.size > 8_000_000) return setErreur('Photo trop lourde (max 8 Mo).')
    setEnvoiPhoto(true); setErreur(null)
    try {
      const t0 = performance.now()
      const preparee = await preparerImage(fichier)
      const t1 = performance.now()
      const url = await api.televerserPhoto(preparee)
      console.info(`[perf] photo : redimensionnement ${Math.round(t1 - t0)} ms, upload ${Math.round(performance.now() - t1)} ms (${preparee.size} o)`)
      set('photo_url', url)
    } catch (e: any) {
      setErreur(e?.message ?? 'Envoi de la photo impossible.')
    } finally {
      setEnvoiPhoto(false)
    }
  }

  const enregistrer = async () => {
    if (!form.nom.trim()) return setErreur('Le nom est obligatoire.')
    if ((form.prix_detail ?? 0) <= 0) return setErreur('Le prix de vente doit être supérieur à 0.')
    if (envoiPhoto) return setErreur('Envoi de la photo en cours, patientez…')
    setEnCours(true)
    const t0 = performance.now()
    try {
      const p = await api.enregistrerProduit({
        id: form.id, nom: form.nom.trim(), prix_detail: Number(form.prix_detail),
        prix_revendeur: Number(form.prix_revendeur) || Number(form.prix_detail),
        cout_production: Number(form.cout_production ?? 0),
        categorie: form.categorie?.trim() || null, photo_url: form.photo_url ?? null,
        description: form.description?.trim() || null, stock: Number(form.stock ?? 0),
        seuil_alerte: Number(form.seuil_alerte ?? 0), unite: form.unite || 'unité',
        actif: form.actif ?? true,
      })
      console.info(`[perf] insert produit : ${Math.round(performance.now() - t0)} ms`)
      const ancienne = initial.photo_url
      if (ancienne && ancienne !== form.photo_url) api.supprimerPhoto(ancienne).catch(() => {})
      await onEnregistre(p)
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modale ouvert onFermer={onFermer} titre={form.id ? 'Modifier le produit' : 'Nouveau produit'}
      pied={<Bouton className="w-full" taille="lg" onClick={enregistrer} disabled={enCours}>{enCours ? 'Enregistrement…' : <><Check size={18} /> Enregistrer</>}</Bouton>}>
      <div className="space-y-3.5">
        {erreur && <Alerte>{erreur}</Alerte>}
        <div className="flex items-center gap-3 rounded-2xl border border-bread-200 bg-bread-50/60 p-3">
          {form.photo_url ? <img src={form.photo_url} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-xl bg-white text-bread-300"><ImagePlus size={22} /></span>}
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-bread-700">Photo du produit</p>
            <p className="text-[11px] text-bread-500">{envoiPhoto ? 'Envoi vers le stockage…' : 'JPG, PNG ou WEBP — max 8 Mo, redimensionnée automatiquement'}</p>
            <label className={cn('mt-1 inline-flex items-center gap-1.5 rounded-lg border border-bread-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-bread-700', envoiPhoto ? 'cursor-wait opacity-60' : 'cursor-pointer hover:border-gold-400')}>
              {envoiPhoto ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
              {envoiPhoto ? 'Envoi en cours…' : 'Importer une photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={envoiPhoto} onChange={(e) => { lirePhoto(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </div>
          {form.photo_url && <button onClick={() => set('photo_url', null)} className="rounded-lg p-1.5 text-bread-400 hover:bg-red-50 hover:text-red-600" aria-label="Retirer la photo"><Trash2 size={16} /></button>}
        </div>
        <Champ label="Nom du produit"><Input value={form.nom} onChange={(e) => set('nom', e.target.value)} placeholder="Ex. Baguette" autoFocus /></Champ>
        <div className="grid grid-cols-2 gap-2.5">
          <Champ label="Catégorie">
            <Input list="categories-produits" value={form.categorie ?? ''} onChange={(e) => set('categorie', e.target.value)} placeholder="Choisir ou créer" />
            <datalist id="categories-produits">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Champ>
          <Champ label="Unité"><Select value={form.unite ?? 'unité'} onChange={(e) => set('unite', e.target.value)}>{UNITES.map((u) => <option key={u}>{u}</option>)}</Select></Champ>
        </div>
        <Champ label="Description"><ZoneTexte value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Ex. pain cuit le matin" /></Champ>
        <div className="grid grid-cols-2 gap-2.5">
          <Champ label="Prix de vente (FCFA)"><Input type="number" inputMode="numeric" value={form.prix_detail || ''} onChange={(e) => set('prix_detail', Number(e.target.value))} placeholder="Ex. 200" /></Champ>
          <Champ label="Quantité initiale"><Input type="number" inputMode="numeric" value={form.stock ?? ''} onChange={(e) => set('stock', Number(e.target.value))} placeholder="Ex. 50" /></Champ>
        </div>
        <label className="flex items-center justify-between rounded-xl border-2 border-bread-200 px-3.5 py-3">
          <span className="text-[14px] font-semibold text-bread-700">Produit actif (visible à la caisse)</span>
          <input type="checkbox" checked={form.actif ?? true} onChange={(e) => set('actif', e.target.checked)} className="h-6 w-6 accent-gold-600" />
        </label>
      </div>
    </Modale>
  )
}
