// persofinancia/components/movimientos/movimientos-list-client.tsx
'use client'
import { MovimientoItem } from './movimiento-item'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  onItemClick?: (movimiento: Movimiento) => void
  bulkMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export function MovimientosListClient({ movimientos, onItemClick, bulkMode, selectedIds, onToggleSelect }: Props) {
  if (!movimientos.length) {
    return (
      <p className="text-center text-muted-foreground py-12 text-sm">
        Sin movimientos para este filtro
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {movimientos.map((m) => (
        <MovimientoItem
          key={m.id}
          movimiento={m}
          onClick={onItemClick ? () => onItemClick(m) : undefined}
          bulkMode={bulkMode}
          selected={selectedIds?.has(m.id) ?? false}
          onToggleSelect={onToggleSelect ? () => onToggleSelect(m.id) : undefined}
        />
      ))}
    </div>
  )
}
