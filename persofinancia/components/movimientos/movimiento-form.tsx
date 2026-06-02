// persofinancia/components/movimientos/movimiento-form.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface MovimientoFormProps {
  userId: string
  categorias: Array<{ id: string; nombre: string }>
}

export function MovimientoForm({ userId, categorias }: MovimientoFormProps) {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    descripcion: '',
    monto: '',
    flujo: 'out' as 'in' | 'out',
    categoria: '',
    cuenta: '',
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const montoNum = parseFloat(form.monto)
    if (!form.descripcion.trim() || isNaN(montoNum) || montoNum <= 0) return

    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('movimientos') as any).insert({
      id: crypto.randomUUID(),
      user_id: userId,
      banco_id: null,
      fecha: form.fecha,
      hora: (() => {
        const now = new Date()
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      })(),
      tipo: form.flujo === 'in' ? 'Ingreso' : 'Gasto',
      flujo: form.flujo,
      monto: montoNum,
      descripcion: form.descripcion.trim().toUpperCase(),
      categoria: form.categoria || null,
      categoria_manual: !!form.categoria,
      origen: 'manual',
      cuenta: form.cuenta.trim() || null,
    })
    setLoading(false)

    if (!error) {
      router.push('/movimientos')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select
            value={form.flujo}
            onValueChange={(v) => update('flujo', v as 'in' | 'out')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="out">Gasto (salida)</SelectItem>
              <SelectItem value="in">Ingreso (entrada)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={form.fecha}
            onChange={(e) => update('fecha', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Descripcion</Label>
        <Input
          placeholder="RAPPI, Mercado, Nomina..."
          value={form.descripcion}
          onChange={(e) => update('descripcion', e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Monto (COP)</Label>
        <Input
          type="number"
          placeholder="35000"
          min="1"
          step="100"
          value={form.monto}
          onChange={(e) => update('monto', e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Categoria (opcional)</Label>
        <Select value={form.categoria} onValueChange={(v) => update('categoria', v ?? '')}>
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

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Guardando...' : 'Guardar movimiento'}
      </Button>
    </form>
  )
}
