// persofinancia/lib/utils/currency.ts
const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

// Formato completo: $10.400.000 (siempre con valor real, sin reducir a M/K)
export function fmt(amount: number): string {
  return COP.format(amount)
}

// Alias por compatibilidad
export function fmtFull(amount: number): string {
  return COP.format(amount)
}

// Formato compacto: $10.4M / $720K — usar SOLO en ejes de charts
export function fmtCompact(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return COP.format(amount)
}
