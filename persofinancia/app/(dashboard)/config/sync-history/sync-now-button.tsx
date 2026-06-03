// persofinancia/app/(dashboard)/config/sync-history/sync-now-button.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Result {
  ok: boolean
  saved?: number
  rules_applied?: number
  ai_categorized?: number
  errors?: string[]
  error?: string
}

export function SyncNowButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(7)
  const [result, setResult] = useState<Result | null>(null)

  async function handleSync() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/sync/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      })
      const data = await res.json()
      setResult({ ok: res.ok, ...data })
      router.refresh()
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : 'Error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Sincronizar ahora</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Lee los emails recientes de Gmail y aplica reglas + IA.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="days-select" className="text-xs text-muted-foreground">Últimos:</label>
        <select
          id="days-select"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          disabled={loading}
          className="bg-background border border-border rounded-lg px-2 py-1 text-sm"
        >
          <option value={1}>1 día</option>
          <option value={3}>3 días</option>
          <option value={7}>7 días</option>
          <option value={14}>14 días</option>
          <option value={30}>30 días</option>
        </select>
      </div>

      <button
        onClick={handleSync}
        disabled={loading}
        className={cn(
          'w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
        )}
      >
        <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        {loading ? 'Sincronizando…' : 'Sincronizar ahora'}
      </button>

      {result && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-lg p-2.5 text-xs',
            result.ok
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400'
          )}
        >
          {result.ok ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
          <div className="flex-1">
            {result.ok ? (
              <p>
                ✓ {result.saved ?? 0} nuevos
                {result.rules_applied ? ` · ${result.rules_applied} reglas` : ''}
                {result.ai_categorized ? ` · ${result.ai_categorized} IA` : ''}
              </p>
            ) : (
              <p>{result.error ?? 'Error al sincronizar'}</p>
            )}
            {result.errors && result.errors.length > 0 && (
              <p className="mt-1 opacity-80">⚠ {result.errors.length} errores menores</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
