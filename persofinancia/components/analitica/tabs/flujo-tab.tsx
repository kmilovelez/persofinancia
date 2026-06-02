// persofinancia/components/analitica/tabs/flujo-tab.tsx
import { CashflowCombo } from '../charts/cashflow-combo'
import { CashflowTable } from '../charts/cashflow-table'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function FlujoTab({ movimientos }: Props) {
  return (
    <div className="space-y-4">
      <CashflowCombo movimientos={movimientos} />
      <CashflowTable movimientos={movimientos} />
    </div>
  )
}
