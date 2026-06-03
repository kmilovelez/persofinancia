// persofinancia/app/api/ingest/route.ts
//
// Proxy to ingest-emails Edge Function.
// Body (optional): { from?: 'YYYY-MM-DD', to?: 'YYYY-MM-DD' }
// - No body: ingest yesterday (default behavior)
// - With body: ingest the given date range (only for current user)
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

interface IngestBody {
  from?: string
  to?: string
}

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  // Parse optional body — date range for historical ingest
  let body: IngestBody = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text)
  } catch {
    // ignore — proceed with default (yesterday)
  }

  // Always scope to current user (don't trust client to provide other user_id)
  const edgeBody = {
    user_id: user.id,
    ...(body.from && body.to ? { from: body.from, to: body.to } : {}),
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ingest-emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(edgeBody),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      { error: 'Ingest failed', detail: String(err) },
      { status: 500 }
    )
  }
}
