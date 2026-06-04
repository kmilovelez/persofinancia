// persofinancia/app/(dashboard)/analitica/page.tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { parseRangeKey, rangeToDates } from '@/lib/analitica/ranges'
import { RangeSelector } from '@/components/analitica/range-selector'
import { AnaliticaClient } from './analitica-client'
import type { Movimiento, Categoria, Presupuesto } from '@/lib/types/database'

interface PageProps {
  searchParams: Promise<{ tab?: string; rango?: string; desde?: string; hasta?: string }>
}

export default async function AnaliticaPage({ searchParams }: PageProps) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const rango = parseRangeKey(params.rango)
  const custom = params.desde && params.hasta
    ? { from: params.desde, to: params.hasta }
    : undefined

  const { start, end } = rangeToDates(rango, custom)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: movs }, { data: cats }, { data: pres }, { data: comps }] = await Promise.all([
    supabase.from('movimientos').select('*').eq('user_id', user.id)
      .gte('fecha', start).lte('fecha', end)
      .order('fecha', { ascending: true }),
    supabase.from('categorias').select('*').eq('user_id', user.id),
    supabase.from('presupuestos').select('*').eq('user_id', user.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('compromisos') as any).select('*').eq('user_id', user.id).order('dia_pago'),
  ])

  const movimientos = (movs ?? []) as Movimiento[]
  const categorias = (cats ?? []) as Categoria[]
  const presupuestos = (pres ?? []) as Presupuesto[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const compromisos = (comps ?? []) as any[]

  return (
    <div className="pb-4">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold">Analitica</h1>
        <p className="text-xs text-muted-foreground">
          {start} a {end} · {movimientos.length} movimientos
        </p>
      </div>
      <Suspense fallback={null}>
        <RangeSelector />
      </Suspense>
      <AnaliticaClient
        movimientos={movimientos}
        categorias={categorias}
        presupuestos={presupuestos}
        compromisos={compromisos}
        initialTab={params.tab ?? 'resumen'}
      />
    </div>
  )
}
