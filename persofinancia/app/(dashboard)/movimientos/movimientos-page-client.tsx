// persofinancia/app/(dashboard)/movimientos/movimientos-page-client.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckSquare, Square, X } from 'lucide-react'
import { MovimientosListClient } from '@/components/movimientos/movimientos-list-client'
import { MovimientoDrawer } from '@/components/movimientos/movimiento-drawer'
import type { Movimiento, Categoria } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
  bulkEligible?: boolean   // true when filter=pendientes
}

export function MovimientosPageClient({ movimientos, categorias, bulkEligible }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Movimiento | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCategoria, setBulkCategoria] = useState('')
  const [applying, setApplying] = useState(false)

  function toggleId(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(movimientos.map(m => m.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function exitBulk() {
    setBulkMode(false)
    setSelectedIds(new Set())
    setBulkCategoria('')
  }

  async function applyBulk() {
    if (!bulkCategoria || selectedIds.size === 0) return
    setApplying(true)
    try {
      const res = await fetch('/api/movimientos/update-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mov_ids: Array.from(selectedIds),
          categoria: bulkCategoria,
        }),
      })
      if (res.ok) {
        exitBulk()
        router.refresh()
      }
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      {bulkEligible && !bulkMode && (
        <button
          onClick={() => setBulkMode(true)}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <CheckSquare className="h-4 w-4" />
          Seleccionar varios
        </button>
      )}

      {bulkMode && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-xl p-3">
          <div className="flex items-center gap-2 text-sm">
            <button onClick={exitBulk} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
            <span className="font-medium">{selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}</span>
          </div>
          <button onClick={selectAll} className="text-xs text-primary hover:underline">
            Seleccionar todos ({movimientos.length})
          </button>
        </div>
      )}

      <MovimientosListClient
        movimientos={movimientos}
        bulkMode={bulkMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleId}
        onItemClick={(m) => {
          if (!bulkMode) setSelected(m)
        }}
      />

      {bulkMode && selectedIds.size > 0 && (
        <div className="fixed bottom-[72px] left-0 right-0 mx-auto max-w-md px-4 z-40">
          <div className="bg-card border border-border rounded-xl shadow-lg p-3 space-y-2">
            <select
              value={bulkCategoria}
              onChange={(e) => setBulkCategoria(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Seleccionar categoría…</option>
              {categorias.map(c => (
                <option key={c.id} value={c.nombre}>{c.nombre}</option>
              ))}
            </select>
            <button
              onClick={applyBulk}
              disabled={!bulkCategoria || applying}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              {applying ? 'Aplicando…' : (
                <>
                  <Square className="h-4 w-4" />
                  Categorizar {selectedIds.size} movimiento{selectedIds.size === 1 ? '' : 's'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <MovimientoDrawer
        movimiento={selected}
        categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </>
  )
}
