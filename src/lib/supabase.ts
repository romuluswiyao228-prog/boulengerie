// ============================================================================
// supabase.ts — Client Supabase (ou null si non configuré → mode démo)
// ============================================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigure = Boolean(url && key && url.startsWith('http'))

export const supabase: SupabaseClient | null = supabaseConfigure
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

/** true = l'app tourne sur les données locales de démonstration */
export const MODE_DEMO = !supabaseConfigure
