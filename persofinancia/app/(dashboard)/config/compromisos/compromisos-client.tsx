// persofinancia/app/(dashboard)/config/compromisos/compromisos-client.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, Pencil, Trash2, X } from 'lucide-react'
import { fmt } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'

interface Compromiso {
  id: string
  entidad: string
  producto: string
  tipo: 'credito' | 'tarjeta' | 'prestamo' | 'bnpl'
  saldo_actual: number
  cuota_mensual: number
  tasa_ea: number | null
  dia_pago: number | null
  cuotas_total: number | null
  cuotas_pagadas: number | null
  estado: 'al_dia' | 'mora' | 'congelada' | 'liquidado'
  notas: string | null
}

const ESTADOS = [
  { value: 'al_dia',    label: '✅ Al día' },
  { value: 'mora',      label: '🔴 Mora' },
  { value: 'congelada', label: '❄️ Congelada' },
  { value: 'liquidado', label: '💚 Liquidado' },
] as const

const TIPOS = [
  { value: 'credito',  label: 'Crédito' },
  { value: 'tarjeta',  label: 'Tarjeta de crédito' },
  { value: 'prestamo', label: 'Préstamo personal' },
  { value: 'bnpl',     label: 'BNPL (Compra a cuotas)' },
] as const

type FormData = Partial<Compromiso>

interface Props {
  initial: Compromiso[]
}

export function CompromisosClient({ initial }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<Compromiso[]>(initial)
  const [editing, setEditing] = useState<FormData | null>(null)
  const [saving, setSaving] = useState(false)

  function openNew() {
    setEditing({
      entidad: '', producto: '', tipo: 'credito', saldo_actual: 0, cuota_mensual: 0,
      tasa_ea: null, dia_pago: null, cuotas_total: null, cuotas_pagadas: null,
      estado: 'al_dia', notas: '',
    })
  }

  function openEdit(c: Compromiso) {
    setEditing({ ...c })
  }

  async function save() {
    if (!editing || !editing.entidad || !editing.producto) return
    setSaving(true)
    try {
      const isNew = !editing.id
      const res = await fetch('/api/compromisos', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (res.ok) {
        setEditing(null)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string, label: string) {
    if (!confirm(`¿Eliminar "${label}"?`)) return
    const res = await fetch(`/api/compromisos?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems(prev => prev.filter(c => c.id !== id))
      router.refresh()
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="pt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/config" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">Compromisos</h1>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1 bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Nuevo
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Sin compromisos. Toca &quot;Nuevo&quot; para agregar uno.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.entidad}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.producto}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-muted rounded-lg">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(c.id, `${c.entidad} ${c.producto}`)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Saldo</p>
                  <p className="font-semibold">{fmt(Number(c.saldo_actual))}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Cuota</p>
                  <p className="font-semibold">{fmt(Number(c.cuota_mensual))}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Día</p>
                  <p className="font-semibold">{c.dia_pago ?? '—'}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {ESTADOS.find(e => e.value === c.estado)?.label}
                {c.tasa_ea ? ` · ${c.tasa_ea}% E.A.` : ''}
                {c.cuotas_total ? ` · ${c.cuotas_pagadas ?? 0}/${c.cuotas_total} cuotas` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Modal de edición */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div
            className="bg-card border border-border rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
              <h2 className="font-semibold">{editing.id ? 'Editar' : 'Nuevo'} compromiso</h2>
              <button onClick={() => setEditing(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <Field label="Entidad" value={editing.entidad ?? ''} onChange={(v) => setEditing({ ...editing, entidad: v })} placeholder="Ej. Bancolombia" />
              <Field label="Producto" value={editing.producto ?? ''} onChange={(v) => setEditing({ ...editing, producto: v })} placeholder="Ej. Crédito vehículo" />
              <SelectField label="Tipo" value={editing.tipo ?? 'credito'} options={TIPOS} onChange={(v) => setEditing({ ...editing, tipo: v as Compromiso['tipo'] })} />
              <SelectField label="Estado" value={editing.estado ?? 'al_dia'} options={ESTADOS} onChange={(v) => setEditing({ ...editing, estado: v as Compromiso['estado'] })} />
              <NumberField label="Saldo actual" value={editing.saldo_actual ?? 0} onChange={(v) => setEditing({ ...editing, saldo_actual: v })} />
              <NumberField label="Cuota mensual" value={editing.cuota_mensual ?? 0} onChange={(v) => setEditing({ ...editing, cuota_mensual: v })} />
              <NumberField label="Día de pago (1-31)" value={editing.dia_pago ?? 0} onChange={(v) => setEditing({ ...editing, dia_pago: v || null })} />
              <NumberField label="Tasa E.A. (%)" value={editing.tasa_ea ?? 0} onChange={(v) => setEditing({ ...editing, tasa_ea: v || null })} step="0.01" />
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Cuotas total" value={editing.cuotas_total ?? 0} onChange={(v) => setEditing({ ...editing, cuotas_total: v || null })} />
                <NumberField label="Pagadas" value={editing.cuotas_pagadas ?? 0} onChange={(v) => setEditing({ ...editing, cuotas_pagadas: v || null })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notas (opcional)</label>
                <textarea
                  value={editing.notas ?? ''}
                  onChange={(e) => setEditing({ ...editing, notas: e.target.value })}
                  rows={2}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={save}
                  disabled={saving || !editing.entidad || !editing.producto}
                  className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button onClick={() => setEditing(null)} className="px-4 py-2.5 text-sm border border-border rounded-lg">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mt-1"
      />
    </div>
  )
}

function NumberField({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value))}
        step={step ?? '1'}
        className={cn('w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mt-1')}
      />
    </div>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mt-1"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
