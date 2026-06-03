// persofinancia/supabase/functions/ingest-emails/index.ts
//
// Ingest Gmail emails into public.movimientos.
// Body (optional):
//   { from?: 'YYYY-MM-DD', to?: 'YYYY-MM-DD', user_id?: UUID }
// Defaults:
//   - from/to: yesterday only
//   - user_id: all users with active banks
// Returns: { summary: Record<bancoNombre, count>, processed_at, range, errors? }
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BancolombiaParser } from './parsers/bancolombia.ts'
import { NequiParser } from './parsers/nequi.ts'
import { RappiCardParser } from './parsers/rappicard.ts'
import { OccidenteParser } from './parsers/occidente.ts'
import { LulobankParser } from './parsers/lulobank.ts'
import { NuParser } from './parsers/nu.ts'
import { HapiParser } from './parsers/hapi.ts'
import { GenericParser } from './parsers/generic.ts'
import type { BankParser, ParsedTransaction } from './parsers/types.ts'

const PARSERS: Record<string, BankParser> = {
  bancolombia: new BancolombiaParser(),
  nequi: new NequiParser(),
  rappicard: new RappiCardParser(),
  occidente: new OccidenteParser(),
  lulobank: new LulobankParser(),
  nu: new NuParser(),
  hapi: new HapiParser(),
  generic: new GenericParser(),
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- Date helpers ---------------------------------------------------------
function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function toGmailDate(d: Date): string {
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
}
function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function parseIsoDate(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// Limit rango máximo para evitar timeouts (Supabase Edge Functions ~150s)
const MAX_DAYS_PER_RUN = 35

interface RequestBody {
  from?: string  // YYYY-MM-DD inclusive
  to?: string    // YYYY-MM-DD inclusive
  user_id?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Parse optional body
  let body: RequestBody = {}
  if (req.method === 'POST') {
    try {
      const text = await req.text()
      if (text) body = JSON.parse(text)
    } catch {
      // ignore — use defaults
    }
  }

  // Determine date range (inclusive on both ends)
  let fromDate: Date
  let toDate: Date
  if (body.from && body.to) {
    const f = parseIsoDate(body.from)
    const t = parseIsoDate(body.to)
    if (!f || !t) {
      return new Response(
        JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    fromDate = f
    toDate = t
  } else {
    // Default: yesterday only
    const y = new Date()
    y.setDate(y.getDate() - 1)
    fromDate = y
    toDate = y
  }

  const daysDiff = Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (daysDiff > MAX_DAYS_PER_RUN) {
    return new Response(
      JSON.stringify({
        error: `Range too large: ${daysDiff} days. Max ${MAX_DAYS_PER_RUN} days per run. Split into multiple calls.`,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Gmail uses `after:` inclusive and `before:` exclusive — so add 1 day to toDate
  const gmailFrom = toGmailDate(fromDate)
  const gmailToExclusive = new Date(toDate)
  gmailToExclusive.setDate(gmailToExclusive.getDate() + 1)
  const gmailTo = toGmailDate(gmailToExclusive)

  // Fetch active bancos (filtered by user_id if provided)
  let bancosQuery = supabase
    .from('bancos')
    .select('id, user_id, nombre, gmail_query, parser_type, profiles(gmail_token)')
    .eq('activo', true)

  if (body.user_id) {
    bancosQuery = bancosQuery.eq('user_id', body.user_id)
  }

  const { data: bancos, error: bancosError } = await bancosQuery

  if (bancosError) {
    console.error('Error fetching bancos:', bancosError)
    return new Response(JSON.stringify({ error: bancosError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const summary: Record<string, { saved: number; skipped: number }> = {}
  const errors: string[] = []

  for (const banco of bancos ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gmailToken = (banco.profiles as any)?.gmail_token
    if (!gmailToken) {
      console.log(`No gmail_token for ${banco.nombre}, skipping`)
      continue
    }

    const parser = PARSERS[banco.parser_type] ?? PARSERS.generic
    if (!parser) continue

    const gmailQuery = `${banco.gmail_query} after:${gmailFrom} before:${gmailTo}`

    // Paginated Gmail search
    const allMessageIds: string[] = []
    let pageToken: string | undefined = undefined
    let pageCount = 0
    const MAX_PAGES = 20  // safety limit ~1000 messages per banco per run

    do {
      const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages`)
      url.searchParams.set('q', gmailQuery)
      url.searchParams.set('maxResults', '50')
      if (pageToken) url.searchParams.set('pageToken', pageToken)

      try {
        const gmailRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${gmailToken}` },
        })
        if (!gmailRes.ok) {
          errors.push(`Gmail ${banco.nombre} page ${pageCount}: ${gmailRes.status}`)
          break
        }
        const data = await gmailRes.json()
        const msgs: Array<{ id: string }> = data.messages ?? []
        allMessageIds.push(...msgs.map(m => m.id))
        pageToken = data.nextPageToken
        pageCount++
      } catch (e) {
        errors.push(`Gmail fetch failed for ${banco.nombre}: ${e}`)
        break
      }
    } while (pageToken && pageCount < MAX_PAGES)

    let saved = 0
    let skipped = 0

    for (const msgId of allMessageIds) {
      // Fetch message snippet
      let snippet = ''
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata`,
          { headers: { Authorization: `Bearer ${gmailToken}` } }
        )
        if (msgRes.ok) {
          const msgData = await msgRes.json()
          snippet = msgData.snippet ?? ''
        }
      } catch {
        continue
      }

      if (!snippet) continue

      const parsed: ParsedTransaction | null = parser.parse(snippet, msgId)
      if (!parsed) {
        skipped++
        continue
      }

      // Insert (idempotent via PK = msgId). Categoria queda NULL — se aplica regla luego.
      const { error } = await supabase.from('movimientos').insert({
        id: parsed.id,
        user_id: banco.user_id,
        banco_id: banco.id,
        fecha: parsed.fecha,
        hora: parsed.hora,
        tipo: parsed.tipo,
        flujo: parsed.flujo,
        monto: parsed.monto,
        descripcion: parsed.descripcion,
        categoria: null,
        categoria_manual: false,
        origen: 'email',
        cuenta: parsed.cuenta,
        raw: parsed.raw,
      })

      if (!error) {
        saved++
      } else if (error.code === '23505') {
        skipped++  // duplicate — already exists
      } else {
        errors.push(`Insert ${msgId}: ${error.message}`)
      }
    }

    // Update ultimo_sync
    await supabase
      .from('bancos')
      .update({ ultimo_sync: new Date().toISOString() })
      .eq('id', banco.id)

    summary[banco.nombre] = { saved, skipped }
  }

  // After all inserts: apply categorization rules to uncategorized movements
  // (in the date range, for the user being processed)
  const targetUserIds = body.user_id ? [body.user_id] : [...new Set((bancos ?? []).map(b => b.user_id))]
  const ruleStats: Record<string, number> = {}

  for (const uid of targetUserIds) {
    const { data: rules } = await supabase
      .from('reglas_categoria')
      .select('id, categoria_id, campo, operador, valor, prioridad, categorias(nombre)')
      .eq('user_id', uid)
      .eq('activa', true)
      .order('prioridad', { ascending: true })

    for (const rule of rules ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catName = (rule.categorias as any)?.nombre
      if (!catName) continue

      const fromIso = body.from ?? toIsoDate(fromDate)
      const toIso = body.to ?? toIsoDate(toDate)

      let query = supabase
        .from('movimientos')
        .update({ categoria: catName, regla_aplicada: rule.id })
        .eq('user_id', uid)
        .is('categoria', null)
        .gte('fecha', fromIso)
        .lte('fecha', toIso)

      if (rule.operador === 'contains' && rule.campo === 'descripcion') {
        query = query.ilike('descripcion', `%${rule.valor}%`)
      } else if (rule.operador === 'equals' && rule.campo === 'tipo') {
        query = query.eq('tipo', rule.valor)
      } else {
        continue  // unsupported rule type
      }

      // .update() returns the updated rows by default — use .select() to get them
      const { data: updated, error: updateErr } = await query.select('id')
      if (updateErr) {
        errors.push(`Rule "${catName}": ${updateErr.message}`)
      } else if (updated && updated.length > 0) {
        ruleStats[catName] = (ruleStats[catName] ?? 0) + updated.length
      }
    }
  }

  return new Response(
    JSON.stringify({
      summary,
      ruleStats,
      processed_at: new Date().toISOString(),
      range: { from: body.from ?? toIsoDate(fromDate), to: body.to ?? toIsoDate(toDate) },
      errors: errors.length > 0 ? errors : undefined,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
