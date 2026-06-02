// persofinancia/components/analitica/charts/cashflow-table.tsx
import { groupByMes } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function CashflowTable({ movimientos }: Props) {
  const data = groupByMes(movimientos)
  const currentMonth = new Date().toISOString().slice(0, 7)

  if (data.length === 0) {
    return <ChartEmpty icon="📋" title="Sin datos en el rango" />
  }

  const totals = data.reduce(
    (acc, m) => ({
      ingresos: acc.ingresos + m.ingresos,
      gastos: acc.gastos + m.gastos,
      neto: acc.neto + m.neto,
    }),
    { ingresos: 0, gastos: 0, neto: 0 }
  )
  const totalAhorro = totals.ingresos > 0 ? ((totals.neto / totals.ingresos) * 100).toFixed(1) : '0'

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <p className="text-sm font-semibold p-4 pb-2">Detalle mensual</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2">Mes</th>
              <th className="text-right px-3 py-2">Ingresos</th>
              <th className="text-right px-3 py-2">Gastos</th>
              <th className="text-right px-3 py-2">Neto</th>
              <th className="text-right px-3 py-2">% Ahorro</th>
            </tr>
          </thead>
          <tbody>
            {data.map(m => {
              const ahorro = m.ingresos > 0 ? ((m.neto / m.ingresos) * 100).toFixed(1) : '0'
              const isCurrent = m.mes === currentMonth
              return (
                <tr key={m.mes} className={isCurrent ? 'italic text-muted-foreground' : ''}>
                  <td className="px-3 py-2">{m.mes}{isCurrent && '*'}</td>
                  <td className="text-right text-green-500 px-3 py-2">{fmt(m.ingresos)}</td>
                  <td className="text-right text-red-500 px-3 py-2">{fmt(m.gastos)}</td>
                  <td className={`text-right px-3 py-2 font-medium ${m.neto >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {fmt(m.neto)}
                  </td>
                  <td className="text-right px-3 py-2">{ahorro}%</td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-border font-bold bg-muted/30">
              <td className="px-3 py-2">TOTAL</td>
              <td className="text-right text-green-500 px-3 py-2">{fmt(totals.ingresos)}</td>
              <td className="text-right text-red-500 px-3 py-2">{fmt(totals.gastos)}</td>
              <td className={`text-right px-3 py-2 ${totals.neto >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {fmt(totals.neto)}
              </td>
              <td className="text-right px-3 py-2">{totalAhorro}%</td>
            </tr>
          </tbody>
        </table>
      </div>
      {data.some(m => m.mes === currentMonth) && (
        <p className="text-xs text-muted-foreground p-3 pt-0">* Mes en curso (incompleto)</p>
      )}
    </div>
  )
}
