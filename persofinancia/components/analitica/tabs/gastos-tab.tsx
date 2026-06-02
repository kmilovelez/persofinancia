// persofinancia/components/analitica/tabs/gastos-tab.tsx
import { CategoryDonut } from '../charts/category-donut'
import { TopMerchantsBar } from '../charts/top-merchants-bar'
import { MonthlyBars } from '../charts/monthly-bars'
import { CategoryTrendLine } from '../charts/category-trend-line'
import { BudgetVsActual } from '../charts/budget-vs-actual'
import { DailyCumulative } from '../charts/daily-cumulative'
import type { Movimiento, Categoria, Presupuesto } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
  presupuestos: Presupuesto[]
}

export function GastosTab({ movimientos, categorias, presupuestos }: Props) {
  return (
    <div className="space-y-4">
      <CategoryDonut movimientos={movimientos} flujo="out" />
      <TopMerchantsBar movimientos={movimientos} />
      <MonthlyBars movimientos={movimientos} flujo="out" title="Gastos por mes" />
      <CategoryTrendLine movimientos={movimientos} />
      <BudgetVsActual movimientos={movimientos} categorias={categorias} presupuestos={presupuestos} />
      <DailyCumulative movimientos={movimientos} />
    </div>
  )
}
