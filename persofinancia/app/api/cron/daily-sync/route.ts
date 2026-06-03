// persofinancia/app/api/cron/daily-sync/route.ts
//
// Vercel Cron Job — runs every day at 08:00 UTC (03:00 Colombia).
// Calls the Supabase Edge Function `ingest-emails` for yesterday's range,
// which syncs Gmail, parses, categorizes (rules + AI fallback), and logs.
//
// Vercel automatically attaches the `Authorization: Bearer <CRON_SECRET>` header
// when CRON_SECRET is configured in env vars. We verify it to prevent
// unauthorized external calls.
//
// Schedule defined in vercel.json: { "path": "/api/cron/daily-sync", "schedule": "0 8 * * *" }
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — long enough for any single sync

function isoYesterday(): string {
  const y = new Date()
  y.setUTCDate(y.getUTCDate() - 1)
  return `${y.getUTCFullYear()}-${String(y.getUTCMonth() + 1).padStart(2, '0')}-${String(y.getUTCDate()).padStart(2, '0')}`
}

export async function GET(req: Request) {
  // Verify Vercel cron secret (auto-injected by Vercel when configured)
  const authHeader = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  const fnUrl = `${SUPABASE_URL}/functions/v1/ingest-emails`
  const yesterday = isoYesterday()

  // Get all users with active banks — call edge function for each
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data: bancosUsers } = await admin
    .from('bancos')
    .select('user_id')
    .eq('activo', true)

  const userIds = Array.from(new Set((bancosUsers ?? []).map(b => b.user_id)))
  if (userIds.length === 0) {
    return NextResponse.json({ message: 'No active users to sync', ts: new Date().toISOString() })
  }

  const results: Array<{ user_id: string; status: number; saved?: number; error?: string }> = []

  for (const userId of userIds) {
    try {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: yesterday, to: yesterday, user_id: userId }),
      })
      const data = await res.json()
      const saved = Object.values(data.summary ?? {}).reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: number, b: any) => s + (b?.saved ?? 0), 0,
      ) as number
      results.push({ user_id: userId, status: res.status, saved })

      // Log to sync_history table (best-effort)
      await admin.from('sync_history').insert({
        user_id: userId,
        triggered_by: 'cron',
        range_from: yesterday,
        range_to: yesterday,
        saved,
        ai_categorized: data.aiCategorized ?? 0,
        rules_applied: Object.values(data.ruleStats ?? {}).reduce((s: number, n) => s + (Number(n) || 0), 0),
        errors: data.errors ?? null,
        raw_response: data,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ user_id: userId, status: 500, error: msg })
      await admin.from('sync_history').insert({
        user_id: userId,
        triggered_by: 'cron',
        range_from: yesterday,
        range_to: yesterday,
        saved: 0,
        errors: [msg],
      })
    }

    // After sync: run alert detection
    try {
      const alertsUrl = new URL('/api/alertas/detectar', req.url).toString()
      await fetch(alertsUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${expected ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      })
    } catch {
      // alerts are best-effort
    }
  }

  return NextResponse.json({
    ts: new Date().toISOString(),
    yesterday,
    users_synced: userIds.length,
    results,
  })
}
