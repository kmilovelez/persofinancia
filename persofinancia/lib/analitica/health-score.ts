// persofinancia/lib/analitica/health-score.ts
//
// Compute a financial health score (0-100) for a given period.
//
// Weights:
//  - Savings rate          40%   (target ≥ 20% of income)
//  - Debt burden            25%   (target ≤ 30% of income going to deuda)
//  - Fixed expenses ratio   20%   (target ≤ 50% of income on Fijo)
//  - Spending discipline    15%   (variance of monthly spend, lower is better)

export interface ScoreInput {
  ingresos: number
  gastos_total: number
  gastos_deuda: number
  gastos_fijos: number
  gastos_variables_por_mes: number[]  // for variance calc
}

export interface ScoreBreakdown {
  total: number              // 0-100
  ahorro: number             // 0-40
  deuda: number              // 0-25
  fijos: number              // 0-20
  disciplina: number         // 0-15
  metrics: {
    tasa_ahorro: number          // 0-100 percentage
    pct_deuda: number            // % of income
    pct_fijos: number            // % of income
    cv_variables: number         // coefficient of variation
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function computeHealthScore(input: ScoreInput): ScoreBreakdown {
  const ing = Math.max(input.ingresos, 1)  // avoid div by 0
  const balance = input.ingresos - input.gastos_total
  const tasa_ahorro = (balance / ing) * 100
  const pct_deuda = (input.gastos_deuda / ing) * 100
  const pct_fijos = (input.gastos_fijos / ing) * 100

  // Coefficient of variation for variables
  const vals = input.gastos_variables_por_mes.filter(v => v > 0)
  let cv = 0
  if (vals.length >= 2) {
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
    const sd = Math.sqrt(variance)
    cv = mean > 0 ? sd / mean : 0
  }

  // --- Scoring ---
  // Ahorro: 0% → 0pts, 20%+ → 40pts (linear)
  const ahorro = clamp((tasa_ahorro / 20) * 40, 0, 40)

  // Deuda: ≤10% → 25pts, ≥50% → 0pts (linear inverse)
  const deuda = clamp(25 - ((Math.max(pct_deuda - 10, 0)) / 40) * 25, 0, 25)

  // Fijos: ≤50% → 20pts, ≥80% → 0pts (linear inverse)
  const fijos = clamp(20 - ((Math.max(pct_fijos - 50, 0)) / 30) * 20, 0, 20)

  // Disciplina: cv ≤ 0.15 → 15pts, cv ≥ 0.5 → 0pts (linear inverse)
  const disciplina = clamp(15 - ((Math.max(cv - 0.15, 0)) / 0.35) * 15, 0, 15)

  const total = Math.round(ahorro + deuda + fijos + disciplina)

  return {
    total,
    ahorro: Math.round(ahorro),
    deuda: Math.round(deuda),
    fijos: Math.round(fijos),
    disciplina: Math.round(disciplina),
    metrics: {
      tasa_ahorro: Math.round(tasa_ahorro * 10) / 10,
      pct_deuda: Math.round(pct_deuda * 10) / 10,
      pct_fijos: Math.round(pct_fijos * 10) / 10,
      cv_variables: Math.round(cv * 1000) / 1000,
    },
  }
}

export function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Excelente', color: 'text-emerald-500' }
  if (score >= 65) return { label: 'Bueno', color: 'text-green-500' }
  if (score >= 50) return { label: 'Aceptable', color: 'text-yellow-500' }
  if (score >= 35) return { label: 'Cuidado', color: 'text-orange-500' }
  return { label: 'Crítico', color: 'text-red-500' }
}
