// persofinancia/app/api/compromisos/route.ts
// CRUD for compromisos (debts/credits/cards).
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitize(body: any) {
  return {
    entidad: String(body.entidad ?? '').trim(),
    producto: String(body.producto ?? '').trim(),
    tipo: ['credito','tarjeta','prestamo','bnpl'].includes(body.tipo) ? body.tipo : 'credito',
    saldo_actual: Number(body.saldo_actual) || 0,
    cuota_mensual: Number(body.cuota_mensual) || 0,
    tasa_ea: body.tasa_ea != null && body.tasa_ea !== '' ? Number(body.tasa_ea) : null,
    dia_pago: body.dia_pago != null && body.dia_pago !== '' ? Number(body.dia_pago) : null,
    cuotas_total: body.cuotas_total != null && body.cuotas_total !== '' ? Number(body.cuotas_total) : null,
    cuotas_pagadas: body.cuotas_pagadas != null && body.cuotas_pagadas !== '' ? Number(body.cuotas_pagadas) : null,
    estado: ['al_dia','mora','congelada','liquidado'].includes(body.estado) ? body.estado : 'al_dia',
    notas: body.notas ? String(body.notas).trim() : null,
  }
}

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const data = sanitize(body)
  if (!data.entidad || !data.producto) {
    return NextResponse.json({ error: 'entidad y producto requeridos' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase.from('compromisos') as any)
    .insert({ user_id: user.id, ...data })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: row.id })
}

export async function PATCH(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const data = sanitize(body)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('compromisos') as any)
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('compromisos') as any)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
