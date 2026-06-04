// persofinancia/app/(dashboard)/config/compromisos/page.tsx
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { CompromisosClient } from './compromisos-client'

export const dynamic = 'force-dynamic'

interface Compromiso {
  id: string
  entidad: string
  producto: string
  tipo: 'credito' | 'tarjeta' | 'prestamo' | 'bnpl'
  saldo_actual: number
  cuota_mensual: number
  tasa_ea: number | null
  dia_pago: number | null
  cuotas_total: number | null
  cuotas_pagadas: number | null
  estado: 'al_dia' | 'mora' | 'congelada' | 'liquidado'
  notas: string | null
}

export default async function ConfigCompromisosPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('compromisos') as any)
    .select('*')
    .eq('user_id', user.id)
    .order('dia_pago', { ascending: true, nullsFirst: false })

  return <CompromisosClient initial={(data ?? []) as Compromiso[]} />
}
