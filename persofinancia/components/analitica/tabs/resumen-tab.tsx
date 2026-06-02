// persofinancia/components/analitica/tabs/resumen-tab.tsx
import { KpiCard } from '@/components/shared/kpi-card'
import { BehaviorMetrics } from '../cards/behavior-metrics'
import { Allocation503020 } from '../charts/allocation-50-30-20'
import { AllocationByGrupo } from '../charts/allocation-by-grupo'
import { sumByFlujo } from '@/lib/analitica/aggregations'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento, Categoria } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
}

export function ResumenTab({ movimientos, categorias }: Props) {
  const ingresos = sumByFlujo(movimientos, 'in')
  const gastos = sumByFlujo(movimientos, 'out')
  const balance = ingresos - gastos
  const tasaAhorro = ingresos > 0 ? ((balance / ingresos) * 100).toFixed(1) : '0'
  const currentMonth = new Date().toISOString().slice(0, 7)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Ingresos" value={fmt(ingresos)} positive={true} />
        <KpiCard label="Gastos" value={fmt(gastos)} positive={false} />
        <KpiCard label="Balance" value={fmt(balance)} positive={balance >= 0} highlight />
        <KpiCard label="Ahorro" value={`${tasaAhorro}%`} positive={Number(tasaAhorro) >= 0} />
      </div>
      <Allocation503020 movimientos={movimientos} categorias={categorias} />
      <AllocationByGrupo movimientos={movimientos} categorias={categorias} />
      <BehaviorMetrics movimientos={movimientos} currentMonth={currentMonth} />
    </div>
  )
}
