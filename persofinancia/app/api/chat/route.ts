// persofinancia/app/api/chat/route.ts
//
// Chat IA endpoint: Groq Llama 3.3 70B with tool use against the user's financial data.
//
// Tools exposed to the model:
// - query_movimientos: Filter/aggregate movs by category, date range, banco, flujo
// - get_categorias: List all categories with totals
// - get_presupuestos: Current month budgets + actuals
// - get_top_gastos: Top N largest expenses in a period
//
// All tools are RLS-scoped to the authenticated user.
//
// POST /api/chat { messages: [{role, content}], persist?: boolean }
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'query_movimientos',
      description: 'Consulta movimientos del usuario con filtros. Devuelve total, conteo y los 10 más relevantes. Útil para "cuánto gasté en X" o "movimientos de Y".',
      parameters: {
        type: 'object',
        properties: {
          categoria: { type: 'string', description: 'Nombre exacto de categoría (e.g. "Transporte"). Opcional.' },
          fecha_desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD. Opcional.' },
          fecha_hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD. Opcional.' },
          flujo: { type: 'string', enum: ['in','out'], description: 'in=ingresos, out=gastos. Opcional.' },
          texto_descripcion: { type: 'string', description: 'Texto a buscar en descripción (ILIKE %texto%). Opcional.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_categorias',
      description: 'Lista todas las categorías del usuario con total gastado/ingresado en el periodo dado.',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
          fecha_hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
          flujo: { type: 'string', enum: ['in','out'] },
        },
        required: ['fecha_desde','fecha_hasta'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_presupuestos',
      description: 'Devuelve presupuestos del mes actual con consumo real (vs lo gastado).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_gastos',
      description: 'Top N gastos más grandes en un periodo.',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: { type: 'string', description: 'YYYY-MM-DD' },
          fecha_hasta: { type: 'string', description: 'YYYY-MM-DD' },
          limit: { type: 'number', description: 'Número de gastos a devolver (default 5, máx 20)' },
        },
        required: ['fecha_desde','fecha_hasta'],
      },
    },
  },
] as const

async function executeTool(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any,
): Promise<unknown> {
  switch (name) {
    case 'query_movimientos': {
      let q = supabase
        .from('movimientos')
        .select('fecha, descripcion, monto, categoria, flujo, tipo')
        .eq('user_id', userId)
      if (args.categoria) q = q.eq('categoria', args.categoria)
      if (args.fecha_desde) q = q.gte('fecha', args.fecha_desde)
      if (args.fecha_hasta) q = q.lte('fecha', args.fecha_hasta)
      if (args.flujo) q = q.eq('flujo', args.flujo)
      if (args.texto_descripcion) q = q.ilike('descripcion', `%${args.texto_descripcion}%`)
      const { data } = await q.order('fecha', { ascending: false }).limit(500)
      const rows = data ?? []
      const total = rows.reduce((s, r) => s + Number(r.monto), 0)
      return {
        count: rows.length,
        total_cop: total,
        sample: rows.slice(0, 10),
      }
    }
    case 'get_categorias': {
      let q = supabase
        .from('movimientos')
        .select('categoria, monto, flujo')
        .eq('user_id', userId)
        .gte('fecha', args.fecha_desde)
        .lte('fecha', args.fecha_hasta)
        .not('categoria', 'is', null)
      if (args.flujo) q = q.eq('flujo', args.flujo)
      const { data } = await q
      const agg: Record<string, { total: number; count: number; flujo: string }> = {}
      for (const r of data ?? []) {
        const k = r.categoria as string
        if (!agg[k]) agg[k] = { total: 0, count: 0, flujo: r.flujo }
        agg[k].total += Number(r.monto)
        agg[k].count++
      }
      return Object.entries(agg)
        .map(([cat, v]) => ({ categoria: cat, total_cop: v.total, movs: v.count, flujo: v.flujo }))
        .sort((a, b) => b.total_cop - a.total_cop)
    }
    case 'get_presupuestos': {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const monthStart = `${month}-01`
      const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`

      const [presupuestosRes, movsRes] = await Promise.all([
        supabase.from('presupuestos').select('categoria, monto_mensual').eq('user_id', userId),
        supabase.from('movimientos')
          .select('categoria, monto')
          .eq('user_id', userId)
          .eq('flujo', 'out')
          .gte('fecha', monthStart)
          .lte('fecha', monthEnd),
      ])

      const movsList = (movsRes.data ?? []) as Array<{ categoria: string | null; monto: number }>
      const presupuestosList = (presupuestosRes.data ?? []) as Array<{ categoria: string; monto_mensual: number }>
      const gastos: Record<string, number> = {}
      for (const m of movsList) {
        if (!m.categoria) continue
        gastos[m.categoria] = (gastos[m.categoria] ?? 0) + Number(m.monto)
      }

      return presupuestosList.map(p => ({
        categoria: p.categoria,
        presupuesto: Number(p.monto_mensual),
        gastado: gastos[p.categoria] ?? 0,
        porcentaje: Math.round(((gastos[p.categoria] ?? 0) / Number(p.monto_mensual)) * 100),
        excedido: (gastos[p.categoria] ?? 0) > Number(p.monto_mensual),
      }))
    }
    case 'get_top_gastos': {
      const limit = Math.min(args.limit ?? 5, 20)
      const { data } = await supabase
        .from('movimientos')
        .select('fecha, descripcion, monto, categoria')
        .eq('user_id', userId)
        .eq('flujo', 'out')
        .gte('fecha', args.fecha_desde)
        .lte('fecha', args.fecha_hasta)
        .order('monto', { ascending: false })
        .limit(limit)
      return data ?? []
    }
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

const SYSTEM_PROMPT = `Eres PersoFinancIA, asistente financiero personal del usuario. Hablas español colombiano natural, claro y útil.

Tu trabajo: responder preguntas sobre las finanzas personales del usuario usando las herramientas disponibles. SIEMPRE usa las herramientas para obtener datos reales — nunca inventes números.

Reglas:
- Montos en COP. Formatea con separadores (ej. $1.234.567 o $1,2M para millones)
- Hoy es ${new Date().toISOString().slice(0, 10)}
- Si el usuario dice "este mes", "mes actual" → desde el día 1 del mes en curso hasta hoy
- Si dice "el mes pasado" → todo el mes anterior
- Sé conciso pero útil. Si das una cifra, da contexto (ej. "vs el promedio histórico de X")
- Si no tienes datos para responder, dilo claramente. No inventes.
- Detecta intención: si pregunta "¿cuánto gasté?" usa query_movimientos. Si pregunta "¿en qué gasto más?" usa get_categorias.`

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY missing' }, { status: 500 })

  const body = await req.json()
  const userMessages = (body.messages ?? []) as Message[]
  const persist = body.persist !== false

  // Build conversation: system + history
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...userMessages,
  ]

  // Up to 4 iterations of tool calls
  for (let i = 0; i < 4; i++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 1500,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: `Groq error: ${errText}` }, { status: 502 })
    }

    const data = await res.json()
    const msg = data.choices?.[0]?.message
    if (!msg) {
      return NextResponse.json({ error: 'No response from model' }, { status: 502 })
    }

    // If the model called tools, execute them and loop
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push(msg)
      for (const tc of msg.tool_calls) {
        try {
          const args = JSON.parse(tc.function.arguments || '{}')
          const result = await executeTool(supabase, user.id, tc.function.name, args)
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(result),
          })
        } catch (e) {
          const msgErr = e instanceof Error ? e.message : String(e)
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify({ error: msgErr }),
          })
        }
      }
      continue
    }

    // Final assistant response
    const finalContent = msg.content ?? ''

    // Persist user's last message + assistant response
    if (persist) {
      const lastUserMsg = [...userMessages].reverse().find(m => m.role === 'user')
      if (lastUserMsg) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('chat_messages') as any).insert([
          { user_id: user.id, role: 'user', content: lastUserMsg.content },
          { user_id: user.id, role: 'assistant', content: finalContent },
        ])
      }
    }

    return NextResponse.json({ message: finalContent })
  }

  return NextResponse.json({ error: 'Max tool iterations reached' }, { status: 500 })
}

// Load chat history
export async function GET() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('user_id', user.id)
    .in('role', ['user','assistant'])
    .order('created_at', { ascending: true })
    .limit(100)

  return NextResponse.json({ messages: data ?? [] })
}
