// persofinancia/components/analitica/charts/income-by-type-bar.tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByTipo } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function IncomeByTypeBar({ movimientos }: Props) {
  const colors = useChartColors()
  const data = groupByTipo(movimientos, 'in')

  if (data.length === 0) {
    return <ChartEmpty icon="💰" title="Sin ingresos en el rango" />
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Ingresos por tipo</p>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="tipo" width={140} tick={{ fontSize: 11, fill: colors.text }} />
          <Tooltip
            formatter={(v: unknown) => fmt(Number(v))}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Bar dataKey="total" radius={[0, 6, 6, 0]}>
            {data.map((_, i) => <Cell key={i} fill={colors.income} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
