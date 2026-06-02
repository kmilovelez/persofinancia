// persofinancia/components/analitica/tabs/gastos-tab.tsx
import { CategoryDonut } from '../charts/category-donut'
import { TopMerchantsBar } from '../charts/top-merchants-bar'
import { MonthlyBars } from '../charts/monthly-bars'
import { CategoryTrendLine } from '../charts/category-trend-line'
import { DailyCumulative } from '../charts/daily-cumulative'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function GastosTab({ movimientos }: Props) {
  return (
    <div className="space-y-4">
      <CategoryDonut movimientos={movimientos} flujo="out" />
      <TopMerchantsBar movimientos={movimientos} />
      <MonthlyBars movimientos={movimientos} flujo="out" title="Gastos por mes" />
      <CategoryTrendLine movimientos={movimientos} />
      <DailyCumulative movimientos={movimientos} />
    </div>
  )
}
