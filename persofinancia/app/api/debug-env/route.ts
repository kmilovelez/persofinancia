// TEMPORARY: Debug endpoint to check which env vars are visible at runtime.
// Only returns boolean presence + first 4 chars (never the full value).
// Remove after diagnosis.
import { NextResponse } from 'next/server'

export async function GET() {
  const vars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_APP_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_PROJECT_REF',
    'SUPABASE_ACCESS_TOKEN',
  ]

  const result: Record<string, { present: boolean; length: number; prefix: string }> = {}
  for (const v of vars) {
    const val = process.env[v]
    result[v] = {
      present: !!val,
      length: val?.length ?? 0,
      prefix: val ? val.slice(0, 4) + '...' : '',
    }
  }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    nodeVersion: process.version,
    vars: result,
  })
}
