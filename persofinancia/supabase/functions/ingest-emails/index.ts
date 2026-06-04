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
  categorize_only?: boolean  // Skip Gmail sync, only run AI categorization on pending movs
  ai_limit?: number          // Max movs to send to Gemini per call (default 50)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

/**
 * Refresh a Google OAuth access_token using the long-lived refresh_token.
 * Updates profiles.gmail_token + gmail_token_expires_at on success.
 * Returns new access_token or null on failure.
 */
async function refreshGmailToken(
  supabase: SupabaseClient,
  userId: string,
  refreshToken: string,
): Promise<string | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    console.log('[refreshGmailToken] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET')
    return null
  }
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    })
    if (!res.ok) {
      console.log(`[refreshGmailToken] HTTP ${res.status}: ${await res.text()}`)
      return null
    }
    const data = await res.json()
    const newToken = data.access_token as string
    const expiresIn = data.expires_in as number
    if (!newToken) return null
    await supabase
      .from('profiles')
      .update({
        gmail_token: newToken,
        gmail_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      })
      .eq('user_id', userId)
    console.log(`[refreshGmailToken] OK for user ${userId}, expires in ${expiresIn}s`)
    return newToken
  } catch (e) {
    console.log(`[refreshGmailToken] Exception: ${e}`)
    return null
  }
}

/**
 * SHA-256 hash of the snippet for cache lookup.
 */
async function snippetHash(snippet: string): Promise<string> {
  const data = new TextEncoder().encode(snippet)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Look up cached parser result for an identical snippet.
 * Returns previous parsed_output if found, null otherwise.
 */
async function lookupCache(
  supabase: SupabaseClient,
  snippet: string,
  messageId: string,
): Promise<ParsedTransaction | null> {
  const hash = await snippetHash(snippet)
  const { data, error } = await supabase
    .from('parser_examples')
    .select('parsed_output, id, hits')
    .eq('snippet_hash', hash)
    .maybeSingle()

  if (error || !data) return null

  // Increment hit counter
  await supabase
    .from('parser_examples')
    .update({ hits: (data.hits ?? 0) + 1, last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  const p = data.parsed_output
  if (!p?.fecha || !p?.monto || !p?.flujo) return null

  return {
    id: messageId,
    fecha: p.fecha,
    hora: p.hora ?? '00:00',
    tipo: p.tipo ?? 'Otros',
    flujo: p.flujo === 'in' ? 'in' : 'out',
    monto: Number(p.monto) || 0,
    descripcion: (p.descripcion ?? 'SIN DESCRIPCION').toUpperCase(),
    cuenta: p.cuenta ?? null,
    raw: snippet,
  }
}

/**
 * Save successful parse to cache for future RAG.
 */
async function saveExample(
  supabase: SupabaseClient,
  bancoNombre: string,
  snippet: string,
  parsed: ParsedTransaction,
  source: 'ai' | 'regex' = 'ai',
): Promise<void> {
  const hash = await snippetHash(snippet)
  const parsed_output = {
    fecha: parsed.fecha,
    hora: parsed.hora,
    tipo: parsed.tipo,
    flujo: parsed.flujo,
    monto: parsed.monto,
    descripcion: parsed.descripcion,
    cuenta: parsed.cuenta,
  }

  await supabase.from('parser_examples').upsert(
    {
      banco_nombre: bancoNombre,
      snippet: snippet.slice(0, 1000),
      snippet_hash: hash,
      parsed_output,
      source,
    },
    { onConflict: 'snippet_hash', ignoreDuplicates: true },
  )
}

/**
 * Get last N successful parses for the same bank — used as few-shot examples.
 */
async function getFewShotExamples(
  supabase: SupabaseClient,
  bancoNombre: string,
  limit: number = 5,
): Promise<Array<{ snippet: string; parsed_output: Record<string, unknown> }>> {
  const { data } = await supabase
    .from('parser_examples')
    .select('snippet, parsed_output')
    .eq('banco_nombre', bancoNombre)
    .order('last_used_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

/**
 * Classify a movement into one of the user's categories using Groq Llama 3.3 70B + few-shot RAG.
 * Examples = user's previously-categorized movements with the same flujo.
 * Returns category name if confianza >= 60, null otherwise.
 */
async function classifyWithGroq(
  supabase: SupabaseClient,
  userId: string,
  movimiento: {
    descripcion: string
    tipo: string
    monto: number
    flujo: 'in' | 'out'
    banco: string
  },
): Promise<{ categoria: string; confianza: number } | null> {
  const apiKey = Deno.env.get('GROQ_API_KEY')
  if (!apiKey) {
    console.log('[classifyWithGroq] GROQ_API_KEY not set')
    return null
  }

  // 1. Get user's categories
  const { data: cats } = await supabase
    .from('categorias')
    .select('nombre, grupo, subgrupo')
    .eq('user_id', userId)

  if (!cats || cats.length === 0) return null

  // 2. Get few-shot: 8 random previously-categorized movements of same flujo
  const { data: examples } = await supabase
    .from('movimientos')
    .select('descripcion, tipo, monto, categoria')
    .eq('user_id', userId)
    .eq('flujo', movimiento.flujo)
    .not('categoria', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const sampledExamples = (examples ?? [])
    .sort(() => Math.random() - 0.5)
    .slice(0, 8)

  const examplesText = sampledExamples.length > 0
    ? `\nEjemplos previos del usuario:\n${sampledExamples
        .map(e => `- "${e.descripcion}" (${e.tipo}, $${e.monto}) → ${e.categoria}`)
        .join('\n')}\n`
    : ''

  const categoriasText = cats
    .map(c => `- ${c.nombre} (grupo: ${c.grupo})`)
    .join('\n')

  const prompt = `Eres un clasificador de movimientos financieros personales colombianos.

Categorías disponibles del usuario:
${categoriasText}
${examplesText}
Movimiento a clasificar:
- Descripción: "${movimiento.descripcion}"
- Tipo: ${movimiento.tipo}
- Monto: $${movimiento.monto} COP
- Flujo: ${movimiento.flujo === 'in' ? 'entrada/ingreso' : 'salida/gasto'}
- Banco: ${movimiento.banco}

Devuelve JSON con la categoría más probable (nombre exacto de la lista) y tu confianza:
{"categoria": "nombre exacto", "confianza": 0-100}

Si no estás seguro o el movimiento es ambiguo, usa confianza baja (< 70).`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Eres un clasificador experto de movimientos financieros colombianos. Respondes SOLO con JSON válido, sin texto adicional ni markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) {
      console.log(`[classifyWithGroq] HTTP ${res.status}: ${await res.text()}`)
      return null
    }
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content ?? ''
    const jsonMatch = text.match(/\{[\s\S]+\}/)
    if (!jsonMatch) {
      console.log(`[classifyWithGroq] No JSON in response: ${text}`)
      return null
    }
    const parsed = JSON.parse(jsonMatch[0])
    const confianza = Number(parsed.confianza) || 0
    const raw = String(parsed.categoria ?? '').trim()

    // Case-insensitive match against user's categories
    const exists = cats.find(c => c.nombre.toLowerCase() === raw.toLowerCase())
    if (!exists) {
      console.log(`[classifyWithGroq] Categoría inválida: "${raw}" (conf=${confianza}) desc="${movimiento.descripcion}"`)
      return null
    }
    if (confianza < 50) {
      console.log(`[classifyWithGroq] Confianza baja: ${confianza} → "${exists.nombre}" desc="${movimiento.descripcion}"`)
      return null
    }

    console.log(`[classifyWithGroq] OK: "${movimiento.descripcion}" → ${exists.nombre} (conf=${confianza})`)
    return { categoria: exists.nombre, confianza }
  } catch (e) {
    console.log(`[classifyWithGroq] Exception: ${e}`)
    return null
  }
}

/**
 * Fallback parser using Gemini Free Tier when regex parser returns null.
 * Uses few-shot examples from cache for RAG-style learning.
 */
async function parseWithGemini(
  supabase: SupabaseClient,
  snippet: string,
  messageId: string,
  bancoNombre: string,
): Promise<ParsedTransaction | null> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    console.log('[parseWithGemini] GEMINI_API_KEY not set — skipping AI parse')
    return null
  }

  // Get few-shot examples from cache (RAG)
  const examples = await getFewShotExamples(supabase, bancoNombre, 5)
  const examplesText = examples.length > 0
    ? `\nEjemplos previos de emails de ${bancoNombre} y sus extracciones JSON:\n\n${examples
        .map(e => `Email:\n${e.snippet}\n\nJSON:\n${JSON.stringify(e.parsed_output)}`)
        .join('\n\n---\n\n')}\n\n---\n\n`
    : ''

  const prompt = `Eres un parser de emails bancarios colombianos. Tu trabajo es extraer datos estructurados de un email de ${bancoNombre} en formato JSON estricto.
${examplesText}
Nuevo email a procesar:
${snippet}

Reglas:
- "flujo": "in" para ingresos (recibido), "out" para egresos (enviado/pagado/comprado)
- "tipo": clasifica como Compra, Transferencia, Transferencia QR, Transferencia Boton, Pago, Pago QR, Ingreso, Ingreso Nomina, Ingreso Proveedor, Transferencia recibida, u Otros
- "descripcion": nombre del comercio / persona / destino (en MAYÚSCULAS)
- "fecha": formato YYYY-MM-DD
- "hora": formato HH:MM
- "monto": número en COP sin separadores ni símbolos (ej: 78000)
- "cuenta": número de cuenta/tarjeta con asterisco si lo menciona (ej: "*4000"), o null

Responde SOLO con JSON válido, sin markdown, sin texto antes ni después:
{"fecha":"YYYY-MM-DD","hora":"HH:MM","tipo":"...","flujo":"in|out","monto":0,"descripcion":"...","cuenta":null}

Si no puedes determinar al menos fecha, monto y flujo, responde: {"error":"insufficient_data"}`

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!res.ok) {
      console.log(`[parseWithGemini] Gemini API error ${res.status}: ${await res.text()}`)
      return null
    }
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!text) return null

    const jsonMatch = text.match(/\{[\s\S]+\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    if (parsed.error || !parsed.fecha || !parsed.monto || !parsed.flujo) return null

    const result: ParsedTransaction = {
      id: messageId,
      fecha: parsed.fecha,
      hora: parsed.hora ?? '00:00',
      tipo: parsed.tipo ?? 'Otros',
      flujo: parsed.flujo === 'in' ? 'in' : 'out',
      monto: Number(parsed.monto) || 0,
      descripcion: (parsed.descripcion ?? 'SIN DESCRIPCION').toUpperCase(),
      cuenta: parsed.cuenta ?? null,
      raw: snippet,
    }

    // Save to cache for future RAG
    await saveExample(supabase, bancoNombre, snippet, result, 'ai')

    return result
  } catch (e) {
    console.log(`[parseWithGemini] Exception: ${e}`)
    return null
  }
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
  if (daysDiff > MAX_DAYS_PER_RUN && !body.categorize_only) {
    return new Response(
      JSON.stringify({
        error: `Range too large: ${daysDiff} days. Max ${MAX_DAYS_PER_RUN} days per run. Split into multiple calls.`,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // ──────────────────────────────────────────
  // categorize_only mode: skip Gmail/parsing/rules — only AI fallback on pending
  // ──────────────────────────────────────────
  if (body.categorize_only) {
    if (!body.user_id) {
      return new Response(
        JSON.stringify({ error: 'categorize_only requires user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const aiStats: Record<string, number> = {}
    let aiCategorized = 0
    let aiLowConfidence = 0
    const aiLimit = body.ai_limit ?? 50

    // Exclude movs already attempted (confianza_ia IS NOT NULL means we tried)
    const { data: pending } = await supabase
      .from('movimientos')
      .select('id, descripcion, tipo, monto, flujo, banco_id, bancos(nombre)')
      .eq('user_id', body.user_id)
      .is('categoria', null)
      .is('confianza_ia', null)
      .gte('fecha', toIsoDate(fromDate))
      .lte('fecha', toIsoDate(toDate))
      .limit(aiLimit)

    for (const mov of pending ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bancoNombre = (mov.bancos as any)?.nombre ?? 'Desconocido'
      const result = await classifyWithGroq(supabase, body.user_id, {
        descripcion: mov.descripcion ?? '',
        tipo: mov.tipo ?? '',
        monto: Number(mov.monto) || 0,
        flujo: (mov.flujo as 'in' | 'out') ?? 'out',
        banco: bancoNombre,
      })
      if (result) {
        const { error: upErr } = await supabase
          .from('movimientos')
          .update({ categoria: result.categoria, confianza_ia: result.confianza })
          .eq('id', mov.id)
        if (!upErr) {
          aiStats[result.categoria] = (aiStats[result.categoria] ?? 0) + 1
          aiCategorized++
        }
      } else {
        // Mark as attempted (confianza_ia = 0) so future runs skip this mov
        await supabase
          .from('movimientos')
          .update({ confianza_ia: 0 })
          .eq('id', mov.id)
        aiLowConfidence++
      }
    }

    return new Response(
      JSON.stringify({
        mode: 'categorize_only',
        scanned: pending?.length ?? 0,
        aiCategorized,
        aiLowConfidence,
        aiStats,
        range: { from: toIsoDate(fromDate), to: toIsoDate(toDate) },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    .select('id, user_id, nombre, gmail_query, parser_type, profiles(gmail_token, gmail_refresh_token, gmail_token_expires_at)')
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
    const profile = (banco.profiles as any) ?? {}
    let gmailToken: string | undefined = profile.gmail_token
    const refreshToken: string | undefined = profile.gmail_refresh_token
    if (!gmailToken) {
      console.log(`No gmail_token for ${banco.nombre}, skipping`)
      continue
    }

    // Proactive refresh: if token expires in < 5 min, refresh now
    if (profile.gmail_token_expires_at && refreshToken) {
      const expiresAt = new Date(profile.gmail_token_expires_at).getTime()
      if (expiresAt - Date.now() < 5 * 60 * 1000) {
        const fresh = await refreshGmailToken(supabase, banco.user_id, refreshToken)
        if (fresh) gmailToken = fresh
      }
    }

    const parser = PARSERS[banco.parser_type] ?? PARSERS.generic
    if (!parser) continue

    const gmailQuery = `${banco.gmail_query} after:${gmailFrom} before:${gmailTo}`

    // Paginated Gmail search (with auto-refresh retry on 401)
    const allMessageIds: string[] = []
    let pageToken: string | undefined = undefined
    let pageCount = 0
    const MAX_PAGES = 20

    do {
      const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages`)
      url.searchParams.set('q', gmailQuery)
      url.searchParams.set('maxResults', '50')
      if (pageToken) url.searchParams.set('pageToken', pageToken)

      try {
        let gmailRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${gmailToken}` },
        })

        // On 401: try refresh + retry once
        if (gmailRes.status === 401 && refreshToken) {
          const fresh = await refreshGmailToken(supabase, banco.user_id, refreshToken)
          if (fresh) {
            gmailToken = fresh
            gmailRes = await fetch(url.toString(), {
              headers: { Authorization: `Bearer ${gmailToken}` },
            })
          }
        }

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
    let parsedByAi = 0
    let parsedFromCache_count = 0
    let unparsable = 0

    for (const msgId of allMessageIds) {
      // Fetch message snippet + internalDate
      let snippet = ''
      let emailDate: string | undefined
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata`,
          { headers: { Authorization: `Bearer ${gmailToken}` } }
        )
        if (msgRes.ok) {
          const msgData = await msgRes.json()
          snippet = msgData.snippet ?? ''
          // internalDate is a string of milliseconds since epoch
          if (msgData.internalDate) {
            emailDate = new Date(Number(msgData.internalDate)).toISOString()
          }
        }
      } catch {
        continue
      }

      if (!snippet) continue

      // 1) Cache lookup — identical snippet seen before? (avoids re-calling IA)
      let parsed: ParsedTransaction | null = await lookupCache(supabase, snippet, msgId)
      if (parsed) parsedFromCache_count++

      // 2) Try regex parser (fast, free)
      if (!parsed) {
        parsed = parser.parse(snippet, msgId, emailDate)
        if (parsed) {
          // Save regex-parsed result to cache too (helps future RAG few-shot)
          await saveExample(supabase, banco.nombre, snippet, parsed, 'regex')
        }
      }

      // 3) Fallback: Gemini with few-shot from cache (RAG)
      if (!parsed) {
        parsed = await parseWithGemini(supabase, snippet, msgId, banco.nombre)
        if (parsed) parsedByAi++
      }

      if (!parsed) {
        unparsable++
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

    summary[banco.nombre] = { saved, skipped, parsedByAi, parsedFromCache: parsedFromCache_count, unparsable }
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

  // After rules: AI fallback categorization for movements still NULL
  const aiStats: Record<string, number> = {}
  let aiCategorized = 0
  let aiLowConfidence = 0

  for (const uid of targetUserIds) {
    const fromIso = body.from ?? toIsoDate(fromDate)
    const toIso = body.to ?? toIsoDate(toDate)

    // Pull pending uncategorized movements (cap at 50 per sync to respect Groq quota)
    const { data: pending } = await supabase
      .from('movimientos')
      .select('id, descripcion, tipo, monto, flujo, banco_id, bancos(nombre)')
      .eq('user_id', uid)
      .is('categoria', null)
      .is('confianza_ia', null)
      .gte('fecha', fromIso)
      .lte('fecha', toIso)
      .limit(50)

    for (const mov of pending ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bancoNombre = (mov.bancos as any)?.nombre ?? 'Desconocido'
      const result = await classifyWithGroq(supabase, uid, {
        descripcion: mov.descripcion ?? '',
        tipo: mov.tipo ?? '',
        monto: Number(mov.monto) || 0,
        flujo: (mov.flujo as 'in' | 'out') ?? 'out',
        banco: bancoNombre,
      })

      if (result) {
        const { error: upErr } = await supabase
          .from('movimientos')
          .update({
            categoria: result.categoria,
            confianza_ia: result.confianza,
          })
          .eq('id', mov.id)
        if (!upErr) {
          aiStats[result.categoria] = (aiStats[result.categoria] ?? 0) + 1
          aiCategorized++
        }
      } else {
        // Mark as attempted so future syncs skip this mov
        await supabase
          .from('movimientos')
          .update({ confianza_ia: 0 })
          .eq('id', mov.id)
        aiLowConfidence++
      }
    }
  }

  return new Response(
    JSON.stringify({
      summary,
      ruleStats,
      aiStats,
      aiCategorized,
      aiLowConfidence,
      processed_at: new Date().toISOString(),
      range: { from: body.from ?? toIsoDate(fromDate), to: body.to ?? toIsoDate(toDate) },
      errors: errors.length > 0 ? errors : undefined,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
