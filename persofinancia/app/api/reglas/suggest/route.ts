// persofinancia/app/api/reglas/suggest/route.ts
//
// Given a movement just categorized manually by the user, find a repeating pattern
// in its descripcion that would match OTHER uncategorized movs.
//
// Algorithm:
// 1. Take the mov's description, normalize (uppercase, strip dates/amounts)
// 2. Extract candidate substrings (3-25 chars): split on whitespace, also try whole words
// 3. For each candidate, count how many user's uncategorized movs would match (descripcion ILIKE %candidate%)
// 4. Return the longest candidate that matches ≥ 2 OTHER movs (so the regla is useful)
//
// POST /api/reglas/suggest { mov_id: string, categoria: string }
// Returns: { suggestion: { patron: string, categoria: string, matches: number, preview: Array<{descripcion, monto}> } | null }
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MIN_LEN = 4
const MAX_LEN = 30
const MIN_MATCHES = 2  // pattern must match at least 2 OTHER pending movs

function normalize(s: string): string {
  return s
    .toUpperCase()
    .replace(/\$[\d.,]+/g, '')          // strip $ amounts
    .replace(/\d{2}\/\d{2}\/\d{2,4}/g, '')  // strip dates
    .replace(/\d{2}:\d{2}(:\d{2})?/g, '')   // strip times
    .replace(/EL\b/g, '')
    .replace(/A LAS\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function candidates(desc: string): string[] {
  const norm = normalize(desc)
  const tokens = norm.split(' ').filter(t => t.length >= 3)
  const cands = new Set<string>()
  // Single tokens
  for (const t of tokens) {
    if (t.length >= MIN_LEN && t.length <= MAX_LEN) cands.add(t)
  }
  // Bigrams
  for (let i = 0; i < tokens.length - 1; i++) {
    const bi = `${tokens[i]} ${tokens[i + 1]}`
    if (bi.length >= MIN_LEN && bi.length <= MAX_LEN) cands.add(bi)
  }
  // Trigrams
  for (let i = 0; i < tokens.length - 2; i++) {
    const tri = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`
    if (tri.length >= MIN_LEN && tri.length <= MAX_LEN) cands.add(tri)
  }
  return Array.from(cands).sort((a, b) => b.length - a.length)  // longest first
}

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { mov_id, categoria } = await req.json()
  if (!mov_id || !categoria) {
    return NextResponse.json({ error: 'mov_id and categoria required' }, { status: 400 })
  }

  const { data: mov } = await supabase
    .from('movimientos')
    .select('id, descripcion')
    .eq('id', mov_id)
    .eq('user_id', user.id)
    .single()
  if (!mov) return NextResponse.json({ error: 'Movement not found' }, { status: 404 })

  // Check if a rule with this pattern already exists for this user
  const { data: existingRules } = await supabase
    .from('reglas_categoria')
    .select('valor')
    .eq('user_id', user.id)

  const existingPatterns = new Set((existingRules ?? []).map(r => r.valor.toUpperCase()))

  // Find best candidate
  const cands = candidates(mov.descripcion ?? '')
  for (const cand of cands) {
    if (existingPatterns.has(cand)) continue  // skip if rule already exists

    const { data: matchingMovs, count } = await supabase
      .from('movimientos')
      .select('id, descripcion, monto', { count: 'exact' })
      .eq('user_id', user.id)
      .is('categoria', null)
      .ilike('descripcion', `%${cand}%`)
      .limit(5)

    const totalMatches = count ?? 0
    if (totalMatches >= MIN_MATCHES) {
      return NextResponse.json({
        suggestion: {
          patron: cand,
          categoria,
          matches: totalMatches,
          preview: (matchingMovs ?? []).map(m => ({ descripcion: m.descripcion, monto: m.monto })),
        },
      })
    }
  }

  return NextResponse.json({ suggestion: null })
}
