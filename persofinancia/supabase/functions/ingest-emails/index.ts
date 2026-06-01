// persofinancia/supabase/functions/ingest-emails/index.ts
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
  nequi:       new NequiParser(),
  rappicard:   new RappiCardParser(),
  occidente:   new OccidenteParser(),
  lulobank:    new LulobankParser(),
  nu:          new NuParser(),
  hapi:        new HapiParser(),
  generic:     new GenericParser(),
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

  // Fetch all active banks with user's gmail_token
  const { data: bancos, error: bancosError } = await supabase
    .from('bancos')
    .select('id, user_id, nombre, gmail_query, parser_type, profiles(gmail_token)')
    .eq('activo', true)

  if (bancosError) {
    console.error('Error fetching bancos:', bancosError)
    return new Response(JSON.stringify({ error: bancosError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const summary: Record<string, number> = {}

  for (const banco of bancos ?? []) {
    const gmailToken = (banco.profiles as any)?.gmail_token
    if (!gmailToken) {
      console.log(`No gmail_token for banco ${banco.nombre}, skipping`)
      continue
    }

    const parser = PARSERS[banco.parser_type] ?? PARSERS.generic
    if (!parser) continue

    // Calculate yesterday's date range for Gmail query
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    const ayerStr = `${ayer.getFullYear()}/${String(ayer.getMonth()+1).padStart(2,'0')}/${String(ayer.getDate()).padStart(2,'0')}`
    const hoy = new Date()
    const hoyStr = `${hoy.getFullYear()}/${String(hoy.getMonth()+1).padStart(2,'0')}/${String(hoy.getDate()).padStart(2,'0')}`

    const gmailQuery = `${banco.gmail_query} after:${ayerStr} before:${hoyStr}`

    // Search Gmail for messages
    let messages: Array<{ id: string }> = []
    try {
      const gmailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(gmailQuery)}&maxResults=50`,
        { headers: { Authorization: `Bearer ${gmailToken}` } }
      )
      if (gmailRes.ok) {
        const data = await gmailRes.json()
        messages = data.messages ?? []
      } else {
        console.error(`Gmail error for ${banco.nombre}: ${gmailRes.status}`)
        continue
      }
    } catch (e) {
      console.error(`Gmail fetch failed for ${banco.nombre}:`, e)
      continue
    }

    let saved = 0

    for (const msg of messages) {
      // Fetch message snippet
      let snippet = ''
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata`,
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

      const parsed: ParsedTransaction | null = parser.parse(snippet, msg.id)
      if (!parsed) continue

      // Classify transaction
      let categoria: string | null = null
      let reglaId: string | null = null
      try {
        const classifyRes = await fetch(
          `${SUPABASE_URL}/functions/v1/classify-tx`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: banco.user_id,
              movimiento_id: parsed.id,
              descripcion: parsed.descripcion,
              monto: parsed.monto,
              tipo: parsed.tipo,
              banco: banco.nombre,
            }),
          }
        )
        if (classifyRes.ok) {
          const cls = await classifyRes.json()
          categoria = cls.categoria ?? null
          reglaId = cls.regla_id ?? null
        }
      } catch {
        // Classification failed — insert without category
      }

      // Upsert idempotente
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
        categoria,
        categoria_manual: false,
        regla_aplicada: reglaId,
        origen: 'email',
        cuenta: parsed.cuenta,
        raw: parsed.raw,
      })

      // ON CONFLICT: use upsert with ignoreDuplicates
      if (!error) {
        saved++
      } else if (error.code !== '23505') {
        // 23505 = unique violation (already exists) — expected and ok
        console.error(`Insert error for ${parsed.id}:`, error.message)
      }
    }

    // Update ultimo_sync
    await supabase
      .from('bancos')
      .update({ ultimo_sync: new Date().toISOString() })
      .eq('id', banco.id)

    summary[banco.nombre] = saved
  }

  return new Response(JSON.stringify({ summary, processed_at: new Date().toISOString() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
