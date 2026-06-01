const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre'
]

export function yesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function fmtDate(isoDate: string): string {
  const [, m, d] = isoDate.split('-')
  return `${parseInt(d)} ${MESES[parseInt(m) - 1]}`
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}
