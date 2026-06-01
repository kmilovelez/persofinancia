// persofinancia/app/(dashboard)/movimientos/page.tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { MovimientoFilters } from '@/components/movimientos/movimiento-filters'
import { MovimientosPageClient } from './movimientos-page-client'
import type { Movimiento, Categoria } from '@/lib/types/database'

interface PageProps {
  searchParams: Promise<{ flujo?: string }>
}

async function fetchMovimientos(userId: string, flujo?: string): Promise<Movimiento[]> {
  const supabase = await getSupabaseServerClient()
  let query = supabase
    .from('movimientos')
    .select('*')
    .eq('user_id', userId)
    .order('fecha', { ascending: false })
    .order('hora', { ascending: false })
    .limit(50)

  if (flujo === 'ingresos') query = query.eq('flujo', 'in')
  else if (flujo === 'gastos') query = query.eq('flujo', 'out').neq('categoria', 'Deuda')
  else if (flujo === 'deuda') query = query.eq('categoria', 'Deuda')

  const { data } = await query
  return (data ?? []) as Movimiento[]
}

export default async function MovimientosPage({ searchParams }: PageProps) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const [movimientos, categoriasResult] = await Promise.all([
    fetchMovimientos(user.id, params.flujo),
    supabase.from('categorias').select('*').eq('user_id', user.id).order('nombre'),
  ])
  const categorias = (categoriasResult.data ?? []) as Categoria[]

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

      <MovimientosPageClient movimientos={movimientos} categorias={categorias} />
    </div>
  )
}
