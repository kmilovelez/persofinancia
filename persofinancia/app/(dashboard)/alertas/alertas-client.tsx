// persofinancia/app/(dashboard)/alertas/alertas-client.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, AlertCircle, Info, X, Bell, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Alerta {
  id: string
  tipo: string
  titulo: string
  mensaje: string
  severidad: 'info' | 'warning' | 'danger'
  leida: boolean
  descartada: boolean
  movimiento_id: string | null
  created_at: string
}

const ICONS = {
  info:    { Icon: Info,           color: 'text-blue-500',   bg: 'bg-blue-500/10' },
  warning: { Icon: AlertTriangle,  color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  danger:  { Icon: AlertCircle,    color: 'text-red-500',    bg: 'bg-red-500/10' },
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

interface Props {
  initial: Alerta[]
}

export function AlertasClient({ initial }: Props) {
  const router = useRouter()
  const [alertas, setAlertas] = useState(initial)
  const [detecting, setDetecting] = useState(false)

  async function dismiss(id: string) {
    setAlertas(prev => prev.filter(a => a.id !== id))
    await fetch('/api/alertas/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  async function markAllRead() {
    setAlertas(prev => prev.map(a => ({ ...a, leida: true })))
    await fetch('/api/alertas/mark-read', { method: 'POST' })
  }

  async function detectarAhora() {
    setDetecting(true)
    try {
      await fetch('/api/alertas/detectar', { method: 'POST' })
      router.refresh()
    } finally {
      setDetecting(false)
    }
  }

  const noLeidas = alertas.filter(a => !a.leida).length

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Alertas</h1>
          {noLeidas > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">
              {noLeidas}
            </span>
          )}
        </div>
        <button
          onClick={detectarAhora}
          disabled={detecting}
          className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', detecting && 'animate-spin')} />
          {detecting ? 'Detectando…' : 'Revisar ahora'}
        </button>
      </div>

      {alertas.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-4xl">✅</p>
          <p className="text-sm text-muted-foreground">Sin alertas. Todo en orden.</p>
        </div>
      ) : (
        <>
          {noLeidas > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Marcar todas como leídas
            </button>
          )}
          <div className="space-y-2">
            {alertas.map(a => {
              const { Icon, color, bg } = ICONS[a.severidad]
              return (
                <div
                  key={a.id}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-3 transition-opacity',
                    bg,
                    a.severidad === 'danger' ? 'border-red-500/30' :
                    a.severidad === 'warning' ? 'border-yellow-500/30' :
                    'border-blue-500/30',
                    a.leida && 'opacity-60'
                  )}
                >
                  <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">{a.titulo}</p>
                      <button
                        onClick={() => dismiss(a.id)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label="Descartar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{a.mensaje}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{fmt(a.created_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
