// persofinancia/components/dashboard/health-score-card.tsx
import type { ScoreBreakdown } from '@/lib/analitica/health-score'
import { cn } from '@/lib/utils'

interface Props {
  score: ScoreBreakdown
  label: { label: string; color: string }
}

export function HealthScoreCard({ score, label }: Props) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const dash = (score.total / 100) * circumference

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeWidth="8"
            />
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={`${dash} ${circumference}`}
              strokeLinecap="round"
              className={label.color}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className={cn('text-2xl font-bold', label.color)}>{score.total}</p>
            <p className="text-[10px] text-muted-foreground">/100</p>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Salud financiera</p>
          <p className={cn('font-semibold', label.color)}>{label.label}</p>
          <div className="space-y-1 mt-2 text-xs">
            <Row label="Ahorro" value={score.ahorro} max={40} accent="emerald" />
            <Row label="Deuda" value={score.deuda} max={25} accent="rose" />
            <Row label="Fijos" value={score.fijos} max={20} accent="blue" />
            <Row label="Disciplina" value={score.disciplina} max={15} accent="purple" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, max, accent }: { label: string; value: number; max: number; accent: string }) {
  const pct = (value / max) * 100
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-16 text-[10px]">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            accent === 'emerald' && 'bg-emerald-500',
            accent === 'rose' && 'bg-rose-500',
            accent === 'blue' && 'bg-blue-500',
            accent === 'purple' && 'bg-purple-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-muted-foreground w-10 text-right text-[10px]">{value}/{max}</span>
    </div>
  )
}
