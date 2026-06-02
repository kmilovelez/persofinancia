// persofinancia/components/analitica/charts/daily-cumulative.tsx
'use client'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { dailyCumulative } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function DailyCumulative({ movimientos }: Props) {
  const colors = useChartColors()
  const currentMonth = new Date().toISOString().slice(0, 7)
  const today = new Date().getDate()

  const data = dailyCumulative(movimientos, currentMonth).slice(0, today)

  if (data.every(d => d.cumulative === 0)) {
    return <ChartEmpty icon="📆" title="Sin gastos este mes" />
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Gasto acumulado del mes</p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.expense} stopOpacity={0.5} />
              <stop offset="100%" stopColor={colors.expense} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: colors.text }} />
          <YAxis tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            formatter={(v: unknown) => fmt(Number(v))}
            labelFormatter={(d: unknown) => `Día ${d}`}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={colors.expense}
            strokeWidth={2}
            fill="url(#cumulativeGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
