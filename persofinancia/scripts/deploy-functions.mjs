/**
 * Deploy all Supabase Edge Functions of this project.
 *
 * - Verifies supabase CLI is installed
 * - Verifies project is linked (or links it)
 * - Deploys ingest-emails and classify-tx with --no-verify-jwt
 *
 * Usage:
 *   npm run deploy:functions
 *
 * Required:
 *   - supabase CLI installed (npm install -g supabase OR npx supabase ...)
 *   - First-time only: `npx supabase login` and `npx supabase link --project-ref hgvgjwvwiycuxcebqfvx`
 */
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PROJECT_REF = 'hgvgjwvwiycuxcebqfvx'

const FUNCTIONS = ['ingest-emails', 'classify-tx']

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32'
    const cmdToRun = isWin && cmd === 'npx' ? 'npx.cmd' : cmd
    const child = spawn(cmdToRun, args, {
      stdio: 'inherit',
      shell: isWin,
      cwd: ROOT,
      ...opts,
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

async function checkSupabaseCli() {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32'
    const child = spawn(isWin ? 'npx.cmd' : 'npx', ['supabase', '--version'], {
      shell: isWin,
      stdio: 'pipe',
    })
    child.on('exit', (code) => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
}

async function isLinked() {
  return existsSync(join(ROOT, 'supabase', '.temp', 'project-ref')) ||
    existsSync(join(ROOT, '.supabase', 'config.toml'))
}

async function main() {
  console.log('[deploy] Checking Supabase CLI...')
  const hasCli = await checkSupabaseCli()
  if (!hasCli) {
    console.error('[deploy] ❌ Supabase CLI not available via npx.')
    console.error('         Install globally: npm install -g supabase')
    console.error('         Or login first: npx supabase login')
    process.exit(1)
  }

  console.log('[deploy] Checking project link...')
  if (!(await isLinked())) {
    console.log(`[deploy] Linking project to ${PROJECT_REF}...`)
    try {
      await run('npx', ['supabase', 'link', '--project-ref', PROJECT_REF])
    } catch (err) {
      console.error('[deploy] ❌ Link failed. Try manually:')
      console.error(`         npx supabase login`)
      console.error(`         npx supabase link --project-ref ${PROJECT_REF}`)
      process.exit(1)
    }
  }

  let success = 0
  let failed = 0

  for (const fn of FUNCTIONS) {
    console.log(`\n[deploy] Deploying ${fn}...`)
    try {
      await run('npx', ['supabase', 'functions', 'deploy', fn, '--no-verify-jwt'])
      console.log(`[deploy] ✅ ${fn} deployed`)
      success++
    } catch (err) {
      console.error(`[deploy] ❌ ${fn} failed: ${err.message}`)
      failed++
    }
  }

  console.log(`\n=== Deployment Summary ===`)
  console.log(`Success: ${success}/${FUNCTIONS.length}`)
  console.log(`Failed:  ${failed}/${FUNCTIONS.length}`)

  if (failed > 0) {
    process.exit(1)
  }

  console.log(`\nNext step: Open https://persofinancia.vercel.app/config/bancos/sync`)
  console.log(`           Set range and click "Sincronizar rango"`)
}

main().catch((err) => {
  console.error('[deploy] Fatal error:', err.message)
  process.exit(1)
})
