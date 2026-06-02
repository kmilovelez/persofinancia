// persofinancia/components/analitica/tabs/deuda-tab.tsx
import { KpiCard } from '@/components/shared/kpi-card'
import { DebtByMonthLine } from '../charts/debt-by-month-line'
import { DebtByEntityBar } from '../charts/debt-by-entity-bar'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function DeudaTab({ movimientos }: Props) {
  const deudas = movimientos.filter(m => m.categoria === 'Deuda')
  const total = deudas.reduce((s, m) => s + Number(m.monto), 0)
  const count = deudas.length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Total pagado" value={fmt(total)} positive={false} highlight />
        <KpiCard label="Pagos" value={String(count)} />
      </div>
      <DebtByMonthLine movimientos={movimientos} />
      <DebtByEntityBar movimientos={movimientos} />
    </div>
  )
}
