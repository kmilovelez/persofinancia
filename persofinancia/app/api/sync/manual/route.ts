// persofinancia/app/api/sync/manual/route.ts
//
// Manual sync trigger from /config/sync-history.
// Calls the ingest-emails Edge Function with a date range (default: last 7 days)
// and logs the result to sync_history.
//
// POST { days?: number }  // optional: how many days back to sync (default 7, max 35)
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const days = Math.max(1, Math.min(35, Number(body.days) || 7))

  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - days + 1)

  const fnUrl = `${SUPABASE_URL}/functions/v1/ingest-emails`
  const fromIso = isoDate(from)
  const toIso = isoDate(today)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromIso, to: toIso, user_id: user.id }),
    })
    const data = await res.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saved = Object.values((data.summary ?? {}) as Record<string, any>)
      .reduce((s: number, b) => s + (b?.saved ?? 0), 0) as number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rulesApplied = Object.values((data.ruleStats ?? {}) as Record<string, any>)
      .reduce((s: number, n) => s + (Number(n) || 0), 0) as number

    // Log to sync_history
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('sync_history') as any).insert({
      user_id: user.id,
      triggered_by: 'manual',
      range_from: fromIso,
      range_to: toIso,
      saved,
      ai_categorized: data.aiCategorized ?? 0,
      rules_applied: rulesApplied,
      errors: data.errors ?? null,
      raw_response: data,
    })

    // Trigger alert detection in parallel (best-effort)
    fetch(new URL('/api/alertas/detectar', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') ?? '' },
      body: JSON.stringify({}),
    }).catch(() => {})

    return NextResponse.json({
      ok: res.ok,
      range: { from: fromIso, to: toIso },
      saved,
      rules_applied: rulesApplied,
      ai_categorized: data.aiCategorized ?? 0,
      errors: data.errors,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('sync_history') as any).insert({
      user_id: user.id,
      triggered_by: 'manual',
      range_from: fromIso,
      range_to: toIso,
      saved: 0,
      errors: [msg],
    })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
