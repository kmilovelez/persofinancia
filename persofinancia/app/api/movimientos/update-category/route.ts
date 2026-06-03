// persofinancia/app/api/movimientos/update-category/route.ts
// Update categoria + confianza_ia of one (or many) movimientos for the current user.
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Body {
  mov_id?: string         // Single mov
  mov_ids?: string[]      // Bulk mode
  categoria: string
  confianza_ia?: number | null
}

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as Body
  if (!body.categoria) {
    return NextResponse.json({ error: 'categoria required' }, { status: 400 })
  }

  const ids = body.mov_ids ?? (body.mov_id ? [body.mov_id] : [])
  if (ids.length === 0) {
    return NextResponse.json({ error: 'mov_id or mov_ids required' }, { status: 400 })
  }

  // Validate the category belongs to the user
  const { data: cat } = await supabase
    .from('categorias')
    .select('nombre')
    .eq('user_id', user.id)
    .eq('nombre', body.categoria)
    .maybeSingle()
  if (!cat) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('movimientos') as any)
    .update({
      categoria: body.categoria,
      confianza_ia: body.confianza_ia ?? null,
      categoria_manual: body.confianza_ia == null,
    })
    .eq('user_id', user.id)
    .in('id', ids)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ updated: data?.length ?? 0 })
}
