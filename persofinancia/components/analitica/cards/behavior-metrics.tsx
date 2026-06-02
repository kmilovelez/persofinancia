// persofinancia/components/analitica/cards/behavior-metrics.tsx
import { fmt } from '@/lib/utils/currency'
import { groupByMes } from '@/lib/analitica/aggregations'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  currentMonth: string
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, x) => s + x, 0) / arr.length
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1)
  return Math.sqrt(variance)
}

export function BehaviorMetrics({ movimientos, currentMonth }: Props) {
  const byMes = groupByMes(movimientos).filter(m => m.mes < currentMonth)
  const ingresos = byMes.map(m => m.ingresos)
  const gastos = byMes.map(m => m.gastos)

  const avgIngresos = mean(ingresos)
  const avgGastos = mean(gastos)
  const volatilidad = std(gastos)
  const tasaAhorro = avgIngresos > 0 ? ((avgIngresos - avgGastos) / avgIngresos) * 100 : 0

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-card border border-border rounded-xl p-3">
        <p className="text-xs text-muted-foreground uppercase">Ingreso prom/mes</p>
        <p className="text-lg font-bold text-green-500 mt-1">{fmt(avgIngresos)}</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-3">
        <p className="text-xs text-muted-foreground uppercase">Gasto prom/mes</p>
        <p className="text-lg font-bold text-red-500 mt-1">{fmt(avgGastos)}</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-3">
        <p className="text-xs text-muted-foreground uppercase">Volatilidad</p>
        <p className="text-lg font-bold mt-1">{fmt(volatilidad)}</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-3">
        <p className="text-xs text-muted-foreground uppercase">Tasa de ahorro</p>
        <p className={`text-lg font-bold mt-1 ${tasaAhorro >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {tasaAhorro.toFixed(1)}%
        </p>
      </div>
    </div>
  )
}
