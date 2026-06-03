// persofinancia/app/(dashboard)/page.tsx
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { KpiCard } from '@/components/shared/kpi-card'
import { fmt } from '@/lib/utils/currency'

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

  const kpis = await getKpis(user.id)

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
    </div>
  )
}
