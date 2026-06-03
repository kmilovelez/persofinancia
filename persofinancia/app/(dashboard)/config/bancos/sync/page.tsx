// persofinancia/app/(dashboard)/config/bancos/sync/page.tsx
// UI para sincronizar movimientos históricos desde Gmail.
// Permite seleccionar rango de fechas y dispara la Edge Function en chunks ≤ 35 días.
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ChunkResult {
  range: { from: string; to: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  summary?: Record<string, any>
  ruleStats?: Record<string, number>
  errors?: string[]
  error?: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const MAX_DAYS_PER_CHUNK = 30

export default function SyncHistoryPage() {
  const [from, setFrom] = useState('2024-09-01')
  const [to, setTo] = useState('2025-05-31')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<ChunkResult[]>([])
  const [progress, setProgress] = useState('')

  async function handleRun() {
    setRunning(true)
    setResults([])
    setProgress('')

    const startDate = new Date(from + 'T00:00:00')
    const endDate = new Date(to + 'T00:00:00')

    if (endDate < startDate) {
      setResults([{ range: { from, to }, error: 'Fecha "hasta" anterior a "desde"' }])
      setRunning(false)
      return
    }

    // Split into chunks of MAX_DAYS_PER_CHUNK days
    const chunks: Array<{ from: Date; to: Date }> = []
    let cursor = new Date(startDate)
    while (cursor <= endDate) {
      const chunkEnd = addDays(cursor, MAX_DAYS_PER_CHUNK - 1)
      chunks.push({
        from: new Date(cursor),
        to: chunkEnd > endDate ? new Date(endDate) : chunkEnd,
      })
      cursor = addDays(chunkEnd, 1)
    }

    const allResults: ChunkResult[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const fromIso = toIso(chunk.from)
      const toIsoStr = toIso(chunk.to)
      setProgress(`Chunk ${i + 1} de ${chunks.length}: ${fromIso} → ${toIsoStr}...`)

      try {
        const res = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: fromIso, to: toIsoStr }),
        })
        const data = await res.json()
        // Note: data may already contain a 'range' field — local one takes precedence
        allResults.push({
          summary: data.summary,
          ruleStats: data.ruleStats,
          errors: data.errors,
          error: data.error,
          range: { from: fromIso, to: toIsoStr },
        })
        setResults([...allResults])
      } catch (err) {
        allResults.push({
          range: { from: fromIso, to: toIsoStr },
          error: String(err),
        })
        setResults([...allResults])
      }
    }

    setProgress(`Completado: ${chunks.length} chunks procesados.`)
    setRunning(false)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h1 className="text-xl font-bold">Sincronizar histórico</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Importa movimientos antiguos desde Gmail. Procesa en chunks de hasta {MAX_DAYS_PER_CHUNK} días.
          Aplica reglas de categorización automáticamente.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={running}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={running}
            />
          </div>
        </div>
        <Button onClick={handleRun} disabled={running} className="w-full">
          {running ? 'Sincronizando...' : 'Sincronizar rango'}
        </Button>
        {progress && (
          <p className="text-xs text-muted-foreground">{progress}</p>
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Resultados</p>
          {results.map((r, i) => {
            const totalSaved = Object.values(r.summary ?? {}).reduce(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (sum: number, b: any) => sum + (b?.saved ?? 0), 0
            )
            const totalCategorized = Object.values(r.ruleStats ?? {}).reduce(
              (sum: number, n) => sum + (n ?? 0), 0
            )
            return (
              <div
                key={i}
                className={`bg-card border rounded-xl p-3 text-xs space-y-1 ${
                  r.error ? 'border-red-500/30' : 'border-border'
                }`}
              >
                <div className="flex justify-between font-medium">
                  <span>{r.range.from} → {r.range.to}</span>
                  {r.error ? (
                    <span className="text-red-500">Error</span>
                  ) : (
                    <span className="text-green-500">
                      {totalSaved} nuevos · {totalCategorized} categorizados
                    </span>
                  )}
                </div>
                {r.error && (
                  <p className="text-red-500">{r.error}</p>
                )}
                {r.summary && Object.keys(r.summary).length > 0 && (
                  <div className="text-muted-foreground pl-2">
                    {Object.entries(r.summary).map(([banco, stats]) => (
                      <p key={banco}>
                        {banco}: <span className="text-foreground">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          +{(stats as any)?.saved ?? 0}
                        </span>
                        {' · '}
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(stats as any)?.skipped ?? 0} duplicados
                      </p>
                    ))}
                  </div>
                )}
                {r.errors && r.errors.length > 0 && (
                  <p className="text-yellow-500">{r.errors.length} error(es) en parsing</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
