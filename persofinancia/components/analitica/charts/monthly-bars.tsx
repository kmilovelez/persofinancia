// persofinancia/components/analitica/charts/monthly-bars.tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByMes } from '@/lib/analitica/aggregations'
import { projectCurrentMonth } from '@/lib/analitica/projection'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  flujo: 'in' | 'out'
  title: string
}

export function MonthlyBars({ movimientos, flujo, title }: Props) {
  const colors = useChartColors()
  const byMes = groupByMes(movimientos)
  const currentMonth = new Date().toISOString().slice(0, 7)

  if (byMes.length === 0) {
    return <ChartEmpty icon="📊" title="Sin movimientos en el rango" />
  }

  const projection = projectCurrentMonth(movimientos, flujo, currentMonth, 3)
  const barColor = flujo === 'in' ? colors.income : colors.expense

  const data = byMes.map(m => {
    const value = flujo === 'in' ? m.ingresos : m.gastos
    if (m.mes === currentMonth) {
      return {
        mes: m.mes,
        actual: projection.actualToDate,
        projected: Math.max(0, projection.projected - projection.actualToDate),
      }
    }
    return { mes: m.mes, actual: value, projected: 0 }
  })

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            formatter={(v: unknown, name: unknown) => [fmt(Number(v)), name === 'actual' ? 'Real' : 'Proyectado']}
            labelFormatter={(label: unknown) => String(label)}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Bar dataKey="actual" stackId="a" fill={barColor} radius={[0, 0, 0, 0]} />
          <Bar dataKey="projected" stackId="a" fill={barColor} fillOpacity={0.35} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-2">
        Mes en curso: <span className="font-medium">{fmt(projection.actualToDate)}</span> real ·{' '}
        <span className="opacity-70">{fmt(projection.projected)}</span> proyectado
      </p>
    </div>
  )
}
