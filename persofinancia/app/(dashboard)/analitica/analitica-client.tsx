// persofinancia/app/(dashboard)/analitica/analitica-client.tsx
'use client'
import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Movimiento, Categoria, Presupuesto } from '@/lib/types/database'
import { ResumenTab } from '@/components/analitica/tabs/resumen-tab'
import { GastosTab } from '@/components/analitica/tabs/gastos-tab'
import { IngresosTab } from '@/components/analitica/tabs/ingresos-tab'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
  presupuestos: Presupuesto[]
  initialTab: string
}

const TABS = [
  { key: 'resumen',    label: 'Resumen' },
  { key: 'gastos',     label: 'Gastos' },
  { key: 'ingresos',   label: 'Ingresos' },
  { key: 'deuda',      label: 'Deuda' },
  { key: 'flujo',      label: 'Flujo' },
  { key: 'proyeccion', label: 'Proyeccion' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function AnaliticaClient({ movimientos, categorias, presupuestos, initialTab }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<TabKey>(
    (TABS.find(t => t.key === initialTab)?.key ?? 'resumen') as TabKey
  )

  function changeTab(key: TabKey) {
    setTab(key)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto px-4 py-2 border-b border-border no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => changeTab(t.key)}
            className={cn(
              'shrink-0 px-3 py-1.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {tab === 'resumen' && <ResumenTab movimientos={movimientos} categorias={categorias} />}
        {tab === 'gastos' && <GastosTab movimientos={movimientos} categorias={categorias} presupuestos={presupuestos} />}
        {tab === 'ingresos' && <IngresosTab movimientos={movimientos} />}
        {tab === 'deuda' && <div className="text-muted-foreground text-sm">Deuda — pending</div>}
        {tab === 'flujo' && <div className="text-muted-foreground text-sm">Flujo — pending</div>}
        {tab === 'proyeccion' && <div className="text-muted-foreground text-sm">Proyeccion — pending</div>}
      </div>
    </div>
  )
}
