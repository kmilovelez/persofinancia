// persofinancia/app/(dashboard)/config/importar/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ParsedRow {
  fecha: string
  descripcion: string
  monto: number
  flujo: 'in' | 'out'
}

function parseCSV(
  text: string,
  colFecha: number,
  colDesc: number,
  colMonto: number,
  colFlujo: number
): ParsedRow[] {
  const lines = text.trim().split('\n').slice(1)
  const rows: ParsedRow[] = []

  for (const line of lines) {
    const cols = line.split(',').map((c) => c.replace(/"/g, '').trim())
    const montoStr = cols[colMonto] ?? '0'
    const monto = Math.abs(parseFloat(montoStr.replace(/\./g, '').replace(',', '.')) || 0)
    if (monto === 0) continue

    const flujoRaw = (cols[colFlujo] ?? '').toLowerCase()
    const flujo: 'in' | 'out' =
      flujoRaw.includes('cred') || flujoRaw.includes('ingreso') ? 'in' : 'out'

    rows.push({
      fecha: cols[colFecha] ?? new Date().toISOString().slice(0, 10),
      descripcion: (cols[colDesc] ?? 'SIN DESCRIPCION').toUpperCase(),
      monto,
      flujo,
    })
  }

  return rows
}

function hashRow(row: ParsedRow, userId: string): string {
  return `csv-${userId.slice(0, 8)}-${row.fecha}-${row.descripcion.slice(0, 10)}-${row.monto}`
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .slice(0, 100)
}

export default function ImportarPage() {
  const supabase = getSupabaseBrowserClient()
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [cols, setCols] = useState({ fecha: 0, desc: 1, monto: 2, flujo: 3 })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const text = await f.text()
    const rows = parseCSV(text, cols.fecha, cols.desc, cols.monto, cols.flujo)
    setPreview(rows.slice(0, 5))
    setResult(null)
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const text = await file.text()
    const rows = parseCSV(text, cols.fecha, cols.desc, cols.monto, cols.flujo)

    let imported = 0
    let skipped = 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any

    for (const row of rows) {
      const id = hashRow(row, user.id)
      const { error } = await supabaseAny.from('movimientos').insert({
        id,
        user_id: user.id,
        banco_id: null,
        fecha: row.fecha,
        hora: '00:00',
        tipo: row.flujo === 'in' ? 'Ingreso' : 'Gasto',
        flujo: row.flujo,
        monto: row.monto,
        descripcion: row.descripcion,
        origen: 'csv',
      })
      if (!error) imported++
      else if (error.code === '23505') skipped++ // duplicate
    }

    setLoading(false)
    setResult(`${imported} importados, ${skipped} duplicados omitidos de ${rows.length} filas`)
    router.refresh()
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold pt-4">Importar CSV</h1>

      <div className="space-y-2">
        <Label>Archivo CSV</Label>
        <Input type="file" accept=".csv,.txt" onChange={handleFileChange} />
        <p className="text-xs text-muted-foreground">
          El archivo debe tener encabezados en la primera fila
        </p>
      </div>

      {file && (
        <>
          <div>
            <p className="text-sm font-medium mb-2">Mapeo de columnas (numero de columna, empieza en 0)</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(cols) as Array<keyof typeof cols>).map((key) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs capitalize">{key}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={cols[key]}
                    onChange={(e) =>
                      setCols((c) => ({ ...c, [key]: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {preview.length > 0 && (
            <div className="bg-muted rounded-xl p-3 space-y-1">
              <p className="text-xs font-medium mb-2">Vista previa (primeras 5 filas)</p>
              {preview.map((r, i) => (
                <div key={i} className="text-xs flex justify-between">
                  <span className="text-muted-foreground truncate max-w-[60%]">
                    {r.fecha} · {r.descripcion.slice(0, 20)}
                  </span>
                  <span className={r.flujo === 'in' ? 'text-green-500' : 'text-red-500'}>
                    {r.flujo === 'in' ? '+' : '-'}${r.monto.toLocaleString('es-CO')}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleImport} disabled={loading} className="w-full">
            {loading ? 'Importando...' : `Importar ${file.name}`}
          </Button>
        </>
      )}

      {result && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
          <p className="text-sm text-green-600 dark:text-green-400">{result}</p>
        </div>
      )}
    </div>
  )
}
