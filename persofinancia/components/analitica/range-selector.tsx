// persofinancia/components/analitica/range-selector.tsx
'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { RANGE_LABELS, RANGE_ORDER, parseRangeKey, type RangeKey } from '@/lib/analitica/ranges'

export function RangeSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = parseRangeKey(searchParams.get('rango'))

  function setRange(key: RangeKey) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('rango', key)
    if (key !== 'custom') {
      params.delete('desde')
      params.delete('hasta')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border">
      <div className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
        {RANGE_ORDER.map(key => (
          <button
            key={key}
            onClick={() => setRange(key)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              current === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {RANGE_LABELS[key]}
          </button>
        ))}
      </div>
    </div>
  )
}
