// persofinancia/lib/analitica/ranges.ts

export type RangeKey = '1m' | '3m' | '6m' | '12m' | 'ytd' | 'custom'

export const RANGE_LABELS: Record<RangeKey, string> = {
  '1m': '1M',
  '3m': '3M',
  '6m': '6M',
  '12m': '12M',
  'ytd': 'YTD',
  'custom': 'Personalizado',
}

export const RANGE_ORDER: RangeKey[] = ['1m', '3m', '6m', '12m', 'ytd', 'custom']

export const DEFAULT_RANGE: RangeKey = '3m'

interface CustomRange {
  from: string  // YYYY-MM-DD
  to: string    // YYYY-MM-DD
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function rangeToDates(
  key: RangeKey,
  custom?: CustomRange,
  now: Date = new Date()
): { start: string; end: string } {
  const end = toISO(now)

  if (key === 'custom' && custom) {
    return { start: custom.from, end: custom.to }
  }

  if (key === 'ytd') {
    return { start: `${now.getFullYear()}-01-01`, end }
  }

  const monthsBack: Record<Exclude<RangeKey, 'ytd' | 'custom'>, number> = {
    '1m': 1,
    '3m': 3,
    '6m': 6,
    '12m': 12,
  }

  const months = monthsBack[key as Exclude<RangeKey, 'ytd' | 'custom'>] ?? 3
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)

  return { start: toISO(startDate), end }
}

export function parseRangeKey(value: string | null | undefined): RangeKey {
  if (!value) return DEFAULT_RANGE
  return (RANGE_ORDER as string[]).includes(value)
    ? (value as RangeKey)
    : DEFAULT_RANGE
}
