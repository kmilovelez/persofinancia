// persofinancia/supabase/functions/classify-tx/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ClassifyRequest {
  user_id: string
  movimiento_id: string
  descripcion: string
  monto: number
  tipo: string
  banco: string
}

interface ClassifyResult {
  categoria: string | null
  confianza: number
  regla_id: string | null
  metodo: 'regla_manual' | 'regla_ia' | 'claude' | 'pendiente'
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  let body: ClassifyRequest
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders })
  }

  const { user_id, descripcion, monto, tipo } = body

  if (!user_id || !descripcion) {
    return new Response('Missing required fields', { status: 400, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // LAYER 1+2: Evaluate rules (manual first, then AI suggestions)
  const { data: reglas } = await supabase
    .from('reglas_categoria')
    .select('id, campo, operador, valor, origen, aplicaciones, categorias(nombre)')
    .eq('user_id', user_id)
    .eq('activa', true)
    .order('origen', { ascending: false }) // 'manual' > 'ai_suggestion' alphabetically
    .order('prioridad', { ascending: true })

  for (const regla of reglas ?? []) {
    const campoValor =
      regla.campo === 'descripcion' ? descripcion
      : regla.campo === 'tipo' ? tipo
      : regla.campo === 'monto' ? String(monto)
      : ''

    let match = false
    const v = regla.valor ?? ''
    switch (regla.operador) {
      case 'contains':    match = campoValor.toUpperCase().includes(v.toUpperCase()); break
      case 'starts_with': match = campoValor.toUpperCase().startsWith(v.toUpperCase()); break
      case 'equals':      match = campoValor.toUpperCase() === v.toUpperCase(); break
      case 'gt':          match = Number(campoValor) > Number(v); break
      case 'lt':          match = Number(campoValor) < Number(v); break
    }

    if (match) {
      // Increment application counter
      await supabase
        .from('reglas_categoria')
        .update({ aplicaciones: (regla.aplicaciones ?? 0) + 1 })
        .eq('id', regla.id)

      const result: ClassifyResult = {
        categoria: (regla as any).categorias?.nombre ?? null,
        confianza: 100,
        regla_id: regla.id,
        metodo: regla.origen === 'manual' ? 'regla_manual' : 'regla_ia',
      }
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // LAYER 3: Claude fallback
  const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')
  if (!CLAUDE_API_KEY) {
    const result: ClassifyResult = {
      categoria: null,
      confianza: 0,
      regla_id: null,
      metodo: 'pendiente',
    }
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get user categories for context
  const { data: categorias } = await supabase
    .from('categorias')
    .select('nombre, grupo')
    .eq('user_id', user_id)

  const categoriasStr =
    categorias?.map((c) => `- ${c.nombre} (${c.grupo})`).join('\n') ??
    '- Otros (Variable)'

  let claudeResult = { categoria: null as string | null, confianza: 0 }
  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `Clasifica esta transaccion financiera colombiana en UNA de las categorias disponibles.

Transaccion: "${descripcion}" | Monto: $${monto} COP | Tipo: ${tipo}

Categorias disponibles:
${categoriasStr}

Responde SOLO con JSON valido: {"categoria": "nombre exacto de la categoria", "confianza": numero_0_a_100}
Si no encaja en ninguna usa "Otros" con confianza baja. No expliques nada mas.`,
          },
        ],
      }),
    })

    if (claudeRes.ok) {
      const claudeData = await claudeRes.json()
      const text = claudeData.content?.[0]?.text ?? '{}'
      // Extract JSON from response (may have surrounding text)
      const jsonMatch = text.match(/\{[^}]+\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        claudeResult = {
          categoria: typeof parsed.categoria === 'string' ? parsed.categoria : null,
          confianza: typeof parsed.confianza === 'number' ? Math.min(100, Math.max(0, parsed.confianza)) : 0,
        }
      }
    }
  } catch {
    // Claude unavailable — return pendiente
  }

  const metodo: ClassifyResult['metodo'] =
    claudeResult.confianza >= 70 ? 'claude' : 'pendiente'

  const result: ClassifyResult = {
    categoria: metodo === 'pendiente' ? null : claudeResult.categoria,
    confianza: claudeResult.confianza,
    regla_id: null,
    metodo,
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
