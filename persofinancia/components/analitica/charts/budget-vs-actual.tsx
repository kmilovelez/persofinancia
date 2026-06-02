// persofinancia/components/analitica/charts/budget-vs-actual.tsx
'use client'
import { useChartColors } from '@/lib/analitica/colors'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import { groupByCategoria } from '@/lib/analitica/aggregations'
import type { Movimiento, Categoria, Presupuesto } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
  presupuestos: Presupuesto[]
}

interface Row {
  nombre: string
  icono: string
  gasto: number
  presupuesto: number
  pct: number
}

function mesesEnRango(movs: Movimiento[]): number {
  const meses = new Set(movs.map(m => m.fecha.slice(0, 7)))
  return Math.max(1, meses.size)
}

export function BudgetVsActual({ movimientos, categorias, presupuestos }: Props) {
  const colors = useChartColors()
  const gastos = movimientos.filter(m => m.flujo === 'out')

  if (presupuestos.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold mb-2">Gasto vs presupuesto</p>
        <ChartEmpty
          icon="🎯"
          title="Sin presupuestos definidos"
          description="Configura presupuestos en /config/presupuestos"
        />
      </div>
    )
  }

  const months = mesesEnRango(movimientos)
  const byCategoria = new Map(groupByCategoria(gastos).map(c => [c.categoria, c.total]))
  const catMap = new Map(categorias.map(c => [c.id, c]))

  const rows: Row[] = presupuestos
    .map(p => {
      const cat = catMap.get(p.categoria_id)
      if (!cat) return null
      const gasto = byCategoria.get(cat.nombre) ?? 0
      const budget = Number(p.monto) * months
      const pct = budget > 0 ? (gasto / budget) * 100 : 0
      return { nombre: cat.nombre, icono: cat.icono, gasto, presupuesto: budget, pct }
    })
    .filter((r): r is Row => r !== null)
    .sort((a, b) => b.pct - a.pct)

  function barColor(pct: number): string {
    if (pct < 80) return colors.income
    if (pct < 100) return '#eab308'
    return colors.expense
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold">Gasto vs presupuesto</p>
      <p className="text-xs text-muted-foreground">
        Acumulado de {months} {months === 1 ? 'mes' : 'meses'} del rango actual
      </p>
      {rows.map(row => (
        <div key={row.nombre}>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="font-medium flex items-center gap-1">
              <span>{row.icono}</span>
              <span>{row.nombre}</span>
            </span>
            <span className="text-muted-foreground">
              {fmt(row.gasto)} / {fmt(row.presupuesto)} ({row.pct.toFixed(0)}%)
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.min(100, row.pct)}%`,
                backgroundColor: barColor(row.pct),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
