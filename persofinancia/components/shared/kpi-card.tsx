// persofinancia/components/shared/kpi-card.tsx
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string
  positive?: boolean
  highlight?: boolean
  className?: string
}

export function KpiCard({ label, value, positive, highlight, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-xl p-4 border',
        highlight && positive ? 'border-green-500/30' : '',
        highlight && positive === false ? 'border-red-500/30' : '',
        !highlight ? 'border-border' : '',
        className
      )}
    >
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
        {label}
      </p>
      <p
        className={cn(
          'text-2xl font-bold mt-1',
          positive === true ? 'text-green-500' : '',
          positive === false ? 'text-red-500' : ''
        )}
      >
        {value}
      </p>
    </div>
  )
}
