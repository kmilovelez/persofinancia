// persofinancia/app/api/reglas/create-and-apply/route.ts
//
// Create a new categorization rule and immediately apply it to all uncategorized
// movs in the user's account that match its pattern.
//
// POST { patron: string, categoria: string }
// Returns: { rule_id: string, applied_to: number }
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { patron, categoria } = await req.json()
  if (!patron || !categoria) {
    return NextResponse.json({ error: 'patron and categoria required' }, { status: 400 })
  }

  // Validate category belongs to user
  const { data: cat } = await supabase
    .from('categorias')
    .select('id, nombre')
    .eq('user_id', user.id)
    .eq('nombre', categoria)
    .maybeSingle()
  if (!cat) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })

  // Create rule with priority 25 (between manual prio 20 and AI suggestions)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rule, error: ruleErr } = await (supabase.from('reglas_categoria') as any)
    .insert({
      user_id: user.id,
      categoria_id: cat.id,
      campo: 'descripcion',
      operador: 'contains',
      valor: patron,
      prioridad: 25,
      activa: true,
      origen: 'ai_suggestion',
    })
    .select('id')
    .single()

  if (ruleErr || !rule) {
    return NextResponse.json({ error: ruleErr?.message ?? 'Failed to create rule' }, { status: 500 })
  }

  // Apply rule to uncategorized movs in this user's account
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: applied, error: applyErr } = await (supabase.from('movimientos') as any)
    .update({
      categoria: cat.nombre,
      regla_aplicada: rule.id,
      confianza_ia: null,
    })
    .eq('user_id', user.id)
    .is('categoria', null)
    .ilike('descripcion', `%${patron}%`)
    .select('id')

  if (applyErr) {
    return NextResponse.json({ error: applyErr.message, rule_id: rule.id, applied_to: 0 }, { status: 200 })
  }

  return NextResponse.json({
    rule_id: rule.id,
    applied_to: applied?.length ?? 0,
  })
}
