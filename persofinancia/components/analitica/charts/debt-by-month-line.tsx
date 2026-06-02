// persofinancia/components/analitica/charts/debt-by-month-line.tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByMes } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function DebtByMonthLine({ movimientos }: Props) {
  const colors = useChartColors()
  const deudas = movimientos.filter(m => m.categoria === 'Deuda')

  if (deudas.length === 0) {
    return <ChartEmpty icon="🏦" title="Sin pagos de deuda en el rango" />
  }

  const data = groupByMes(deudas).map(m => ({ mes: m.mes, total: m.gastos }))

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Pagos a deuda por mes</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            formatter={(v: unknown) => fmt(Number(v))}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Line type="monotone" dataKey="total" stroke={colors.debt} strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
