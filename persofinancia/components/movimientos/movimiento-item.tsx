// persofinancia/components/movimientos/movimiento-item.tsx
import { cn } from '@/lib/utils'
import { fmt } from '@/lib/utils/currency'
import { fmtDate } from '@/lib/utils/dates'
import type { Movimiento } from '@/lib/types/database'

interface MovimientoItemProps {
  movimiento: Movimiento
  onClick?: () => void
}

export function MovimientoItem({ movimiento, onClick }: MovimientoItemProps) {
  const isIn = movimiento.flujo === 'in'
  const sinCategoria = !movimiento.categoria
  const isManual = movimiento.origen === 'manual'
  const isCsv = movimiento.origen === 'csv'

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-card rounded-xl border border-border hover:bg-muted/50 active:scale-[0.98] transition-all text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{movimiento.descripcion}</p>
          {isManual && (
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 font-medium">
              Manual
            </span>
          )}
          {isCsv && (
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">
              CSV
            </span>
          )}
        </div>
        <p
          className={cn(
            'text-xs mt-0.5',
            sinCategoria ? 'text-yellow-500' : 'text-muted-foreground'
          )}
        >
          {sinCategoria ? '⚠ Sin categoria' : movimiento.categoria}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p
          className={cn(
            'font-semibold text-sm',
            isIn ? 'text-green-500' : 'text-red-500'
          )}
        >
          {isIn ? '+' : '-'}{fmt(Math.abs(movimiento.monto))}
        </p>
        <p className="text-xs text-muted-foreground">{fmtDate(movimiento.fecha)}</p>
      </div>
    </button>
  )
}
