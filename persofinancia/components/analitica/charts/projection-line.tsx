// persofinancia/components/analitica/charts/projection-line.tsx
'use client'
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByMes } from '@/lib/analitica/aggregations'
import { forecast } from '@/lib/analitica/regression'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  flujo: 'in' | 'out'
}

export function ProjectionLine({ movimientos, flujo }: Props) {
  const colors = useChartColors()
  const byMes = groupByMes(movimientos)
  const currentMonth = new Date().toISOString().slice(0, 7)

  const monthly = byMes.map(m => ({
    mes: m.mes,
    total: flujo === 'in' ? m.ingresos : m.gastos,
  }))

  const completed = monthly.filter(m => m.mes < currentMonth)

  if (completed.length < 3) {
    return (
      <ChartEmpty
        icon="🔮"
        title="Datos insuficientes"
        description="Se necesitan al menos 3 meses completos para proyectar"
      />
    )
  }

  const { points: projected, regression } = forecast(monthly, 3, currentMonth)

  const chartData = [
    ...completed.map(m => ({
      mes: m.mes,
      historico: m.total,
      proyectado: null as number | null,
      lo: null as number | null,
      hi: null as number | null,
    })),
    ...projected.map(p => ({
      mes: p.mes,
      historico: null,
      proyectado: p.predicted,
      lo: p.lo,
      hi: p.hi,
    })),
  ]

  const totalCompletado = completed.reduce((s, x) => s + x.total, 0)
  const avg = totalCompletado / completed.length
  const slope = regression.slope
  const slopePct = avg > 0 ? (slope / avg) * 100 : 0
  const volatilidad = regression.residualStd
  const volPct = avg > 0 ? (volatilidad / avg) * 100 : 0

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold">Proyección 3 meses ({flujo === 'in' ? 'Ingresos' : 'Gastos'})</p>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData}>
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            formatter={(v: unknown) => fmt(Number(v))}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Area dataKey="hi" stroke="none" fill={colors.primary} fillOpacity={0.15} />
          <Area dataKey="lo" stroke="none" fill={colors.background} fillOpacity={1} />
          <Line type="monotone" dataKey="historico" stroke={flujo === 'in' ? colors.income : colors.expense} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          <Line type="monotone" dataKey="proyectado" stroke={colors.primary} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="space-y-1 text-xs">
        <p className="text-muted-foreground">
          <strong>Lectura del analista:</strong> Tu tendencia mensual es{' '}
          <span className={slopePct >= 0 ? 'text-green-500' : 'text-red-500'}>
            {slopePct >= 0 ? '+' : ''}{slopePct.toFixed(1)}%
          </span>{' '}
          con volatilidad del{' '}
          <span className={volPct > 30 ? 'text-yellow-500' : ''}>{volPct.toFixed(0)}%</span>.
        </p>
        <p className="text-muted-foreground">R² = {regression.r2.toFixed(2)} ({regression.r2 > 0.7 ? 'tendencia clara' : regression.r2 > 0.4 ? 'tendencia moderada' : 'tendencia débil'})</p>
        {volPct > 30 && (
          <p className="text-yellow-600 dark:text-yellow-400 font-medium">
            ⚠ Alta volatilidad — la proyección tiene incertidumbre significativa
          </p>
        )}
      </div>
    </div>
  )
}
