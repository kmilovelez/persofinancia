// persofinancia/components/movimientos/movimientos-list-client.tsx
'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MovimientoItem } from './movimiento-item'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function MovimientosListClient({ movimientos }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function onSaved() {
    startTransition(() => router.refresh())
  }

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
        <MovimientoItem key={m.id} movimiento={m} />
      ))}
    </div>
  )
}
