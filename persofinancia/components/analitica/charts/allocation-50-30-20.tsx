// persofinancia/components/analitica/charts/allocation-50-30-20.tsx
'use client'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { sumByFlujo } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento, Categoria } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
}

export function Allocation503020({ movimientos, categorias }: Props) {
  const colors = useChartColors()
  const totalIngresos = sumByFlujo(movimientos, 'in')
  const totalGastos = sumByFlujo(movimientos, 'out')

  if (totalIngresos === 0 && totalGastos === 0) {
    return <ChartEmpty icon="🥧" title="Sin movimientos" description="No hay datos para calcular asignacion" />
  }

  const catMap = new Map(categorias.map(c => [c.nombre, c.grupo]))
  let necesidades = 0
  let deseos = 0
  for (const m of movimientos) {
    if (m.flujo !== 'out' || !m.categoria) continue
    const grupo = catMap.get(m.categoria) ?? 'Variable'
    if (grupo === 'Fijo' || grupo === 'Deuda') necesidades += Number(m.monto)
    else if (grupo === 'Variable') deseos += Number(m.monto)
  }
  const ahorro = Math.max(0, totalIngresos - totalGastos)

  const data = [
    { name: 'Necesidades (50%)', value: necesidades, color: colors.expense },
    { name: 'Deseos (30%)', value: deseos, color: colors.primary },
    { name: 'Ahorro (20%)', value: ahorro, color: colors.income },
  ].filter(d => d.value > 0)

  const total = data.reduce((s, d) => s + d.value, 0)
  const balanceNegativo = totalIngresos < totalGastos

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Regla 50/30/20</p>
      {balanceNegativo && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
          ⚠ Balance negativo: gastas más de lo que ingresas
        </p>
      )}
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={2}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => {
              const n = Number(v)
              return [fmt(n), `${((n / total) * 100).toFixed(0)}%`]
            }}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
