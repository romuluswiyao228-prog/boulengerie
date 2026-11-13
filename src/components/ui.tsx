// ============================================================================
// ui.tsx — Composants d'interface réutilisables
// ============================================================================
import React from 'react'
import { PackageSearch, X } from 'lucide-react'

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function Bouton({
  children, variante = 'primaire', taille = 'md', className, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primaire' | 'secondaire' | 'fantome' | 'danger' | 'succes' | 'sombre'
  taille?: 'sm' | 'md' | 'lg'
}) {
  const variantes = {
    primaire: 'bg-bread-800 text-cream hover:bg-bread-900 shadow-[0_14px_28px_-18px_rgb(36_22_12/0.8)]',
    secondaire: 'bg-ivory text-bread-900 border border-bread-200 hover:border-gold-400 hover:bg-gold-50',
    fantome: 'bg-transparent text-bread-600 hover:bg-bread-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    succes: 'bg-emerald-700 text-white hover:bg-emerald-800',
    sombre: 'bg-bread-950 text-cream hover:bg-black',
  }
  const tailles = {
    sm: 'px-3 py-2 text-sm rounded-lg',
    md: 'px-4 py-3 text-[15px] rounded-xl',
    lg: 'px-5 py-4 text-base rounded-2xl',
  }
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all',
        'disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.99]',
        variantes[variante], tailles[taille], className,
      )}
    >
      {children}
    </button>
  )
}

export function Carte({ children, className }: { children: React.ReactNode; className?: string }) {
  const surchargeFond = /(^|\s)bg-/.test(className ?? '')
  const surchargeBordure = /(^|\s)border-/.test(className ?? '')
  return (
    <div
      className={cn(
        'rounded-2xl border shadow-card transition-shadow',
        !surchargeFond && 'bg-ivory',
        !surchargeBordure && 'border-bread-200/80',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Champ({
  label, aide, className, children,
}: { label: string; aide?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[13px] font-semibold text-bread-700">{label}</span>
      {children}
      {aide && <span className="mt-1 block text-[12px] text-bread-500">{aide}</span>}
    </label>
  )
}

const styleInput =
  'w-full rounded-xl border border-bread-200 bg-white px-3.5 py-3 text-[15px] text-ink ' +
  'outline-none transition-all placeholder:text-bread-300 ' +
  'focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(styleInput, props.className)} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(styleInput, 'appearance-none bg-[length:16px] pr-9', props.className)}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235e442f' stroke-width='2.5'><path d='M6 9l6 6 6-6'/></svg>\")",
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
    }}
  />
}

export function ZoneTexte(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(styleInput, 'min-h-[80px] resize-y', props.className)} />
}

export function Etiquette({
  children, ton = 'neutre',
}: { children: React.ReactNode; ton?: 'neutre' | 'vert' | 'rouge' | 'ambre' | 'bleu' | 'gris' }) {
  const tons = {
    neutre: 'bg-bread-100 text-bread-800',
    vert: 'bg-emerald-100 text-emerald-800',
    rouge: 'bg-red-100 text-red-700',
    ambre: 'bg-gold-100 text-gold-900',
    bleu: 'bg-[#e8f1ec] text-[#356859]',
    gris: 'bg-bread-200 text-bread-700',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide', tons[ton])}>
      {children}
    </span>
  )
}

export function Alerte({ children, ton = 'erreur' }: { children: React.ReactNode; ton?: 'erreur' | 'succes' | 'info' }) {
  const tons = {
    erreur: 'bg-red-50 border-red-200 text-red-800',
    succes: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info: 'bg-gold-50 border-gold-200 text-gold-900',
  }
  return <div className={cn('rounded-xl border px-4 py-3 text-sm font-medium', tons[ton])}>{children}</div>
}

export function Vide({ texte, icone = <PackageSearch size={24} /> }: { texte: string; icone?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-bread-100 text-bread-400">
        {typeof icone === 'string' ? <span className="text-2xl">{icone}</span> : icone}
      </span>
      <p className="max-w-xs text-sm font-medium text-bread-500">{texte}</p>
    </div>
  )
}

export function TitrePage({
  titre, sousTitre, action,
}: { titre: string; sousTitre?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-[28px]">{titre}</h1>
        {sousTitre && <p className="mt-1 text-sm text-bread-500">{sousTitre}</p>}
      </div>
      {action}
    </div>
  )
}

/** Champ quantité avec gros boutons − / + (usage comptoir) */
export function CompteurQuantite({
  valeur, onChange, min = 1, pas = 1,
}: { valeur: number; onChange: (v: number) => void; min?: number; pas?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, valeur - pas))}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-bread-200 bg-white text-xl font-bold text-bread-800 transition-colors hover:border-gold-400 active:bg-gold-50"
        aria-label="Diminuer"
      >−</button>
      <input
        type="number"
        inputMode="numeric"
        value={valeur}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
        className="h-11 w-16 rounded-xl border border-bread-200 bg-white text-center text-[15px] font-bold text-ink outline-none transition-colors focus:border-gold-500"
      />
      <button
        type="button"
        onClick={() => onChange(valeur + pas)}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-bread-200 bg-white text-xl font-bold text-bread-800 transition-colors hover:border-gold-400 active:bg-gold-50"
        aria-label="Augmenter"
      >+</button>
    </div>
  )
}

export function Modale({
  ouvert, onFermer, titre, children, pied,
}: {
  ouvert: boolean; onFermer: () => void; titre: string
  children: React.ReactNode; pied?: React.ReactNode
}) {
  if (!ouvert) return null
  return (
    <div className="anim-fondu fixed inset-0 z-50 flex items-end justify-center bg-bread-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        className="anim-apparition flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-ivory shadow-pop sm:rounded-[28px]"
        role="dialog" aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-bread-100 px-5 py-4">
          <h2 className="text-lg font-black text-ink">{titre}</h2>
          <button onClick={onFermer} className="grid h-9 w-9 place-items-center rounded-full text-bread-400 transition-colors hover:bg-bread-100 hover:text-bread-800" aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {pied && <div className="border-t border-bread-100 bg-bread-50/70 px-5 py-4">{pied}</div>}
      </div>
    </div>
  )
}

export function BarreProgression({ valeur, max, couleur = 'bg-gold-600' }: { valeur: number; max: number; couleur?: string }) {
  const pct = max > 0 ? Math.min(100, (valeur / max) * 100) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-bread-100">
      <div className={cn('h-full rounded-full transition-all duration-500', couleur)} style={{ width: `${pct}%` }} />
    </div>
  )
}
