// persofinancia/lib/analitica/regression.ts

export interface Point {
  x: number
  y: number
}

export interface RegressionResult {
  slope: number
  intercept: number
  r2: number
  predict: (x: number) => number
  confidenceBand: (x: number, sigma?: number) => { lo: number; hi: number }
  residualStd: number
}

export function linearRegression(points: Point[]): RegressionResult {
  if (points.length < 2) {
    return {
      slope: 0,
      intercept: points[0]?.y ?? 0,
      r2: 0,
      residualStd: 0,
      predict: () => points[0]?.y ?? 0,
      confidenceBand: () => ({ lo: 0, hi: 0 }),
    }
  }

  const n = points.length
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)
  const meanY = sumY / n

  const denominator = n * sumX2 - sumX * sumX
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  let ssRes = 0
  let ssTot = 0
  for (const p of points) {
    const predicted = slope * p.x + intercept
    ssRes += (p.y - predicted) ** 2
    ssTot += (p.y - meanY) ** 2
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot

  const residualStd = Math.sqrt(ssRes / Math.max(1, n - 2))

  const predict = (x: number) => slope * x + intercept

  const confidenceBand = (x: number, sigma: number = 1) => {
    const center = predict(x)
    return {
      lo: center - sigma * residualStd,
      hi: center + sigma * residualStd,
    }
  }

  return { slope, intercept, r2, residualStd, predict, confidenceBand }
}

export interface MonthlyTotal {
  mes: string
  total: number
}

export interface ForecastPoint {
  mes: string
  predicted: number
  lo: number
  hi: number
}

export function forecast(
  monthlyTotals: MonthlyTotal[],
  monthsAhead: number = 3,
  currentMonth?: string
): { points: ForecastPoint[]; regression: RegressionResult } {
  const completed = currentMonth
    ? monthlyTotals.filter(m => m.mes < currentMonth)
    : monthlyTotals

  const sorted = [...completed].sort((a, b) => a.mes.localeCompare(b.mes))
  const points: Point[] = sorted.map((m, i) => ({ x: i, y: m.total }))

  const reg = linearRegression(points)
  const lastIndex = points.length - 1
  const lastMonth = sorted[sorted.length - 1]?.mes ?? currentMonth ?? '2026-01'

  const forecastPoints: ForecastPoint[] = []
  for (let i = 1; i <= monthsAhead; i++) {
    const futureIndex = lastIndex + i
    const center = reg.predict(futureIndex)
    const band = reg.confidenceBand(futureIndex)
    forecastPoints.push({
      mes: addMonths(lastMonth, i),
      predicted: center,
      lo: band.lo,
      hi: band.hi,
    })
  }

  return { points: forecastPoints, regression: reg }
}

function addMonths(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
}
