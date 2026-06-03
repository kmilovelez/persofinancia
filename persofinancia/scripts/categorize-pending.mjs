/**
 * Categorize pending movements (categoria IS NULL) using Gemini AI.
 *
 * Calls the ingest-emails Edge Function with { categorize_only: true } repeatedly
 * until no more pending movs in range, or maxRuns reached.
 *
 * Usage:
 *   npm run categorize-pending -- 2024-06-01 2026-06-03
 */
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const [, , fromArg, toArg] = process.argv
if (!fromArg || !toArg) {
  console.error('Usage: node scripts/categorize-pending.mjs <from YYYY-MM-DD> <to YYYY-MM-DD>')
  process.exit(1)
}

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const USER_ID = process.env.USER_ID || '176c3601-8f07-4cf7-9c98-ce89d06cda76'

if (!PROJECT_REF || !SERVICE_KEY) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const FN_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/ingest-emails`
const AI_LIMIT = 50
const MAX_RUNS = 60  // 60 × 50 = 3000 movs max

async function call() {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromArg,
      to: toArg,
      user_id: USER_ID,
      categorize_only: true,
      ai_limit: AI_LIMIT,
    }),
  })
  const data = await res.json()
  return { status: res.status, data }
}

async function main() {
  console.log(`[categorize] Range ${fromArg} → ${toArg}`)
  console.log(`[categorize] Procesando pendientes en batches de ${AI_LIMIT}...`)

  let totalCategorized = 0
  let totalLowConf = 0
  const allStats = {}

  for (let i = 1; i <= MAX_RUNS; i++) {
    process.stdout.write(`[categorize] Batch ${i}... `)
    try {
      const { status, data } = await call()
      if (status >= 400) {
        console.log(`❌ ${data.error || status}`)
        break
      }
      const { scanned, aiCategorized, aiLowConfidence, aiStats } = data
      totalCategorized += aiCategorized
      totalLowConf += aiLowConfidence
      for (const [k, v] of Object.entries(aiStats ?? {})) {
        allStats[k] = (allStats[k] ?? 0) + v
      }

      console.log(`✅ scanned ${scanned} · ${aiCategorized} categorizados · ${aiLowConfidence} baja confianza`)

      if (scanned === 0) {
        console.log(`[categorize] No quedan pendientes en rango.`)
        break
      }
      // Si el primer batch no categorizó NADA, el problema es sistémico (API key, prompt, etc.)
      // Detener para no bucle sobre los mismos movs sin avanzar.
      if (i === 1 && aiCategorized === 0) {
        console.log(`[categorize] ❌ El primer batch no categorizó ningún movimiento.`)
        console.log(`[categorize]    Verifica que GEMINI_API_KEY esté en los Edge Function secrets:`)
        console.log(`[categorize]    npx supabase secrets list --project-ref ${PROJECT_REF}`)
        console.log(`[categorize]    Si falta, configúrala:`)
        console.log(`[categorize]    npx supabase secrets set GEMINI_API_KEY=AIza... --project-ref ${PROJECT_REF}`)
        break
      }
      if (scanned < AI_LIMIT && aiCategorized === 0) {
        console.log(`[categorize] Nada más por categorizar.`)
        break
      }
    } catch (err) {
      console.log(`❌ ${err.message}`)
      break
    }
  }

  console.log('')
  console.log('=== Summary ===')
  console.log(`Total categorizados por IA:  ${totalCategorized}`)
  console.log(`Total con confianza baja:    ${totalLowConf}`)
  console.log('Distribución por categoría:')
  for (const [k, v] of Object.entries(allStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`)
  }
}

main().catch(err => {
  console.error('[categorize] Fatal:', err)
  process.exit(1)
})
