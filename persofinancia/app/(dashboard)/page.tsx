// persofinancia/app/(dashboard)/page.tsx
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { KpiCard } from '@/components/shared/kpi-card'
import { fmt } from '@/lib/utils/currency'
import { computeHealthScore, scoreLabel } from '@/lib/analitica/health-score'
import { HealthScoreCard } from '@/components/dashboard/health-score-card'

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const FIXED_GROUPS = ['Fijo']

async function getHealthScore(userId: string) {
  const supabase = await getSupabaseServerClient()
  const today = new Date()
  // Use last 30 days for current score
  const start = new Date(today)
  start.setDate(start.getDate() - 29)

  // Fetch movs + categories to know which are 'Fijo' group
  const [movsRes, catsRes] = await Promise.all([
    supabase
      .from('movimientos')
      .select('fecha, flujo, monto, categoria')
      .eq('user_id', userId)
      .gte('fecha', isoDate(start))
      .lte('fecha', isoDate(today)),
    supabase
      .from('categorias')
      .select('nombre, grupo')
      .eq('user_id', userId),
  ])

  const movs = (movsRes.data ?? []) as Array<{ fecha: string; flujo: string; monto: number; categoria: string | null }>
  const cats = (catsRes.data ?? []) as Array<{ nombre: string; grupo: string }>
  const catGrupo: Record<string, string> = {}
  for (const c of cats) {
    catGrupo[c.nombre] = c.grupo
  }

  const ingresos = movs.filter(m => m.flujo === 'in').reduce((s, m) => s + Number(m.monto), 0)
  const gastos_total = movs.filter(m => m.flujo === 'out').reduce((s, m) => s + Number(m.monto), 0)
  const gastos_deuda = movs.filter(m => m.flujo === 'out' && m.categoria === 'Deuda').reduce((s, m) => s + Number(m.monto), 0)
  const gastos_fijos = movs.filter(m => m.flujo === 'out' && m.categoria && FIXED_GROUPS.includes(catGrupo[m.categoria])).reduce((s, m) => s + Number(m.monto), 0)

  // Variance: pull last 6 months of variable spend (not fijo, not deuda)
  const sixMonthsAgo = new Date(today)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const { data: histMovs } = await supabase
    .from('movimientos')
    .select('fecha, monto, categoria, flujo')
    .eq('user_id', userId)
    .eq('flujo', 'out')
    .gte('fecha', isoDate(sixMonthsAgo))
    .lt('fecha', isoDate(today))

  const histList = (histMovs ?? []) as Array<{ fecha: string; monto: number; categoria: string | null; flujo: string }>
  const monthly: Record<string, number> = {}
  for (const m of histList) {
    const cat = m.categoria
    if (!cat || cat === 'Deuda' || FIXED_GROUPS.includes(catGrupo[cat])) continue
    const k = m.fecha.slice(0, 7)
    monthly[k] = (monthly[k] ?? 0) + Number(m.monto)
  }
  const gastos_variables_por_mes = Object.values(monthly)

  return computeHealthScore({
    ingresos, gastos_total, gastos_deuda, gastos_fijos, gastos_variables_por_mes,
  })
}

async function getKpis(userId: string) {
  const supabase = await getSupabaseServerClient()
  // Rolling últimos 30 días (incluyendo hoy)
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 29)

  const { data } = await supabase
    .from('movimientos')
    .select('flujo, monto')
    .eq('user_id', userId)
    .gte('fecha', isoDate(start))
    .lte('fecha', isoDate(today))

  const movs = (data ?? []) as { flujo: string; monto: number }[]
  const ingresos = movs
    .filter((m) => m.flujo === 'in')
    .reduce((s, m) => s + Number(m.monto), 0)
  const gastos = movs
    .filter((m) => m.flujo === 'out')
    .reduce((s, m) => s + Number(m.monto), 0)
  const balance = ingresos - gastos
  const ahorro =
    ingresos > 0 ? ((balance / ingresos) * 100).toFixed(1) : '0'

  return { ingresos, gastos, balance, ahorro }
}

export default async function InicioPage() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('nombre')
    .eq('user_id', user.id)
    .single()
  const profile = profileData as { nombre: string } | null

  const [kpis, healthScore] = await Promise.all([
    getKpis(user.id),
    getHealthScore(user.id),
  ])

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = profile?.nombre?.split(' ')[0] ?? ''

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h1 className="text-xl font-bold">
          {greeting}{firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <p className="text-muted-foreground text-sm">Últimos 30 días</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Ingresos" value={fmt(kpis.ingresos)} positive={true} />
        <KpiCard label="Gastos" value={fmt(kpis.gastos)} positive={false} />
        <KpiCard
          label="Balance"
          value={fmt(kpis.balance)}
          positive={kpis.balance >= 0}
          highlight
        />
        <KpiCard
          label="Tasa de ahorro"
          value={`${kpis.ahorro}%`}
          positive={Number(kpis.ahorro) >= 0}
        />
      </div>

      <HealthScoreCard score={healthScore} label={scoreLabel(healthScore.total)} />
    </div>
  )
}
