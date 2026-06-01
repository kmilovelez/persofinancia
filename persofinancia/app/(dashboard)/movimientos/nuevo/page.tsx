// persofinancia/app/(dashboard)/movimientos/nuevo/page.tsx
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { MovimientoForm } from '@/components/movimientos/movimiento-form'

export default async function NuevoMovimientoPage() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, nombre')
    .eq('user_id', user.id)
    .order('nombre')

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4 pt-4">Nuevo movimiento</h1>
      <MovimientoForm userId={user.id} categorias={categorias ?? []} />
    </div>
  )
}
