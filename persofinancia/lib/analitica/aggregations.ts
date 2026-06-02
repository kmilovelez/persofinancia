// persofinancia/lib/analitica/aggregations.ts
import type { Movimiento } from '@/lib/types/database'

export interface CategoriaTotal {
  categoria: string
  total: number
  count: number
}

export interface MesTotal {
  mes: string         // YYYY-MM
  ingresos: number
  gastos: number
  neto: number
}

export interface EntidadTotal {
  entidad: string
  total: number
}

export interface TipoTotal {
  tipo: string
  total: number
}

export function groupByCategoria(movs: Movimiento[]): CategoriaTotal[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const m of movs) {
    if (!m.categoria) continue
    const prev = map.get(m.categoria) ?? { total: 0, count: 0 }
    map.set(m.categoria, {
      total: prev.total + Number(m.monto),
      count: prev.count + 1,
    })
  }
  return Array.from(map.entries())
    .map(([categoria, v]) => ({ categoria, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)
}

export function groupByMes(movs: Movimiento[]): MesTotal[] {
  const map = new Map<string, { ingresos: number; gastos: number }>()
  for (const m of movs) {
    const mes = m.fecha.slice(0, 7)
    const prev = map.get(mes) ?? { ingresos: 0, gastos: 0 }
    if (m.flujo === 'in') prev.ingresos += Number(m.monto)
    else prev.gastos += Number(m.monto)
    map.set(mes, prev)
  }
  return Array.from(map.entries())
    .map(([mes, v]) => ({
      mes,
      ingresos: v.ingresos,
      gastos: v.gastos,
      neto: v.ingresos - v.gastos,
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes))
}

export function groupByEntidad(movs: Movimiento[]): EntidadTotal[] {
  const map = new Map<string, number>()
  for (const m of movs) {
    if (m.flujo !== 'out') continue
    const entidad = extractEntity(m.descripcion)
    if (!entidad) continue
    map.set(entidad, (map.get(entidad) ?? 0) + Number(m.monto))
  }
  return Array.from(map.entries())
    .map(([entidad, total]) => ({ entidad, total }))
    .sort((a, b) => b.total - a.total)
}

function extractEntity(descripcion: string): string {
  const words = descripcion.trim().toUpperCase().split(/\s+/).slice(0, 3)
  return words.join(' ')
}

export function groupByTipo(movs: Movimiento[], flujo?: 'in' | 'out'): TipoTotal[] {
  const map = new Map<string, number>()
  for (const m of movs) {
    if (flujo && m.flujo !== flujo) continue
    map.set(m.tipo, (map.get(m.tipo) ?? 0) + Number(m.monto))
  }
  return Array.from(map.entries())
    .map(([tipo, total]) => ({ tipo, total }))
    .sort((a, b) => b.total - a.total)
}

export function topNWithOthers<T extends { total: number }>(
  items: T[],
  n: number,
  labelKey: keyof T,
  othersLabel: string = 'Otros'
): T[] {
  if (items.length <= n) return items
  const top = items.slice(0, n)
  const otrosTotal = items.slice(n).reduce((s, x) => s + x.total, 0)
  const otros = { ...top[0], [labelKey]: othersLabel, total: otrosTotal } as T
  return [...top, otros]
}

export function sumByFlujo(movs: Movimiento[], flujo: 'in' | 'out'): number {
  return movs.filter(m => m.flujo === flujo).reduce((s, m) => s + Number(m.monto), 0)
}

export function dailyCumulative(movs: Movimiento[], yyyymm: string): { day: number; cumulative: number }[] {
  const dailyMap = new Map<number, number>()
  for (const m of movs) {
    if (m.flujo !== 'out') continue
    if (!m.fecha.startsWith(yyyymm)) continue
    const day = parseInt(m.fecha.slice(8, 10), 10)
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + Number(m.monto))
  }

  const result: { day: number; cumulative: number }[] = []
  let cumulative = 0
  for (let d = 1; d <= 31; d++) {
    cumulative += dailyMap.get(d) ?? 0
    result.push({ day: d, cumulative })
  }
  return result
}
