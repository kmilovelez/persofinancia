// persofinancia/app/(dashboard)/config/sync-history/page.tsx
// Historial de sincronizaciones (cron diario + manuales).
import Link from 'next/link'
import { ChevronLeft, Check, AlertCircle, Clock } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'

interface SyncRow {
  id: number
  triggered_by: 'cron' | 'manual' | 'ui'
  range_from: string | null
  range_to: string | null
  saved: number
  ai_categorized: number
  rules_applied: number
  errors: string[] | null
  created_at: string
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const TRIGGER_LABELS: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  cron:   { label: 'Automático', icon: Clock, color: 'text-blue-500' },
  manual: { label: 'Manual',     icon: Check, color: 'text-emerald-500' },
  ui:     { label: 'UI',         icon: Check, color: 'text-emerald-500' },
}

export default async function SyncHistoryPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase.from('sync_history') as any)
    .select('id, triggered_by, range_from, range_to, saved, ai_categorized, rules_applied, errors, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const history = (rows ?? []) as SyncRow[]
  const last = history[0]

  return (
    <div className="p-4 space-y-4">
      <div className="pt-2 flex items-center gap-2">
        <Link href="/config" className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Historial de sync</h1>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-1">
        <p className="text-xs text-muted-foreground">Próximo sync automático</p>
        <p className="text-sm font-medium">Mañana 3:00 AM (hora Colombia)</p>
        <p className="text-xs text-muted-foreground mt-2">
          Cron diario que lee Gmail del día anterior y aplica reglas + IA Groq.
        </p>
      </div>

      {last && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Último sync</p>
          <p className="text-sm font-medium">{fmtTime(last.created_at)}</p>
          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
            <div className="bg-muted/40 rounded-lg p-2 text-center">
              <p className="text-muted-foreground">Guardados</p>
              <p className="font-semibold text-base">{last.saved}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-2 text-center">
              <p className="text-muted-foreground">Reglas</p>
              <p className="font-semibold text-base">{last.rules_applied}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-2 text-center">
              <p className="text-muted-foreground">IA</p>
              <p className="font-semibold text-base">{last.ai_categorized}</p>
            </div>
          </div>
        </div>
      )}

      {history.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <p>Aún no hay sincronizaciones registradas.</p>
          <p className="text-xs mt-2">
            El primer sync automático correrá mañana a las 3 AM,
            o puedes <Link href="/config/bancos/sync" className="text-primary underline">sincronizar manualmente</Link>.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Últimas 50 ejecuciones</p>
          {history.map((row) => {
            const trigger = TRIGGER_LABELS[row.triggered_by] ?? TRIGGER_LABELS.manual
            const Icon = row.errors && row.errors.length > 0 ? AlertCircle : trigger.icon
            const iconColor = row.errors && row.errors.length > 0 ? 'text-red-500' : trigger.color
            return (
              <div key={row.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
                <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{trigger.label}</p>
                    <p className="text-xs text-muted-foreground shrink-0">{fmtTime(row.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {row.range_from && row.range_to && (
                      <span>{row.range_from}{row.range_from !== row.range_to ? ` → ${row.range_to}` : ''}</span>
                    )}
                    <span>·</span>
                    <span>{row.saved} guardados</span>
                    {row.rules_applied > 0 && (<><span>·</span><span>{row.rules_applied} reglas</span></>)}
                    {row.ai_categorized > 0 && (<><span>·</span><span>{row.ai_categorized} IA</span></>)}
                  </div>
                  {row.errors && row.errors.length > 0 && (
                    <p className="text-xs text-red-500 mt-1 truncate">{row.errors[0]}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
