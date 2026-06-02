/**
 * Bulk import historical movements from a parsed JSON file.
 *
 * Reads movements from JSON file (output of extract_movs.py),
 * upserts them into public.movimientos using service role.
 *
 * Required env vars:
 *   SUPABASE_PROJECT_REF
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/import-historical-movs.mjs <path-to-json> <user-id>
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const [, , inputFile, userId] = process.argv

if (!inputFile || !userId) {
  console.error('Usage: node import-historical-movs.mjs <path-to-json> <user-id>')
  process.exit(1)
}

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_REF || !SERVICE_KEY) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(
  `https://${PROJECT_REF}.supabase.co`,
  SERVICE_KEY,
  { auth: { persistSession: false } }
)

async function main() {
  console.log(`[import] Reading from ${inputFile}...`)
  const movs = JSON.parse(readFileSync(inputFile, 'utf-8'))
  console.log(`[import] Loaded ${movs.length} movements`)

  // Get banco_id for Bancolombia
  const { data: banco } = await supabase
    .from('bancos')
    .select('id')
    .eq('user_id', userId)
    .eq('nombre', 'Bancolombia')
    .single()

  if (!banco) {
    console.error('[import] Bancolombia bank not found for this user')
    process.exit(1)
  }

  console.log(`[import] Using banco_id: ${banco.id}`)

  // Transform to insert payload
  const rows = movs.map(m => ({
    id: m.id,
    user_id: userId,
    banco_id: banco.id,
    fecha: m.fecha,
    hora: m.hora,
    tipo: m.tipo,
    flujo: m.flujo,
    monto: m.monto,
    descripcion: m.descripcion,
    origen: 'email',
    cuenta: m.cuenta,
    raw: m.raw,
  }))

  // Insert in batches of 100
  const BATCH_SIZE = 100
  let inserted = 0
  let skipped = 0
  let errors = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error, count } = await supabase
      .from('movimientos')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true, count: 'exact' })

    if (error) {
      console.error(`[import] Batch ${i / BATCH_SIZE + 1} error:`, error.message)
      errors += batch.length
    } else {
      inserted += count ?? 0
      skipped += batch.length - (count ?? 0)
      console.log(`[import] Batch ${i / BATCH_SIZE + 1}: ${count ?? 0} inserted, ${batch.length - (count ?? 0)} skipped (duplicates)`)
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Total processed: ${rows.length}`)
  console.log(`Inserted:        ${inserted}`)
  console.log(`Skipped (dups):  ${skipped}`)
  console.log(`Errors:          ${errors}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
