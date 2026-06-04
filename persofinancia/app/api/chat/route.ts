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
      description: 'Consulta movimientos del usuario con filtros. Devuelve total, conteo y los 10 más relevantes. Útil para "cuánto gasté en X" o "movimientos de Y". Parámetro `grupo` filtra por categorías de un grupo: Fijo (arriendo, deuda, servicios, suscripciones, doméstico, educación), Variable (mercado, transporte, compras, etc.), Negocio (costo café), Ingreso.',
      parameters: {
        type: 'object',
        properties: {
          categoria: { type: 'string', description: 'Nombre exacto de categoría (e.g. "Transporte"). Opcional.' },
          grupo: { type: 'string', enum: ['Fijo','Variable','Negocio','Ingreso','Ahorro'], description: 'Grupo de categorías. Usar "Fijo" para PAGOS FIJOS (arriendo, deuda, servicios, etc).' },
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
      name: 'get_compromisos',
      description: 'Lista los compromisos bancarios del usuario (créditos, tarjetas, préstamos). Cada uno tiene: entidad, producto, saldo_actual, cuota_mensual, dia_pago, tasa_ea, cuotas_total/pagadas, estado. Útil para "cuáles son mis deudas", "cuándo es mi próximo pago", "carga financiera total".',
      parameters: { type: 'object', properties: {} },
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
  {
    type: 'function',
    function: {
      name: 'create_movimiento',
      description: 'Crea un nuevo movimiento manual (gasto o ingreso). SOLO llamar después de confirmación explícita del usuario.',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'YYYY-MM-DD. Si el usuario dice "hoy", usa la fecha actual.' },
          monto: { type: 'number', description: 'Monto en COP (positivo)' },
          flujo: { type: 'string', enum: ['in','out'], description: 'in=ingreso, out=gasto' },
          descripcion: { type: 'string', description: 'Descripción del movimiento (ej. "Pago Addi BNPL")' },
          tipo: { type: 'string', description: 'Tipo: Pago, Compra, Transferencia, Ingreso, etc.' },
          categoria: { type: 'string', description: 'Nombre exacto de la categoría del usuario (opcional)' },
        },
        required: ['fecha','monto','flujo','descripcion','tipo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_compromiso',
      description: 'Actualiza un compromiso bancario existente (saldo, cuotas pagadas, estado). SOLO llamar tras confirmación.',
      parameters: {
        type: 'object',
        properties: {
          entidad: { type: 'string', description: 'Nombre de la entidad (ej. "SUFI", "Lulo Bank")' },
          saldo_actual: { type: 'number', description: 'Nuevo saldo total. Opcional.' },
          cuotas_pagadas: { type: 'number', description: 'Nuevo número de cuotas pagadas. Opcional.' },
          estado: { type: 'string', enum: ['al_dia','mora','congelada','liquidado'], description: 'Nuevo estado. Opcional.' },
          cuota_mensual: { type: 'number', description: 'Nueva cuota mensual. Opcional.' },
        },
        required: ['entidad'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_regla',
      description: 'Crea una nueva regla de categorización automática y la aplica a movimientos sin categoría. SOLO tras confirmación.',
      parameters: {
        type: 'object',
        properties: {
          patron: { type: 'string', description: 'Texto a buscar en descripción (ILIKE %patron%)' },
          categoria: { type: 'string', description: 'Nombre exacto de categoría a asignar' },
        },
        required: ['patron','categoria'],
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
      // If filtering by grupo, first resolve the list of categorias del grupo
      let categoriasDelGrupo: string[] | null = null
      if (args.grupo) {
        const { data: catsRes } = await supabase
          .from('categorias')
          .select('nombre')
          .eq('user_id', userId)
          .eq('grupo', args.grupo)
        categoriasDelGrupo = ((catsRes ?? []) as Array<{ nombre: string }>).map(c => c.nombre)
      }
      let q = supabase
        .from('movimientos')
        .select('fecha, descripcion, monto, categoria, flujo, tipo')
        .eq('user_id', userId)
      if (args.categoria) q = q.eq('categoria', args.categoria)
      if (categoriasDelGrupo && categoriasDelGrupo.length > 0) q = q.in('categoria', categoriasDelGrupo)
      if (args.fecha_desde) q = q.gte('fecha', args.fecha_desde)
      if (args.fecha_hasta) q = q.lte('fecha', args.fecha_hasta)
      if (args.flujo) q = q.eq('flujo', args.flujo)
      if (args.texto_descripcion) q = q.ilike('descripcion', `%${args.texto_descripcion}%`)
      const { data } = await q.order('fecha', { ascending: false }).limit(500)
      const rows = (data ?? []) as Array<{ fecha: string; descripcion: string; monto: number; categoria: string | null; flujo: string; tipo: string }>
      const total = rows.reduce((s: number, r) => s + Number(r.monto), 0)
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
      const list = (data ?? []) as Array<{ categoria: string; monto: number; flujo: string }>
      const agg: Record<string, { total: number; count: number; flujo: string }> = {}
      for (const r of list) {
        const k = r.categoria
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
    case 'create_movimiento': {
      const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const payload = {
        id,
        user_id: userId,
        fecha: args.fecha,
        hora: '00:00',
        tipo: String(args.tipo ?? 'Pago'),
        flujo: args.flujo === 'in' ? 'in' : 'out',
        monto: Math.abs(Number(args.monto) || 0),
        descripcion: String(args.descripcion ?? '').toUpperCase(),
        categoria: args.categoria ? String(args.categoria) : null,
        categoria_manual: !!args.categoria,
        origen: 'manual',
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('movimientos') as any).insert(payload)
      if (error) return { ok: false, error: error.message }
      return { ok: true, id, mensaje: `Movimiento creado: ${payload.descripcion} · $${payload.monto.toLocaleString('es-CO')} · ${payload.fecha}` }
    }
    case 'update_compromiso': {
      // Find by entidad (fuzzy)
      const { data: matches } = await supabase
        .from('compromisos')
        .select('id, entidad, producto')
        .eq('user_id', userId)
        .ilike('entidad', `%${args.entidad}%`)
      const matchList = (matches ?? []) as Array<{ id: string; entidad: string; producto: string }>
      if (matchList.length === 0) return { ok: false, error: `No encontré compromiso con entidad "${args.entidad}"` }
      if (matchList.length > 1) return { ok: false, error: `Hay varios compromisos que matchean "${args.entidad}": ${matchList.map(m => m.entidad + ' ' + m.producto).join(', ')}. Sé más específico.` }
      const target = matchList[0]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const update: Record<string, any> = { updated_at: new Date().toISOString() }
      if (args.saldo_actual != null) update.saldo_actual = Number(args.saldo_actual)
      if (args.cuotas_pagadas != null) update.cuotas_pagadas = Number(args.cuotas_pagadas)
      if (args.estado) update.estado = args.estado
      if (args.cuota_mensual != null) update.cuota_mensual = Number(args.cuota_mensual)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('compromisos') as any).update(update).eq('id', target.id).eq('user_id', userId)
      if (error) return { ok: false, error: error.message }
      return { ok: true, mensaje: `Compromiso ${target.entidad} ${target.producto} actualizado.` }
    }
    case 'create_regla': {
      // Resolve categoria_id
      const { data: catRaw } = await supabase
        .from('categorias')
        .select('id, nombre')
        .eq('user_id', userId)
        .eq('nombre', args.categoria)
        .maybeSingle()
      const cat = catRaw as { id: string; nombre: string } | null
      if (!cat) return { ok: false, error: `Categoría "${args.categoria}" no existe. Categorías válidas: usa get_categorias.` }
      // Insert rule
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rule, error: rErr } = await (supabase.from('reglas_categoria') as any).insert({
        user_id: userId,
        categoria_id: cat.id,
        campo: 'descripcion',
        operador: 'contains',
        valor: String(args.patron).toUpperCase(),
        prioridad: 25,
        activa: true,
        origen: 'manual',
      }).select('id').single()
      if (rErr || !rule) return { ok: false, error: rErr?.message ?? 'No se pudo crear regla' }
      // Apply to existing NULL movs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: applied } = await (supabase.from('movimientos') as any)
        .update({ categoria: cat.nombre, regla_aplicada: rule.id })
        .eq('user_id', userId)
        .is('categoria', null)
        .ilike('descripcion', `%${args.patron}%`)
        .select('id')
      const appliedCount = (applied as Array<unknown>)?.length ?? 0
      return { ok: true, mensaje: `Regla creada: "${args.patron}" → ${cat.nombre}. Se aplicó a ${appliedCount} movimiento${appliedCount === 1 ? '' : 's'} existente${appliedCount === 1 ? '' : 's'}.` }
    }
    case 'get_compromisos': {
      const { data } = await supabase
        .from('compromisos')
        .select('entidad, producto, tipo, saldo_actual, cuota_mensual, tasa_ea, dia_pago, cuotas_total, cuotas_pagadas, estado, notas')
        .eq('user_id', userId)
        .order('dia_pago', { ascending: true })
      const rows = (data ?? []) as Array<{ entidad: string; producto: string; tipo: string; saldo_actual: number; cuota_mensual: number; tasa_ea: number | null; dia_pago: number | null; cuotas_total: number | null; cuotas_pagadas: number | null; estado: string; notas: string | null }>
      const totalSaldo = rows.filter(r => r.estado !== 'liquidado').reduce((s, r) => s + Number(r.saldo_actual), 0)
      const totalCuota = rows.filter(r => r.estado !== 'liquidado').reduce((s, r) => s + Number(r.cuota_mensual), 0)
      return {
        count: rows.length,
        total_saldo: totalSaldo,
        total_cuota_mensual: totalCuota,
        compromisos: rows,
      }
    }
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

const SYSTEM_PROMPT = `Asistente financiero personal en español colombiano. Hoy: ${new Date().toISOString().slice(0, 10)}.

REGLAS:
- USA herramientas siempre. Nunca inventes.
- Montos: $1.234.567 (sin M/K).
- Sé conciso.
- "este mes" = día 1 al hoy. "mes pasado" = mes anterior completo.

HERRAMIENTAS DE LECTURA:
- query_movimientos: gastos/movs REALES ya ejecutados. Usa grupo='Fijo' para filtrar fijos pasados.
- get_compromisos: deudas/créditos/tarjetas con saldo, cuota mensual, día de pago.
- get_presupuestos: monto presupuestado por categoría vs lo gastado este mes.
- get_categorias: gasto total por categoría en un rango.
- get_top_gastos: top N gastos más grandes en un rango.

HERRAMIENTAS DE ESCRITURA (mutables — SIEMPRE PEDIR CONFIRMACIÓN PRIMERO):
- create_movimiento: crea un movimiento manual (pago, ingreso, transferencia)
- update_compromiso: actualiza saldo/cuotas/estado de un compromiso bancario
- create_regla: crea regla de categorización automática

PROTOCOLO PARA MUTACIONES:
1. Cuando el usuario pida crear/modificar algo, NO llames la tool inmediatamente.
2. Resume claramente qué vas a hacer: "Voy a crear: descripción=X, monto=$Y, fecha=Z, categoría=W. ¿Confirmas?"
3. Espera respuesta del usuario.
4. Si confirma ("sí", "confirma", "dale", "ok"), llama la tool.
5. Si dice algo diferente, ajusta y vuelve a confirmar.

CRÍTICO: "gastos fijos del mes X" / "qué debo pagar" / "costos fijos a pagar" = lo que TIENE que pagar (NO lo ya gastado). Para esto:
1. Llama get_compromisos (todas las cuotas mensuales)
2. Llama get_presupuestos (las de grupo Fijo: Arriendo, Servicio Doméstico, Educación Hijo, Suscripciones/Tech, Pagos/Servicios)
3. Suma ambos y desglosa cada ítem en la respuesta.

Si pregunta "cuánto gasté en X" (pasado), usa query_movimientos.`

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

  // Helper: call Groq with retry on 429 (rate limit)
  async function callGroq(): Promise<Response> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
      if (r.status !== 429) return r
      // Read retry-after header from body
      const txt = await r.clone().text()
      const m = txt.match(/try again in ([\d.]+)s/)
      const wait = m ? Math.min(Math.ceil(Number(m[1]) * 1000), 10000) : 5000
      await new Promise(res => setTimeout(res, wait))
    }
    // Final attempt without catching
    return fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages, tools: TOOLS, tool_choice: 'auto', temperature: 0.3, max_tokens: 1500,
      }),
    })
  }

  // Up to 4 iterations of tool calls
  for (let i = 0; i < 4; i++) {
    const res = await callGroq()

    if (!res.ok) {
      const errText = await res.text()
      // Friendlier message for rate limit
      if (res.status === 429) {
        return NextResponse.json({ error: 'Estoy un poco saturado. Intenta de nuevo en ~10 segundos.' }, { status: 429 })
      }
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
