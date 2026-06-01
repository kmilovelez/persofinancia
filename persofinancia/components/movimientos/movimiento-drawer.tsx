// persofinancia/components/movimientos/movimiento-drawer.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface MovimientoDrawerProps {
  movimiento: Movimiento | null
  categorias: Array<{ id: string; nombre: string }>
  open: boolean
  onClose: () => void
}

export function MovimientoDrawer({
  movimiento,
  categorias,
  open,
  onClose,
}: MovimientoDrawerProps) {
  const supabase = getSupabaseBrowserClient()
  const router = useRouter()
  const [categoria, setCategoria] = useState(movimiento?.categoria ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Sync local state when movimiento changes
  const displayCategoria = movimiento?.categoria ?? ''

  async function saveCategoria() {
    if (!movimiento) return
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('movimientos') as any)
      .update({ categoria: categoria || null, categoria_manual: true })
      .eq('id', movimiento.id)
    setSaving(false)
    router.refresh()
    onClose()
  }

  async function deleteMovimiento() {
    if (!movimiento) return
    if (movimiento.origen === 'email') return // emails are read-only
    setDeleting(true)
    await supabase.from('movimientos').delete().eq('id', movimiento.id)
    setDeleting(false)
    router.refresh()
    onClose()
  }

  const canDelete = movimiento?.origen !== 'email'
  const isIn = movimiento?.flujo === 'in'

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="truncate pr-8">
            {movimiento?.descripcion ?? ''}
          </SheetTitle>
          {movimiento && (
            <p
              className={
                isIn ? 'text-green-500 font-bold text-lg' : 'text-red-500 font-bold text-lg'
              }
            >
              {isIn ? '+' : '-'}{fmt(Math.abs(movimiento.monto))}
            </p>
          )}
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Categoria</p>
            <Select
              value={categoria}
              onValueChange={(v) => setCategoria(v ?? '')}
              defaultValue={displayCategoria}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin categoria</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.nombre}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={saveCategoria}
            disabled={saving}
            className="w-full"
          >
            {saving ? 'Guardando...' : 'Guardar categoria'}
          </Button>

          {canDelete && (
            <Button
              variant="destructive"
              onClick={deleteMovimiento}
              disabled={deleting}
              className="w-full"
            >
              {deleting ? 'Eliminando...' : 'Eliminar movimiento'}
            </Button>
          )}

          {!canDelete && (
            <p className="text-xs text-muted-foreground text-center">
              Los movimientos de email no se pueden eliminar
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
