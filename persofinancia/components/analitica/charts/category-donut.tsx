// persofinancia/components/analitica/charts/category-donut.tsx
'use client'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByCategoria, topNWithOthers, type CategoriaTotal } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  flujo?: 'in' | 'out'
}

export function CategoryDonut({ movimientos, flujo = 'out' }: Props) {
  const colors = useChartColors()
  const filtered = movimientos.filter(m => m.flujo === flujo)
  const grouped = groupByCategoria(filtered)
  const data = topNWithOthers<CategoriaTotal>(grouped, 8, 'categoria')

  if (data.length === 0) {
    return <ChartEmpty icon="🍕" title="Sin gastos categorizados" />
  }

  const total = data.reduce((s, d) => s + d.total, 0)

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Gastos por categoría</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="total" nameKey="categoria" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors.palette[i % colors.palette.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: unknown) => [fmt(Number(v)), `${((Number(v) / total) * 100).toFixed(0)}%`]}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
