// persofinancia/lib/utils/dates.ts
const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre'
]

function padTwo(n: number): string {
  return n.toString().padStart(2, '0')
}

function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`
}

export function yesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return localDateString(d)
}

export function fmtDate(isoDate: string): string {
  const date = isoDate.slice(0, 10) // guard: take only YYYY-MM-DD
  const [, m, d] = date.split('-')
  return `${parseInt(d)} ${MESES[parseInt(m) - 1]}`
}

export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}`
}
