// persofinancia/app/(dashboard)/alertas/page.tsx
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { AlertasClient } from './alertas-client'

export const dynamic = 'force-dynamic'

interface Alerta {
  id: string
  tipo: string
  titulo: string
  mensaje: string
  severidad: 'info' | 'warning' | 'danger'
  leida: boolean
  descartada: boolean
  movimiento_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export default async function AlertasPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('alertas') as any)
    .select('id, tipo, titulo, mensaje, severidad, leida, descartada, movimiento_id, metadata, created_at')
    .eq('user_id', user.id)
    .eq('descartada', false)
    .order('created_at', { ascending: false })
    .limit(100)

  return <AlertasClient initial={(data ?? []) as Alerta[]} />
}
