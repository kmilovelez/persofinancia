// persofinancia/components/analitica/charts/allocation-by-grupo.tsx
'use client'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento, Categoria } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
}

export function AllocationByGrupo({ movimientos, categorias }: Props) {
  const colors = useChartColors()
  const catMap = new Map(categorias.map(c => [c.nombre, c.grupo]))

  const grupos = new Map<string, number>()
  for (const m of movimientos) {
    if (m.flujo !== 'out' || !m.categoria) continue
    const grupo = catMap.get(m.categoria) ?? 'Otros'
    grupos.set(grupo, (grupos.get(grupo) ?? 0) + Number(m.monto))
  }

  if (grupos.size === 0) {
    return <ChartEmpty icon="🥧" title="Sin gastos categorizados" description="Categoriza tus movimientos para ver esta gráfica" />
  }

  const data = Array.from(grupos.entries()).map(([name, value], i) => ({
    name,
    value,
    color: colors.palette[i % colors.palette.length],
  }))

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Asignación real por grupo</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={2}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
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
