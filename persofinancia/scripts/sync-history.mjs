/**
 * Sync historical Gmail emails directly via Edge Function (bypasses Next.js API).
 *
 * Useful when Vercel env vars are misconfigured but you have service role key locally.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=sb_secret_... \
 *   SUPABASE_PROJECT_REF=hgvgjwvwiycuxcebqfvx \
 *   USER_ID=176c3601-... \
 *   node scripts/sync-history.mjs 2024-09-01 2025-05-31
 *
 * Or set them in .env.local and run:
 *   npm run sync-history -- 2024-09-01 2025-05-31
 *
 * Splits range into chunks of 30 days. Each chunk calls ingest-emails Edge Function.
 */
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const [, , fromArg, toArg] = process.argv
if (!fromArg || !toArg) {
  console.error('Usage: node scripts/sync-history.mjs <from YYYY-MM-DD> <to YYYY-MM-DD>')
  process.exit(1)
}

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const USER_ID = process.env.USER_ID || '176c3601-8f07-4cf7-9c98-ce89d06cda76'

if (!PROJECT_REF || !SERVICE_KEY) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_SERVICE_ROLE_KEY')
  console.error('Add them to persofinancia/.env.local or set them inline')
  process.exit(1)
}

const FN_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/ingest-emails`
const CHUNK_DAYS = 30

function pad(n) { return String(n).padStart(2, '0') }
function toIso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

async function callIngest(from, to) {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, user_id: USER_ID }),
  })
  const data = await res.json()
  return { status: res.status, data }
}

async function main() {
  const start = new Date(fromArg + 'T00:00:00')
  const end = new Date(toArg + 'T00:00:00')

  // Build chunks
  const chunks = []
  let cursor = new Date(start)
  while (cursor <= end) {
    const chunkEnd = addDays(cursor, CHUNK_DAYS - 1)
    chunks.push({
      from: toIso(cursor),
      to: toIso(chunkEnd > end ? end : chunkEnd),
    })
    cursor = addDays(chunkEnd, 1)
  }

  console.log(`[sync] Range ${fromArg} → ${toArg} = ${chunks.length} chunks of up to ${CHUNK_DAYS} days`)

  let totalSaved = 0
  let totalSkipped = 0
  let totalCategorized = 0

  for (let i = 0; i < chunks.length; i++) {
    const { from, to } = chunks[i]
    process.stdout.write(`[sync] Chunk ${i + 1}/${chunks.length} (${from} → ${to})... `)

    try {
      const { status, data } = await callIngest(from, to)
      if (status >= 400) {
        console.log(`❌ ${data.error || 'Unknown error'}`)
        continue
      }

      const saved = Object.values(data.summary ?? {}).reduce((s, b) => s + (b?.saved ?? 0), 0)
      const skipped = Object.values(data.summary ?? {}).reduce((s, b) => s + (b?.skipped ?? 0), 0)
      const categorized = Object.values(data.ruleStats ?? {}).reduce((s, n) => s + (n ?? 0), 0)
      totalSaved += saved
      totalSkipped += skipped
      totalCategorized += categorized

      console.log(`✅ ${saved} guardados, ${skipped} duplicados, ${categorized} categorizados`)
      if (data.errors && data.errors.length) {
        console.log(`   ⚠ ${data.errors.length} errores menores`)
      }
    } catch (err) {
      console.log(`❌ Fetch failed: ${err.message}`)
    }
  }

  console.log('')
  console.log('=== Summary ===')
  console.log(`Total chunks:       ${chunks.length}`)
  console.log(`Total guardados:    ${totalSaved}`)
  console.log(`Total duplicados:   ${totalSkipped}`)
  console.log(`Total categorizados: ${totalCategorized}`)
}

main().catch(err => {
  console.error('[sync] Fatal:', err)
  process.exit(1)
})
