// persofinancia/app/(dashboard)/movimientos/movimientos-page-client.tsx
'use client'
import { useState } from 'react'
import { MovimientosListClient } from '@/components/movimientos/movimientos-list-client'
import { MovimientoDrawer } from '@/components/movimientos/movimiento-drawer'
import type { Movimiento, Categoria } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
}

export function MovimientosPageClient({ movimientos, categorias }: Props) {
  const [selected, setSelected] = useState<Movimiento | null>(null)

  return (
    <>
      <MovimientosListClient
        movimientos={movimientos}
        onItemClick={(m) => {
          setSelected(m)
        }}
      />
      <MovimientoDrawer
        movimiento={selected}
        categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </>
  )
}
