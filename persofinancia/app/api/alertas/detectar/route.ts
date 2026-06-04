// persofinancia/app/api/alertas/detectar/route.ts
//
// Run detection rules against the user's data and create alerts.
// Called:
// - After every sync (manual or cron)
// - Manually via UI button
//
// Rules implemented:
// 1. Movimiento atípico: monto > 3x el promedio de su categoría en los últimos 90 días
// 2. Presupuesto en alerta: gasto del mes ≥ 80% del presupuesto mensual
// 3. Presupuesto excedido: gasto del mes > 100% del presupuesto mensual
// 4. Movimientos duplicados sospechosos: mismo monto + descripción en ventana de 10 min
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any
import { getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface AlertInsert {
  user_id: string
  tipo: string
  titulo: string
  mensaje: string
  severidad: 'info' | 'warning' | 'danger'
  movimiento_id?: string | null
  metadata?: Record<string, unknown>
}

async function detectarParaUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ created: number; alerts: AlertInsert[] }> {
  const alerts: AlertInsert[] = []
  const today = new Date()
  const isoToday = today.toISOString().slice(0, 10)
  const isoMonth = isoToday.slice(0, 7)
  const monthStart = `${isoMonth}-01`
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const monthEnd = `${isoMonth}-${String(lastDay).padStart(2, '0')}`
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const isoNinetyAgo = ninetyDaysAgo.toISOString().slice(0, 10)

  // ─────────── REGLA 1: Movimiento atípico ───────────
  // Pull movs from yesterday + today (recently synced) and check vs 90-day category avg
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const isoYesterday = yesterday.toISOString().slice(0, 10)

  const { data: recientes } = await supabase
    .from('movimientos')
    .select('id, fecha, descripcion, monto, categoria, flujo')
    .eq('user_id', userId)
    .eq('flujo', 'out')
    .not('categoria', 'is', null)
    .gte('fecha', isoYesterday)
    .lte('fecha', isoToday)

  if (recientes && recientes.length > 0) {
    // Compute 90-day average per category
    const { data: historico } = await supabase
      .from('movimientos')
      .select('categoria, monto')
      .eq('user_id', userId)
      .eq('flujo', 'out')
      .not('categoria', 'is', null)
      .gte('fecha', isoNinetyAgo)
      .lt('fecha', isoYesterday)

    const histList = (historico ?? []) as Array<{ categoria: string; monto: number }>
    const avgPorCategoria: Record<string, { total: number; count: number }> = {}
    for (const m of histList) {
      const k = m.categoria
      if (!avgPorCategoria[k]) avgPorCategoria[k] = { total: 0, count: 0 }
      avgPorCategoria[k].total += Number(m.monto)
      avgPorCategoria[k].count++
    }

    const recientesList = recientes as Array<{ id: string; fecha: string; descripcion: string; monto: number; categoria: string; flujo: string }>
    for (const r of recientesList) {
      const cat = r.categoria
      const agg = avgPorCategoria[cat]
      if (!agg || agg.count < 3) continue // skip if not enough history
      const avg = agg.total / agg.count
      if (Number(r.monto) > avg * 3) {
        alerts.push({
          user_id: userId,
          tipo: 'movimiento_atipico',
          severidad: 'warning',
          titulo: `Gasto atípico en ${cat}`,
          mensaje: `$${Math.round(Number(r.monto)).toLocaleString('es-CO')} en "${r.descripcion}" — 3× tu promedio ($${Math.round(avg).toLocaleString('es-CO')})`,
          movimiento_id: r.id,
          metadata: { monto: Number(r.monto), promedio: avg, multiplo: Number((Number(r.monto) / avg).toFixed(1)) },
        })
      }
    }
  }

  // ─────────── REGLAS 2 + 3: Presupuestos ───────────
  const { data: presupuestos } = await supabase
    .from('presupuestos')
    .select('categoria, monto_mensual')
    .eq('user_id', userId)

  if (presupuestos && presupuestos.length > 0) {
    const { data: gastosMes } = await supabase
      .from('movimientos')
      .select('categoria, monto')
      .eq('user_id', userId)
      .eq('flujo', 'out')
      .gte('fecha', monthStart)
      .lte('fecha', monthEnd)

    const gastosMesList = (gastosMes ?? []) as Array<{ categoria: string | null; monto: number }>
    const gastosPorCat: Record<string, number> = {}
    for (const g of gastosMesList) {
      if (!g.categoria) continue
      gastosPorCat[g.categoria] = (gastosPorCat[g.categoria] ?? 0) + Number(g.monto)
    }

    const presupuestosList = presupuestos as Array<{ categoria: string; monto_mensual: number }>
    for (const p of presupuestosList) {
      const gastado = gastosPorCat[p.categoria] ?? 0
      const presupuesto = Number(p.monto_mensual)
      const pct = (gastado / presupuesto) * 100

      if (pct > 100) {
        alerts.push({
          user_id: userId,
          tipo: 'presupuesto_excedido',
          severidad: 'danger',
          titulo: `Presupuesto excedido: ${p.categoria}`,
          mensaje: `Gastaste $${Math.round(gastado).toLocaleString('es-CO')} de $${Math.round(presupuesto).toLocaleString('es-CO')} (${Math.round(pct)}%)`,
          metadata: { categoria: p.categoria, gastado, presupuesto, porcentaje: Math.round(pct) },
        })
      } else if (pct >= 80) {
        alerts.push({
          user_id: userId,
          tipo: 'presupuesto_alerta',
          severidad: 'warning',
          titulo: `Cerca del presupuesto: ${p.categoria}`,
          mensaje: `Llevas $${Math.round(gastado).toLocaleString('es-CO')} de $${Math.round(presupuesto).toLocaleString('es-CO')} (${Math.round(pct)}%)`,
          metadata: { categoria: p.categoria, gastado, presupuesto, porcentaje: Math.round(pct) },
        })
      }
    }
  }

  // ─────────── REGLA 4: Duplicados sospechosos ───────────
  // Same monto + descripcion within 10 min
  const { data: posibles } = await supabase
    .from('movimientos')
    .select('id, fecha, hora, descripcion, monto')
    .eq('user_id', userId)
    .gte('fecha', isoYesterday)
    .lte('fecha', isoToday)
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true })

  const posiblesList = (posibles ?? []) as Array<{ id: string; fecha: string; hora: string; descripcion: string; monto: number }>
  if (posiblesList.length > 1) {
    for (let i = 1; i < posiblesList.length; i++) {
      const prev = posiblesList[i - 1]
      const curr = posiblesList[i]
      if (
        prev.descripcion === curr.descripcion &&
        Number(prev.monto) === Number(curr.monto) &&
        prev.fecha === curr.fecha
      ) {
        // Same minute → high suspicion
        if (prev.hora === curr.hora) {
          alerts.push({
            user_id: userId,
            tipo: 'duplicado_sospechoso',
            severidad: 'info',
            titulo: 'Posible cobro duplicado',
            mensaje: `2 cargos idénticos: "${curr.descripcion}" $${Math.round(Number(curr.monto)).toLocaleString('es-CO')} a las ${curr.hora}`,
            movimiento_id: curr.id,
            metadata: { mov_anterior: prev.id, mov_actual: curr.id },
          })
        }
      }
    }
  }

  // ─────────── REGLA 5: Pago próximo (compromisos bancarios) ───────────
  const { data: compromisos } = await supabase
    .from('compromisos')
    .select('id, entidad, producto, cuota_mensual, dia_pago, estado')
    .eq('user_id', userId)
    .in('estado', ['al_dia','mora','congelada'])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const compList = (compromisos ?? []) as Array<any>
  for (const c of compList) {
    if (!c.dia_pago) continue
    const todayDate = today.getDate()
    const diaPago = Number(c.dia_pago)
    // Días hasta el próximo pago (en este mes o el siguiente)
    let diasHasta: number
    if (diaPago >= todayDate) {
      diasHasta = diaPago - todayDate
    } else {
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      diasHasta = (lastDay - todayDate) + diaPago
    }
    if (diasHasta <= 3 && diasHasta >= 0) {
      const sev: 'info' | 'warning' | 'danger' = diasHasta <= 1 ? 'danger' : diasHasta <= 2 ? 'warning' : 'info'
      const cuotaFmt = `$${Math.round(Number(c.cuota_mensual)).toLocaleString('es-CO')}`
      alerts.push({
        user_id: userId,
        tipo: 'pago_proximo',
        severidad: sev,
        titulo: `${diasHasta === 0 ? '⏰ HOY' : `Próximo pago en ${diasHasta} día${diasHasta === 1 ? '' : 's'}`}: ${c.entidad}`,
        mensaje: `${c.producto} · ${cuotaFmt} · vence día ${diaPago}`,
        metadata: { compromiso_id: c.id, dias_hasta: diasHasta, cuota: Number(c.cuota_mensual) },
      })
    }
  }

  // ─────────── REGLA 6: Carga financiera del mes > 50% del ingreso ───────────
  const totalCuotas = compList.reduce((s, c) => s + Number(c.cuota_mensual ?? 0), 0)
  if (totalCuotas > 0) {
    const { data: ingresosMes } = await supabase
      .from('movimientos')
      .select('monto')
      .eq('user_id', userId)
      .eq('flujo', 'in')
      .eq('categoria', 'Nómina Matec')
      .gte('fecha', monthStart)
      .lte('fecha', monthEnd)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ingList = (ingresosMes ?? []) as Array<any>
    const totalIngresoMes = ingList.reduce((s, m) => s + Number(m.monto), 0)
    if (totalIngresoMes > 0) {
      const pct = (totalCuotas / totalIngresoMes) * 100
      if (pct > 50) {
        alerts.push({
          user_id: userId,
          tipo: 'carga_financiera',
          severidad: pct > 70 ? 'danger' : 'warning',
          titulo: `Carga financiera alta: ${Math.round(pct)}% del ingreso`,
          mensaje: `Tus cuotas mensuales ($${Math.round(totalCuotas).toLocaleString('es-CO')}) son el ${Math.round(pct)}% de tu nómina ($${Math.round(totalIngresoMes).toLocaleString('es-CO')}). Recomendado: < 35%.`,
          metadata: { cuotas: totalCuotas, ingreso: totalIngresoMes, porcentaje: Math.round(pct) },
        })
      }
    }
  }

  // Dedup: don't insert alerts whose (user_id, tipo, movimiento_id) already exist
  const inserted: AlertInsert[] = []
  for (const a of alerts) {
    let q = supabase
      .from('alertas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', a.user_id)
      .eq('tipo', a.tipo)
    if (a.movimiento_id) q = q.eq('movimiento_id', a.movimiento_id)
    else q = q.eq('titulo', a.titulo)  // for budget alerts, dedup by title (1 per categoria per month)
    const { count } = await q
    if ((count ?? 0) === 0) inserted.push(a)
  }

  if (inserted.length > 0) {
    await supabase.from('alertas').insert(
      inserted.map(a => ({
        user_id: a.user_id,
        tipo: a.tipo,
        titulo: a.titulo,
        mensaje: a.mensaje,
        severidad: a.severidad,
        movimiento_id: a.movimiento_id ?? null,
        metadata: a.metadata ?? null,
      })),
    )
  }

  return { created: inserted.length, alerts: inserted }
}

export async function POST(req: Request) {
  // Two modes:
  // 1. Called from logged-in user (uses session)
  // 2. Called from cron with service role + user_id in body
  const body = await req.json().catch(() => ({}))

  let supabase: SupabaseClient
  let userId: string

  if (body.user_id) {
    // Service role mode (cron)
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: 'Missing service env vars' }, { status: 500 })
    }
    // Verify CRON_SECRET if present
    const auth = req.headers.get('authorization')
    const expected = process.env.CRON_SECRET
    if (expected && auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    userId = body.user_id
  } else {
    // Session mode
    supabase = await getSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id
  }

  const result = await detectarParaUser(supabase, userId)
  return NextResponse.json(result)
}
