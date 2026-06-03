// persofinancia/components/movimientos/movimiento-drawer.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
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

interface RuleSuggestion {
  patron: string
  categoria: string
  matches: number
  preview: Array<{ descripcion: string; monto: number }>
}

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
  const [saveError, setSaveError] = useState<string | null>(null)
  const [ruleSuggestion, setRuleSuggestion] = useState<RuleSuggestion | null>(null)
  const [creatingRule, setCreatingRule] = useState(false)

  // Reset local state whenever a different movimiento is selected
  useEffect(() => {
    setCategoria(movimiento?.categoria ?? '')
    setSaveError(null)
    setRuleSuggestion(null)
  }, [movimiento?.id])

  async function saveCategoria() {
    if (!movimiento) return
    setSaving(true)
    setSaveError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('movimientos') as any)
      .update({ categoria: categoria || null, categoria_manual: true })
      .eq('id', movimiento.id)
    setSaving(false)
    if (error) {
      setSaveError('Error al guardar. Intenta de nuevo.')
      return
    }
    // After saving a category, ask backend if a pattern exists for auto-rule
    if (categoria && !movimiento.categoria) {
      try {
        const res = await fetch('/api/reglas/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mov_id: movimiento.id, categoria }),
        })
        const data = await res.json()
        if (data.suggestion) {
          setRuleSuggestion(data.suggestion)
          return  // keep drawer open to show suggestion
        }
      } catch {
        // silent fail — rule suggestion is best-effort
      }
    }
    router.refresh()
    onClose()
  }

  async function createRule() {
    if (!ruleSuggestion) return
    setCreatingRule(true)
    try {
      await fetch('/api/reglas/create-and-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patron: ruleSuggestion.patron,
          categoria: ruleSuggestion.categoria,
        }),
      })
    } finally {
      setCreatingRule(false)
      setRuleSuggestion(null)
      router.refresh()
      onClose()
    }
  }

  function skipRule() {
    setRuleSuggestion(null)
    router.refresh()
    onClose()
  }

  async function deleteMovimiento() {
    if (!movimiento || movimiento.origen === 'email') return
    setDeleting(true)
    const { error } = await supabase
      .from('movimientos')
      .delete()
      .eq('id', movimiento.id)
    setDeleting(false)
    if (error) {
      setSaveError('Error al eliminar. Intenta de nuevo.')
      return
    }
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
            <p className={isIn ? 'text-green-500 font-bold text-lg' : 'text-red-500 font-bold text-lg'}>
              {isIn ? '+' : '-'}{fmt(Math.abs(movimiento.monto))}
            </p>
          )}
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {!ruleSuggestion && (
            <>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Categoria</p>
                <Select value={categoria} onValueChange={(v) => setCategoria(v ?? '')}>
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

              {saveError && (
                <p className="text-sm text-destructive">{saveError}</p>
              )}

              <Button onClick={saveCategoria} disabled={saving} className="w-full">
                {saving ? 'Guardando...' : 'Guardar categoria'}
              </Button>
            </>
          )}

          {ruleSuggestion && (
            <div className="space-y-3 bg-purple-500/5 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Crear regla automática</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Detectamos un patrón. Si lo aceptas, categorizaremos automáticamente <strong>{ruleSuggestion.matches}</strong> movimiento{ruleSuggestion.matches === 1 ? '' : 's'} pendiente{ruleSuggestion.matches === 1 ? '' : 's'} con descripción similar.
                  </p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Patrón:</span>
                  <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">{ruleSuggestion.patron}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Categoría:</span>
                  <span className="font-medium">{ruleSuggestion.categoria}</span>
                </div>
              </div>

              {ruleSuggestion.preview.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Movimientos que se categorizarán:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {ruleSuggestion.preview.map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted/40 rounded px-2 py-1 text-xs">
                        <span className="truncate">{p.descripcion}</span>
                        <span className="font-mono shrink-0 ml-2">{fmt(p.monto)}</span>
                      </div>
                    ))}
                  </div>
                  {ruleSuggestion.matches > ruleSuggestion.preview.length && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{ruleSuggestion.matches - ruleSuggestion.preview.length} más…
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={createRule} disabled={creatingRule} className="flex-1">
                  {creatingRule ? 'Aplicando…' : `✓ Crear regla`}
                </Button>
                <Button onClick={skipRule} disabled={creatingRule} variant="outline" className="flex-1">
                  Solo este
                </Button>
              </div>
            </div>
          )}

          {!ruleSuggestion && canDelete && (
            <Button
              variant="destructive"
              onClick={deleteMovimiento}
              disabled={deleting}
              className="w-full"
            >
              {deleting ? 'Eliminando...' : 'Eliminar movimiento'}
            </Button>
          )}

          {!ruleSuggestion && !canDelete && (
            <p className="text-xs text-muted-foreground text-center">
              Los movimientos de email no se pueden eliminar
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
