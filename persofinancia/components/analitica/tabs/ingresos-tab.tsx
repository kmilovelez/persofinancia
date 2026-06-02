// persofinancia/components/analitica/tabs/ingresos-tab.tsx
import { KpiCard } from '@/components/shared/kpi-card'
import { MonthlyBars } from '../charts/monthly-bars'
import { IncomeByTypeBar } from '../charts/income-by-type-bar'
import { groupByMes } from '@/lib/analitica/aggregations'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function IngresosTab({ movimientos }: Props) {
  const byMes = groupByMes(movimientos)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const completed = byMes.filter(m => m.mes < currentMonth)
  const ingresos = completed.map(m => m.ingresos)
  const avg = ingresos.length > 0 ? ingresos.reduce((s, x) => s + x, 0) / ingresos.length : 0
  const max = ingresos.length > 0 ? Math.max(...ingresos) : 0
  const variance =
    ingresos.length > 1
      ? Math.sqrt(
          ingresos.reduce((s, x) => s + (x - avg) ** 2, 0) / (ingresos.length - 1)
        )
      : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <KpiCard label="Promedio" value={fmt(avg)} positive={true} />
        <KpiCard label="Máximo" value={fmt(max)} positive={true} />
        <KpiCard label="Varianza" value={fmt(variance)} />
      </div>
      <MonthlyBars movimientos={movimientos} flujo="in" title="Ingresos por mes" />
      <IncomeByTypeBar movimientos={movimientos} />
    </div>
  )
}
