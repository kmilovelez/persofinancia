// persofinancia/components/config/banco-item.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import type { Banco } from '@/lib/types/database'

interface BancoItemProps {
  banco: Banco
}

export function BancoItem({ banco }: BancoItemProps) {
  const supabase = getSupabaseBrowserClient()
  const router = useRouter()
  const [activo, setActivo] = useState(banco.activo)
  const [saving, setSaving] = useState(false)

  async function toggleActivo(value: boolean) {
    setSaving(true)
    setActivo(value)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('bancos').update({ activo: value }).eq('id', banco.id)
    setSaving(false)
    router.refresh()
  }

  const lastSync = banco.ultimo_sync
    ? `Sync: ${new Date(banco.ultimo_sync).toLocaleDateString('es-CO')}`
    : 'Sin sincronizar'

  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-4">
      <span className="text-2xl shrink-0">{banco.icono}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{banco.nombre}</p>
        <p className="text-xs text-muted-foreground truncate">
          {activo ? lastSync : 'Inactivo'}
        </p>
      </div>
      <Switch
        checked={activo}
        onCheckedChange={toggleActivo}
        disabled={saving}
      />
    </div>
  )
}
