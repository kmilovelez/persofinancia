// persofinancia/components/movimientos/movimiento-filters.tsx
'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const FILTERS = [
  { key: 'todos',      label: 'Todos' },
  { key: 'pendientes', label: '⚠ Pendientes' },
  { key: 'ingresos',   label: 'Ingresos' },
  { key: 'gastos',     label: 'Gastos' },
  { key: 'deuda',      label: 'Deuda' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

export function MovimientoFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = (searchParams.get('flujo') ?? 'todos') as FilterKey

  function setFilter(key: FilterKey) {
    const params = new URLSearchParams(searchParams.toString())
    if (key === 'todos') {
      params.delete('flujo')
    } else {
      params.set('flujo', key)
    }
    const query = params.toString()
    router.push(`${pathname}${query ? `?${query}` : ''}`)
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {FILTERS.map(({ key, label }) => {
        const isPendientes = key === 'pendientes'
        return (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              active === key
                ? 'bg-primary text-primary-foreground'
                : isPendientes
                  ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/25 border border-yellow-500/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
