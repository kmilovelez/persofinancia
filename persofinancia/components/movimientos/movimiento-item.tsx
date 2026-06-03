// persofinancia/components/movimientos/movimiento-item.tsx
'use client'
import { useState } from 'react'
import { Sparkles, Check, CheckSquare, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmt } from '@/lib/utils/currency'
import { fmtDate } from '@/lib/utils/dates'
import type { Movimiento } from '@/lib/types/database'

interface MovimientoItemProps {
  movimiento: Movimiento
  onClick?: () => void
  bulkMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

export function MovimientoItem({ movimiento, onClick, bulkMode, selected, onToggleSelect }: MovimientoItemProps) {
  const isIn = movimiento.flujo === 'in'
  const sinCategoria = !movimiento.categoria
  const isManual = movimiento.origen === 'manual'
  const isCsv = movimiento.origen === 'csv'

  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<{ categoria: string; confianza: number } | null>(null)
  const [applied, setApplied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSuggest(e: React.MouseEvent) {
    e.stopPropagation()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/suggest-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mov_id: movimiento.id }),
      })
      const data = await res.json()
      if (data.suggestion) setSuggestion(data.suggestion)
      else setError(data.reason ?? 'Sin sugerencia')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function handleApply(e: React.MouseEvent) {
    e.stopPropagation()
    if (!suggestion) return
    setLoading(true)
    try {
      const res = await fetch('/api/movimientos/update-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mov_id: movimiento.id,
          categoria: suggestion.categoria,
          confianza_ia: suggestion.confianza,
        }),
      })
      if (res.ok) {
        setApplied(suggestion.categoria)
        setSuggestion(null)
      }
    } finally {
      setLoading(false)
    }
  }

  function handleContainerClick() {
    if (bulkMode && onToggleSelect) {
      onToggleSelect()
    } else if (onClick) {
      onClick()
    }
  }

  return (
    <div
      onClick={handleContainerClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleContainerClick() }}
      className={cn(
        'w-full flex items-center gap-3 p-3 bg-card rounded-xl border transition-all text-left cursor-pointer',
        bulkMode && selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:bg-muted/50 active:scale-[0.98]'
      )}
    >
      {bulkMode && (
        <div className="shrink-0 text-primary">
          {selected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-muted-foreground" />}
        </div>
      )}
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
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <p
            className={cn(
              'text-xs',
              applied ? 'text-emerald-500' : sinCategoria ? 'text-yellow-500' : 'text-muted-foreground'
            )}
          >
            {applied ? `✓ ${applied}` : sinCategoria ? '⚠ Sin categoría' : movimiento.categoria}
          </p>
          {sinCategoria && !applied && !suggestion && !error && (
            <button
              type="button"
              onClick={handleSuggest}
              disabled={loading}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 disabled:opacity-50 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              {loading ? 'Pensando…' : 'Sugerir IA'}
            </button>
          )}
          {suggestion && !applied && (
            <button
              type="button"
              onClick={handleApply}
              disabled={loading}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors border border-emerald-500/30"
            >
              <Check className="h-3 w-3" />
              {suggestion.categoria} ({suggestion.confianza}%)
            </button>
          )}
          {error && (
            <span className="text-xs text-red-500">{error}</span>
          )}
        </div>
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
    </div>
  )
}
