// persofinancia/app/api/suggest-category/route.ts
//
// Suggests a category for a single movement using Groq Llama 3.3 70B + few-shot RAG.
// This is the same logic as the Edge Function's classifyWithGroq, but exposed as a
// Next.js API route so the UI can call it on-demand for individual movs (even
// those with low confianza_ia from previous bulk runs).
//
// POST /api/suggest-category { mov_id: string }
// Returns: { suggestion: { categoria, confianza } } or { suggestion: null }
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { mov_id } = await req.json()
  if (!mov_id) {
    return NextResponse.json({ error: 'mov_id required' }, { status: 400 })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })
  }

  // Fetch the mov
  const { data: mov } = await supabase
    .from('movimientos')
    .select('id, descripcion, tipo, monto, flujo, banco_id, bancos(nombre)')
    .eq('id', mov_id)
    .eq('user_id', user.id)
    .single()

  if (!mov) {
    return NextResponse.json({ error: 'Movement not found' }, { status: 404 })
  }

  // Fetch user's categories
  const { data: cats } = await supabase
    .from('categorias')
    .select('nombre, grupo')
    .eq('user_id', user.id)
  if (!cats || cats.length === 0) {
    return NextResponse.json({ suggestion: null, reason: 'No categories defined' })
  }

  // Few-shot: 8 random previously-categorized movs with same flujo
  const { data: examples } = await supabase
    .from('movimientos')
    .select('descripcion, tipo, monto, categoria')
    .eq('user_id', user.id)
    .eq('flujo', mov.flujo)
    .not('categoria', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const sampled = (examples ?? [])
    .sort(() => Math.random() - 0.5)
    .slice(0, 8)

  const examplesText = sampled.length > 0
    ? `\nEjemplos previos del usuario:\n${sampled
        .map(e => `- "${e.descripcion}" (${e.tipo}, $${e.monto}) → ${e.categoria}`)
        .join('\n')}\n`
    : ''

  const categoriasText = cats
    .map(c => `- ${c.nombre} (grupo: ${c.grupo})`)
    .join('\n')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bancoNombre = (mov.bancos as any)?.nombre ?? 'Desconocido'
  const prompt = `Eres un clasificador de movimientos financieros personales colombianos.

Categorías disponibles del usuario:
${categoriasText}
${examplesText}
Movimiento a clasificar:
- Descripción: "${mov.descripcion}"
- Tipo: ${mov.tipo}
- Monto: $${mov.monto} COP
- Flujo: ${mov.flujo === 'in' ? 'entrada/ingreso' : 'salida/gasto'}
- Banco: ${bancoNombre}

Devuelve JSON con la categoría más probable (nombre exacto de la lista) y tu confianza:
{"categoria": "nombre exacto", "confianza": 0-100}`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Eres un clasificador experto de movimientos financieros colombianos. Respondes SOLO con JSON válido, sin texto adicional ni markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Groq HTTP ${res.status}` }, { status: 502 })
    }
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content ?? ''
    const jsonMatch = text.match(/\{[\s\S]+\}/)
    if (!jsonMatch) {
      return NextResponse.json({ suggestion: null, reason: 'No JSON in response' })
    }
    const parsed = JSON.parse(jsonMatch[0])
    const confianza = Number(parsed.confianza) || 0
    const raw = String(parsed.categoria ?? '').trim()
    const exists = cats.find(c => c.nombre.toLowerCase() === raw.toLowerCase())
    if (!exists) {
      return NextResponse.json({ suggestion: null, reason: `Invalid category: ${raw}` })
    }
    return NextResponse.json({
      suggestion: { categoria: exists.nombre, confianza },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
