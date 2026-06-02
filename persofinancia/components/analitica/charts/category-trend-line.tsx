// persofinancia/components/analitica/charts/category-trend-line.tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByCategoria } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

interface MonthPoint {
  mes: string
  [categoria: string]: number | string
}

export function CategoryTrendLine({ movimientos }: Props) {
  const colors = useChartColors()
  const gastos = movimientos.filter(m => m.flujo === 'out')

  const topCategorias = groupByCategoria(gastos).slice(0, 5).map(c => c.categoria)

  if (topCategorias.length === 0) {
    return <ChartEmpty icon="📈" title="Sin gastos categorizados" />
  }

  const monthMap = new Map<string, MonthPoint>()
  for (const m of gastos) {
    if (!m.categoria || !topCategorias.includes(m.categoria)) continue
    const mes = m.fecha.slice(0, 7)
    if (!monthMap.has(mes)) monthMap.set(mes, { mes })
    const point = monthMap.get(mes)!
    point[m.categoria] = (Number(point[m.categoria]) || 0) + Number(m.monto)
  }

  const data = Array.from(monthMap.values()).sort((a, b) =>
    (a.mes as string).localeCompare(b.mes as string)
  )

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Tendencia top 5 categorías</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            formatter={(v: unknown) => fmt(Number(v))}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {topCategorias.map((cat, i) => (
            <Line
              key={cat}
              type="monotone"
              dataKey={cat}
              stroke={colors.palette[i]}
              strokeWidth={2}
              dot={{ r: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
