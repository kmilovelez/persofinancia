/**
 * Migration runner — applies SQL migrations to Supabase via Management API.
 *
 * Runs automatically before `next build` on Vercel (see "vercel-build" in package.json).
 * Tracks applied migrations in a local table so it never re-runs the same file.
 *
 * Required Vercel env vars:
 *   SUPABASE_PROJECT_REF     = hgvgjwvwiycuxcebqfvx
 *   SUPABASE_ACCESS_TOKEN    = personal access token from supabase.com/dashboard/account/tokens
 *
 * Note: 20260601000002 (Bancolombia data) and 20260601000003 (seed categories)
 * are NOT auto-applied because they depend on a registered user UUID.
 * Run them manually from Supabase Dashboard → SQL Editor after first login.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations')

// Only auto-apply schema migration (idempotent — uses CREATE TABLE IF NOT EXISTS)
const AUTO_MIGRATIONS = ['20260601000001_initial_schema.sql']

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

// ── Graceful skip if env vars not present (local dev, PR previews without secrets) ──
if (!PROJECT_REF || !ACCESS_TOKEN) {
  console.log('[migrate] SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN not set — skipping')
  process.exit(0)
}

/** Execute a SQL string via Supabase Management API */
async function execSQL(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  const text = await res.text()
  return { ok: res.ok, status: res.status, body: text }
}

/** Create tracking table (idempotent) */
async function ensureTrackingTable() {
  await execSQL(`
    CREATE TABLE IF NOT EXISTS public.migrations_log (
      id         SERIAL PRIMARY KEY,
      filename   TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}

/** Check if a migration file has already been applied */
async function isApplied(filename) {
  const res = await execSQL(
    `SELECT 1 FROM public.migrations_log WHERE filename = '${filename}' LIMIT 1;`
  )
  if (!res.ok) return false
  try {
    const data = JSON.parse(res.body)
    return Array.isArray(data) && data.length > 0
  } catch {
    return false
  }
}

/** Mark a migration as applied */
async function markApplied(filename) {
  const safe = filename.replace(/'/g, "''")
  await execSQL(
    `INSERT INTO public.migrations_log (filename) VALUES ('${safe}') ON CONFLICT DO NOTHING;`
  )
}

async function main() {
  console.log('[migrate] Running database migrations...')

  await ensureTrackingTable()

  for (const filename of AUTO_MIGRATIONS) {
    const alreadyApplied = await isApplied(filename)
    if (alreadyApplied) {
      console.log(`[migrate] ✅ ${filename} — already applied, skipping`)
      continue
    }

    const filePath = join(MIGRATIONS_DIR, filename)
    let sql
    try {
      sql = readFileSync(filePath, 'utf-8')
    } catch {
      console.error(`[migrate] ❌ Cannot read ${filename}`)
      process.exit(1)
    }

    console.log(`[migrate] ⏳ Applying ${filename}...`)
    const result = await execSQL(sql)

    if (result.ok) {
      await markApplied(filename)
      console.log(`[migrate] ✅ ${filename} — applied`)
    } else {
      // "already exists" errors are OK — schema is already there
      const isAlreadyExists =
        result.body.includes('already exists') ||
        result.body.includes('42710') ||
        result.body.includes('42P07')

      if (isAlreadyExists) {
        await markApplied(filename)
        console.log(`[migrate] ✅ ${filename} — schema already exists, marked as applied`)
      } else {
        console.warn(`[migrate] ⚠️  ${filename} failed (${result.status}):`, result.body.slice(0, 300))
        // Don't block build — DB might be pre-configured
      }
    }
  }

  console.log('[migrate] Done.')
}

main().catch((err) => {
  console.error('[migrate] Unexpected error:', err.message)
  // Never block the build for migration failures
  process.exit(0)
})
