// persofinancia/app/(dashboard)/movimientos/page.tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { MovimientoFilters } from '@/components/movimientos/movimiento-filters'
import { MovimientosListClient } from '@/components/movimientos/movimientos-list-client'
import type { Movimiento } from '@/lib/types/database'

interface PageProps {
  searchParams: Promise<{ flujo?: string }>
}

async function fetchMovimientos(
  userId: string,
  flujo?: string
): Promise<Movimiento[]> {
  const supabase = await getSupabaseServerClient()

  let query = supabase
    .from('movimientos')
    .select('*')
    .eq('user_id', userId)
    .order('fecha', { ascending: false })
    .order('hora', { ascending: false })
    .limit(50)

  if (flujo === 'ingresos') {
    query = query.eq('flujo', 'in')
  } else if (flujo === 'gastos') {
    query = query.eq('flujo', 'out').neq('categoria', 'Deuda')
  } else if (flujo === 'deuda') {
    query = query.eq('categoria', 'Deuda')
  }

  const { data } = await query
  return (data ?? []) as Movimiento[]
}

export default async function MovimientosPage({ searchParams }: PageProps) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const movimientos = await fetchMovimientos(user.id, params.flujo)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-4">
        <h1 className="text-xl font-bold">Movimientos</h1>
        <Link
          href="/movimientos/nuevo"
          className="flex items-center gap-1 bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo
        </Link>
      </div>

      <Suspense fallback={null}>
        <MovimientoFilters />
      </Suspense>

      <MovimientosListClient movimientos={movimientos} />
    </div>
  )
}
