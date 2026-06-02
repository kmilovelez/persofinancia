// persofinancia/lib/analitica/projection.ts
import type { Movimiento } from '@/lib/types/database'

interface ProjectionResult {
  actualToDate: number
  dailyAverage: number
  daysRemaining: number
  projected: number
}

export function projectCurrentMonth(
  movs: Movimiento[],
  flujo: 'in' | 'out',
  currentMonth: string,
  trailing: number = 3,
  now: Date = new Date()
): ProjectionResult {
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const actualToDate = movs
    .filter(m => m.flujo === flujo && m.fecha.startsWith(currentMonth) && m.fecha <= todayIso)
    .reduce((s, m) => s + Number(m.monto), 0)

  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysRemaining = lastDayOfMonth - now.getDate()

  const dailyAverage = calculateTrailingDailyAverage(movs, flujo, currentMonth, trailing)

  return {
    actualToDate,
    dailyAverage,
    daysRemaining,
    projected: actualToDate + dailyAverage * daysRemaining,
  }
}

function calculateTrailingDailyAverage(
  movs: Movimiento[],
  flujo: 'in' | 'out',
  currentMonth: string,
  trailing: number
): number {
  const monthsBefore = Array.from(
    new Set(movs.filter(m => m.fecha.slice(0, 7) < currentMonth).map(m => m.fecha.slice(0, 7)))
  ).sort((a, b) => b.localeCompare(a))

  if (monthsBefore.length === 0) return 0

  const cutoff = monthsAgo(currentMonth, 6)
  const recentMonths = monthsBefore.filter(m => m >= cutoff).slice(0, trailing)

  if (recentMonths.length === 0) return 0

  let totalSum = 0
  let totalDays = 0

  for (const mes of recentMonths) {
    const [yearStr, monthStr] = mes.split('-')
    const daysInMonth = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate()
    const monthTotal = movs
      .filter(m => m.flujo === flujo && m.fecha.startsWith(mes))
      .reduce((s, m) => s + Number(m.monto), 0)
    totalSum += monthTotal
    totalDays += daysInMonth
  }

  return totalDays > 0 ? totalSum / totalDays : 0
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function monthsAgo(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m - 1 - n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
