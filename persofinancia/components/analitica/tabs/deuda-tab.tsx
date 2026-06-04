// persofinancia/components/analitica/tabs/deuda-tab.tsx
import { KpiCard } from '@/components/shared/kpi-card'
import { DebtByMonthLine } from '../charts/debt-by-month-line'
import { DebtByEntityBar } from '../charts/debt-by-entity-bar'
import { fmt } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import type { Movimiento } from '@/lib/types/database'

interface Compromiso {
  id: string
  entidad: string
  producto: string
  tipo: string
  saldo_actual: number
  cuota_mensual: number
  tasa_ea: number | null
  dia_pago: number | null
  cuotas_total: number | null
  cuotas_pagadas: number | null
  estado: string
}

interface Props {
  movimientos: Movimiento[]
  compromisos?: Compromiso[]
}

const ESTADO_STYLES: Record<string, { label: string; color: string }> = {
  al_dia:     { label: '✅ Al día',  color: 'text-emerald-500' },
  mora:       { label: '🔴 Mora',    color: 'text-red-500' },
  congelada:  { label: '❄️ Congelada', color: 'text-blue-500' },
  liquidado:  { label: '💚 Liquidado', color: 'text-emerald-600' },
}

export function DeudaTab({ movimientos, compromisos }: Props) {
  const deudas = movimientos.filter(m => m.categoria === 'Deuda')
  const totalPagado = deudas.reduce((s, m) => s + Number(m.monto), 0)
  const count = deudas.length

  const comps = compromisos ?? []
  const saldoTotal = comps.filter(c => c.estado !== 'liquidado').reduce((s, c) => s + Number(c.saldo_actual), 0)
  const cuotaMensualTotal = comps.filter(c => c.estado !== 'liquidado').reduce((s, c) => s + Number(c.cuota_mensual), 0)

  return (
    <div className="space-y-4">
      {comps.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Saldo total deuda" value={fmt(saldoTotal)} positive={false} highlight />
            <KpiCard label="Cuota mensual total" value={fmt(cuotaMensualTotal)} positive={false} />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Compromisos activos</h3>
            <div className="space-y-2">
              {comps.filter(c => c.estado !== 'liquidado').map(c => {
                const estilo = ESTADO_STYLES[c.estado] ?? ESTADO_STYLES.al_dia
                const progreso = c.cuotas_total && c.cuotas_pagadas != null
                  ? Math.round((c.cuotas_pagadas / c.cuotas_total) * 100)
                  : null
                return (
                  <div key={c.id} className="bg-card border border-border rounded-xl p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{c.entidad}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.producto}</p>
                      </div>
                      <span className={cn('text-[10px] font-medium shrink-0', estilo.color)}>{estilo.label}</span>
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
                        <p className="text-[10px] text-muted-foreground uppercase">Día pago</p>
                        <p className="font-semibold">{c.dia_pago ?? '—'}</p>
                      </div>
                    </div>
                    {progreso !== null && c.cuotas_total && (
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>{c.cuotas_pagadas}/{c.cuotas_total} cuotas</span>
                          <span>{progreso}%</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${progreso}%` }} />
                        </div>
                      </div>
                    )}
                    {c.tasa_ea && Number(c.tasa_ea) > 0 && (
                      <p className="text-[10px] text-muted-foreground">Tasa: {c.tasa_ea}% E.A.</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      <div className="pt-2">
        <h3 className="text-sm font-semibold mb-2">Histórico de pagos</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <KpiCard label="Total pagado (rango)" value={fmt(totalPagado)} positive={false} />
          <KpiCard label="# Pagos" value={String(count)} />
        </div>
      </div>
      <DebtByMonthLine movimientos={movimientos} />
      <DebtByEntityBar movimientos={movimientos} />
    </div>
  )
}
