// persofinancia/components/analitica/tabs/yoy-tab.tsx
// Year-over-year comparison by category.
'use client'
import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

const MONTHS_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export function YoyTab({ movimientos }: Props) {
  const currentYear = new Date().getFullYear()
  const prevYear = currentYear - 1

  // Pick top 5 categories by total spend in current year + previous year
  const topCategorias = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const m of movimientos) {
      if (m.flujo !== 'out' || !m.categoria) continue
      const y = Number(m.fecha.slice(0, 4))
      if (y !== currentYear && y !== prevYear) continue
      totals[m.categoria] = (totals[m.categoria] ?? 0) + Number(m.monto)
    }
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre]) => nombre)
  }, [movimientos, currentYear, prevYear])

  const [selectedCat, setSelectedCat] = useState<string>(topCategorias[0] ?? '')

  // Build monthly series for both years for the selected category
  const data = useMemo(() => {
    return MONTHS_ABBR.map((mes, i) => {
      const monthNum = i + 1
      const prevTotal = movimientos
        .filter(m => m.flujo === 'out' && m.categoria === selectedCat && Number(m.fecha.slice(0, 4)) === prevYear && Number(m.fecha.slice(5, 7)) === monthNum)
        .reduce((s, m) => s + Number(m.monto), 0)
      const currTotal = movimientos
        .filter(m => m.flujo === 'out' && m.categoria === selectedCat && Number(m.fecha.slice(0, 4)) === currentYear && Number(m.fecha.slice(5, 7)) === monthNum)
        .reduce((s, m) => s + Number(m.monto), 0)
      return {
        mes,
        [String(prevYear)]: prevTotal,
        [String(currentYear)]: currTotal,
      }
    })
  }, [movimientos, selectedCat, currentYear, prevYear])

  // Summary metrics
  const totalPrev = data.reduce((s, d) => s + (Number(d[String(prevYear)]) || 0), 0)
  const totalCurr = data.reduce((s, d) => s + (Number(d[String(currentYear)]) || 0), 0)
  const change = totalPrev > 0 ? ((totalCurr - totalPrev) / totalPrev) * 100 : 0

  if (topCategorias.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-12">Sin datos suficientes para comparar.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {topCategorias.map(c => (
          <button
            key={c}
            onClick={() => setSelectedCat(c)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCat === c
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-card border border-border rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground uppercase">{prevYear}</p>
          <p className="text-sm font-bold mt-1">{fmt(totalPrev)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground uppercase">{currentYear}</p>
          <p className="text-sm font-bold mt-1">{fmt(totalCurr)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground uppercase">Cambio</p>
          <p className={`text-sm font-bold mt-1 ${change >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(v) => fmt(Number(v))}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey={String(prevYear)} fill="hsl(220 70% 50%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey={String(currentYear)} fill="hsl(280 70% 60%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
