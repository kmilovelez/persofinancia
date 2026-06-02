// persofinancia/components/analitica/charts/cashflow-combo.tsx
'use client'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByMes } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function CashflowCombo({ movimientos }: Props) {
  const colors = useChartColors()
  const data = groupByMes(movimientos)

  if (data.length === 0) {
    return <ChartEmpty icon="🌊" title="Sin datos para mostrar flujo" />
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Ingresos vs Gastos vs Neto</p>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data}>
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            formatter={(v: unknown) => fmt(Number(v))}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="ingresos" fill={colors.income} radius={[4, 4, 0, 0]} />
          <Bar dataKey="gastos" fill={colors.expense} radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="neto" stroke={colors.primary} strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
