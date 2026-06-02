# PersoFinancIA Fase 3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el dashboard de analítica de PersoFinancIA al stack Next.js 14 + Recharts. Implementar 6 sub-tabs con ~14 gráficas, selector de rango URL-driven, proyección de meses incompletos, tabla `presupuestos` persistida, y rewrite jerárquico del CRUD de categorías.

**Architecture:** Página `/analitica` como Server Component que hace una sola query a Supabase con todos los movimientos del rango. Pasa data al Client Component que maneja sub-tabs internamente y hace agregaciones in-memory. Cada gráfica es un componente focalizado en `components/analitica/charts/` que recibe data ya agregada. Funciones puras en `lib/analitica/` para agregaciones, proyecciones y regresiones.

**Tech Stack:** Next.js 14 App Router + TypeScript + Recharts + shadcn/ui + Tailwind + Supabase (PostgreSQL con RLS)

---

## Estructura de archivos

```
persofinancia/
├── app/(dashboard)/
│   ├── analitica/
│   │   ├── page.tsx                              ← Server: fetch + render shell
│   │   ├── analitica-client.tsx                  ← Client: tabs + state
│   │   └── _ranges.ts                            ← Constants
│   └── config/
│       ├── categorias/page.tsx                   ← REESCRITA
│       └── presupuestos/page.tsx                 ← NUEVA
├── components/
│   ├── analitica/
│   │   ├── range-selector.tsx
│   │   ├── tabs/
│   │   │   ├── resumen-tab.tsx
│   │   │   ├── gastos-tab.tsx
│   │   │   ├── ingresos-tab.tsx
│   │   │   ├── deuda-tab.tsx
│   │   │   ├── flujo-tab.tsx
│   │   │   └── proyeccion-tab.tsx
│   │   ├── charts/
│   │   │   ├── allocation-50-30-20.tsx
│   │   │   ├── allocation-by-grupo.tsx
│   │   │   ├── category-donut.tsx
│   │   │   ├── top-merchants-bar.tsx
│   │   │   ├── monthly-bars.tsx
│   │   │   ├── category-trend-line.tsx
│   │   │   ├── budget-vs-actual.tsx
│   │   │   ├── daily-cumulative.tsx
│   │   │   ├── income-by-type-bar.tsx
│   │   │   ├── debt-by-month-line.tsx
│   │   │   ├── debt-by-entity-bar.tsx
│   │   │   ├── cashflow-combo.tsx
│   │   │   ├── cashflow-table.tsx
│   │   │   └── projection-line.tsx
│   │   ├── cards/
│   │   │   └── behavior-metrics.tsx
│   │   └── shared/
│   │       └── chart-empty.tsx
│   └── config/
│       ├── categoria-tree.tsx
│       ├── categoria-form-dialog.tsx
│       └── presupuesto-item.tsx
├── lib/
│   └── analitica/
│       ├── ranges.ts
│       ├── aggregations.ts
│       ├── projection.ts
│       ├── regression.ts
│       └── colors.ts
└── supabase/migrations/
    └── 20260602000001_presupuestos.sql
```

---

## FASE A — Fundaciones (DB + Tipos + Librerías puras)

### Task 1: Migración SQL `presupuestos`

**Files:**
- Create: `persofinancia/supabase/migrations/20260602000001_presupuestos.sql`

- [ ] **Step 1.1: Crear archivo de migración**

```sql
-- persofinancia/supabase/migrations/20260602000001_presupuestos.sql

CREATE TABLE IF NOT EXISTS public.presupuestos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  monto        NUMERIC(15,2) NOT NULL CHECK (monto >= 0),
  activo       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, categoria_id)
);

CREATE INDEX IF NOT EXISTS idx_presupuestos_user ON public.presupuestos(user_id);

ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presupuestos_own" ON public.presupuestos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER presupuestos_updated_at
  BEFORE UPDATE ON public.presupuestos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [ ] **Step 1.2: Aplicar migración vía MCP**

El controlador del plan debe ejecutar:
```typescript
mcp__8d123f92__apply_migration({
  project_id: 'hgvgjwvwiycuxcebqfvx',
  name: 'fase3_presupuestos',
  query: '<contenido del archivo>'
})
```

Si aplica desde local con CLI:
```bash
cd persofinancia
npx supabase db push
```

- [ ] **Step 1.3: Verificar**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='presupuestos';
```

Expected: `id, user_id, categoria_id, monto, activo, created_at, updated_at`

- [ ] **Step 1.4: Commit**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/supabase/migrations/
git commit -m "feat(db): add presupuestos table with RLS and updated_at trigger"
```

---

### Task 2: Actualizar tipos TypeScript

**Files:**
- Modify: `persofinancia/lib/types/database.ts`

- [ ] **Step 2.1: Agregar interface `Presupuesto`**

Abrir `persofinancia/lib/types/database.ts` y agregar después de la interface `Alerta`:

```typescript
export interface Presupuesto {
  id: string
  user_id: string
  categoria_id: string
  monto: number
  activo: boolean
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2.2: Agregar tabla a Database**

En la misma interface `Database.public.Tables`, agregar:

```typescript
      presupuestos: {
        Row: Presupuesto
        Insert: Omit<Presupuesto, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Presupuesto>
      }
```

- [ ] **Step 2.3: Verificar tipos**

```bash
cd persofinancia
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2.4: Commit**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/lib/types/database.ts
git commit -m "feat(types): add Presupuesto type and table to Database interface"
```

---

### Task 3: Librería de rangos (`lib/analitica/ranges.ts`)

**Files:**
- Create: `persofinancia/lib/analitica/ranges.ts`

- [ ] **Step 3.1: Crear archivo**

```typescript
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

/**
 * Convert a range key to absolute start/end dates (inclusive).
 * For ranges relative to current month, "now" is the last day of the rolling window.
 */
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
```

- [ ] **Step 3.2: Verificar TypeScript**

```bash
cd persofinancia && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3.3: Commit**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/lib/analitica/
git commit -m "feat(analitica): add ranges library with rangeToDates and parseRangeKey"
```

---

### Task 4: Librería de agregaciones (`lib/analitica/aggregations.ts`)

**Files:**
- Create: `persofinancia/lib/analitica/aggregations.ts`

- [ ] **Step 4.1: Crear archivo**

```typescript
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

/**
 * Group movements by categoria (ignores null/empty categorias).
 * Returns sorted descending by total.
 */
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

/**
 * Group movements by month (YYYY-MM). Returns sorted ascending by mes.
 */
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

/**
 * Extract "entity" from descripcion: first 2-3 words uppercase.
 * Groups outgoing movements by extracted entity.
 */
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

/**
 * Group movements by tipo. Useful for "income by type" breakdown.
 */
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

/**
 * Return top N items + an aggregated "Otros" row for the rest.
 */
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

/**
 * Sum monto by flujo type
 */
export function sumByFlujo(movs: Movimiento[], flujo: 'in' | 'out'): number {
  return movs.filter(m => m.flujo === flujo).reduce((s, m) => s + Number(m.monto), 0)
}

/**
 * Daily cumulative spend within a given month. Returns array of { day, cumulative }.
 */
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
```

- [ ] **Step 4.2: Verificar TypeScript**

```bash
cd persofinancia && npx tsc --noEmit
```

- [ ] **Step 4.3: Commit**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/lib/analitica/
git commit -m "feat(analitica): add aggregations library (groupBy categoria/mes/entidad/tipo)"
```

---

### Task 5: Librería de proyección (`lib/analitica/projection.ts`)

**Files:**
- Create: `persofinancia/lib/analitica/projection.ts`

- [ ] **Step 5.1: Crear archivo**

```typescript
// persofinancia/lib/analitica/projection.ts
import type { Movimiento } from '@/lib/types/database'

interface ProjectionResult {
  actualToDate: number      // Gasto/ingreso real hasta hoy en el mes en curso
  dailyAverage: number      // Promedio diario de los últimos N meses completos
  daysRemaining: number     // Días restantes hasta fin de mes
  projected: number         // Proyección al cierre = actual + (dailyAvg × daysRemaining)
}

/**
 * Project current month's total spending or income.
 *
 * Uses trailing N complete months' daily average to extrapolate the rest of the month.
 * If there are fewer than N complete months in the data, uses all available.
 */
export function projectCurrentMonth(
  movs: Movimiento[],
  flujo: 'in' | 'out',
  currentMonth: string,    // YYYY-MM
  trailing: number = 3,
  now: Date = new Date()
): ProjectionResult {
  // Actual to-date in current month
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const actualToDate = movs
    .filter(m => m.flujo === flujo && m.fecha.startsWith(currentMonth) && m.fecha <= todayIso)
    .reduce((s, m) => s + Number(m.monto), 0)

  // Days remaining in current month
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysRemaining = lastDayOfMonth - now.getDate()

  // Trailing complete months daily average
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
  // Get unique months (YYYY-MM) before current, sorted descending
  const monthsBefore = Array.from(
    new Set(movs.filter(m => m.fecha.slice(0, 7) < currentMonth).map(m => m.fecha.slice(0, 7)))
  ).sort((a, b) => b.localeCompare(a))

  if (monthsBefore.length === 0) return 0

  // Take the most recent N (but skip if too old — > 6 months ago)
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
```

- [ ] **Step 5.2: Verificar TypeScript**

```bash
cd persofinancia && npx tsc --noEmit
```

- [ ] **Step 5.3: Commit**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/lib/analitica/projection.ts
git commit -m "feat(analitica): add projection library with trailing 3-mo daily average"
```

---

### Task 6: Librería de regresión (`lib/analitica/regression.ts`)

**Files:**
- Create: `persofinancia/lib/analitica/regression.ts`

- [ ] **Step 6.1: Crear archivo**

```typescript
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

/**
 * Simple linear regression: y = mx + b
 * Returns slope, intercept, R², predict(), and confidence band based on residual std.
 */
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

  // R²
  let ssRes = 0
  let ssTot = 0
  for (const p of points) {
    const predicted = slope * p.x + intercept
    ssRes += (p.y - predicted) ** 2
    ssTot += (p.y - meanY) ** 2
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot

  // Residual standard deviation
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
  mes: string  // YYYY-MM
  total: number
}

export interface ForecastPoint {
  mes: string
  predicted: number
  lo: number
  hi: number
}

/**
 * Forecast N months ahead using linear regression on historical monthly totals.
 * Excludes the current month (assumed incomplete).
 */
export function forecast(
  monthlyTotals: MonthlyTotal[],
  monthsAhead: number = 3,
  currentMonth?: string
): { points: ForecastPoint[]; regression: RegressionResult } {
  // Exclude current month
  const completed = currentMonth
    ? monthlyTotals.filter(m => m.mes < currentMonth)
    : monthlyTotals

  // Sort ascending by mes
  const sorted = [...completed].sort((a, b) => a.mes.localeCompare(b.mes))

  // Map mes to numeric index for regression
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
```

- [ ] **Step 6.2: Verificar TypeScript**

```bash
cd persofinancia && npx tsc --noEmit
```

- [ ] **Step 6.3: Commit**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/lib/analitica/regression.ts
git commit -m "feat(analitica): add linear regression library with R2 and confidence bands"
```

---

### Task 7: Hook de colores tema-aware (`lib/analitica/colors.ts`)

**Files:**
- Create: `persofinancia/lib/analitica/colors.ts`

- [ ] **Step 7.1: Crear archivo**

```typescript
// persofinancia/lib/analitica/colors.ts
'use client'
import { useEffect, useState } from 'react'

export interface ChartColors {
  income: string
  expense: string
  debt: string
  primary: string
  muted: string
  grid: string
  text: string
  background: string
  // Categorical palette (10 distinct colors balanced for light/dark)
  palette: string[]
}

const LIGHT_PALETTE = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#eab308', // yellow
  '#ef4444', // red
  '#06b6d4', // cyan
  '#84cc16', // lime
]

const DARK_PALETTE = [
  '#60a5fa', // blue lighter
  '#4ade80', // green lighter
  '#fb923c', // orange lighter
  '#c084fc', // purple lighter
  '#f472b6', // pink lighter
  '#2dd4bf', // teal lighter
  '#facc15', // yellow lighter
  '#f87171', // red lighter
  '#22d3ee', // cyan lighter
  '#a3e635', // lime lighter
]

function readCSSVar(varName: string): string {
  if (typeof window === 'undefined') return ''
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return value ? `hsl(${value})` : ''
}

function isDark(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>({
    income: '#22c55e',
    expense: '#ef4444',
    debt: '#3b82f6',
    primary: '#3b82f6',
    muted: '#94a3b8',
    grid: '#e2e8f0',
    text: '#0f172a',
    background: '#ffffff',
    palette: LIGHT_PALETTE,
  })

  useEffect(() => {
    function compute() {
      const dark = isDark()
      setColors({
        income: readCSSVar('--income') || (dark ? '#4ade80' : '#22c55e'),
        expense: readCSSVar('--expense') || (dark ? '#f87171' : '#ef4444'),
        debt: readCSSVar('--debt') || (dark ? '#60a5fa' : '#3b82f6'),
        primary: readCSSVar('--primary') || (dark ? '#60a5fa' : '#3b82f6'),
        muted: readCSSVar('--muted-foreground') || (dark ? '#94a3b8' : '#64748b'),
        grid: readCSSVar('--border') || (dark ? '#334155' : '#e2e8f0'),
        text: readCSSVar('--foreground') || (dark ? '#f1f5f9' : '#0f172a'),
        background: readCSSVar('--background') || (dark ? '#0f172a' : '#ffffff'),
        palette: dark ? DARK_PALETTE : LIGHT_PALETTE,
      })
    }

    compute()

    // React to theme changes
    const observer = new MutationObserver(compute)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return colors
}
```

- [ ] **Step 7.2: Verificar TypeScript**

```bash
cd persofinancia && npx tsc --noEmit
```

- [ ] **Step 7.3: Commit**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/lib/analitica/colors.ts
git commit -m "feat(analitica): add useChartColors hook for theme-aware Recharts"
```

---

### Task 8: Componente compartido `ChartEmpty`

**Files:**
- Create: `persofinancia/components/analitica/shared/chart-empty.tsx`

- [ ] **Step 8.1: Crear archivo**

```typescript
// persofinancia/components/analitica/shared/chart-empty.tsx

interface ChartEmptyProps {
  title?: string
  description?: string
  icon?: string
}

export function ChartEmpty({
  title = 'Sin datos',
  description = 'Ajusta el rango o filtros para ver tus datos',
  icon = '📊',
}: ChartEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 text-muted-foreground">
      <span className="text-3xl mb-2">{icon}</span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs mt-1">{description}</p>
    </div>
  )
}
```

- [ ] **Step 8.2: Verificar build**

```bash
cd persofinancia && npx tsc --noEmit
```

- [ ] **Step 8.3: Commit**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/analitica/
git commit -m "feat(analitica): add ChartEmpty shared empty-state component"
```

---

## FASE B — Shell de Analítica (página + selector + cliente)

### Task 9: Range Selector component

**Files:**
- Create: `persofinancia/components/analitica/range-selector.tsx`

- [ ] **Step 9.1: Crear archivo**

```typescript
// persofinancia/components/analitica/range-selector.tsx
'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { RANGE_LABELS, RANGE_ORDER, parseRangeKey, type RangeKey } from '@/lib/analitica/ranges'

export function RangeSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = parseRangeKey(searchParams.get('rango'))

  function setRange(key: RangeKey) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('rango', key)
    if (key !== 'custom') {
      params.delete('desde')
      params.delete('hasta')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border">
      <div className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
        {RANGE_ORDER.map(key => (
          <button
            key={key}
            onClick={() => setRange(key)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              current === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {RANGE_LABELS[key]}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 9.2: Verificar build**

```bash
cd persofinancia && npx tsc --noEmit
```

- [ ] **Step 9.3: Commit**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/analitica/range-selector.tsx
git commit -m "feat(analitica): add RangeSelector with URL-driven state"
```

---

### Task 10: Página `/analitica` (Server Component)

**Files:**
- Replace: `persofinancia/app/(dashboard)/analitica/page.tsx` (actualmente placeholder)

- [ ] **Step 10.1: Reescribir el page.tsx**

```typescript
// persofinancia/app/(dashboard)/analitica/page.tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { parseRangeKey, rangeToDates } from '@/lib/analitica/ranges'
import { RangeSelector } from '@/components/analitica/range-selector'
import { AnaliticaClient } from './analitica-client'
import type { Movimiento } from '@/lib/types/database'

interface PageProps {
  searchParams: Promise<{ tab?: string; rango?: string; desde?: string; hasta?: string }>
}

export default async function AnaliticaPage({ searchParams }: PageProps) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const rango = parseRangeKey(params.rango)
  const custom = params.desde && params.hasta
    ? { from: params.desde, to: params.hasta }
    : undefined

  const { start, end } = rangeToDates(rango, custom)

  const { data } = await supabase
    .from('movimientos')
    .select('*')
    .eq('user_id', user.id)
    .gte('fecha', start)
    .lte('fecha', end)
    .order('fecha', { ascending: true })

  const movimientos = (data ?? []) as Movimiento[]

  return (
    <div className="pb-4">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold">Analitica</h1>
        <p className="text-xs text-muted-foreground">
          {start} a {end} · {movimientos.length} movimientos
        </p>
      </div>
      <Suspense fallback={null}>
        <RangeSelector />
      </Suspense>
      <AnaliticaClient movimientos={movimientos} initialTab={params.tab ?? 'resumen'} />
    </div>
  )
}
```

- [ ] **Step 10.2: Verificar (fallará hasta que exista AnaliticaClient — siguiente task)**

Skip build hasta Task 11.

- [ ] **Step 10.3: Commit incremental**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/app/\(dashboard\)/analitica/page.tsx
git commit -m "feat(analitica): server page fetches movimientos for selected range"
```

---

### Task 11: `AnaliticaClient` con sub-tabs

**Files:**
- Create: `persofinancia/app/(dashboard)/analitica/analitica-client.tsx`

- [ ] **Step 11.1: Crear archivo**

```typescript
// persofinancia/app/(dashboard)/analitica/analitica-client.tsx
'use client'
import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  initialTab: string
}

const TABS = [
  { key: 'resumen',    label: 'Resumen' },
  { key: 'gastos',     label: 'Gastos' },
  { key: 'ingresos',   label: 'Ingresos' },
  { key: 'deuda',      label: 'Deuda' },
  { key: 'flujo',      label: 'Flujo' },
  { key: 'proyeccion', label: 'Proyeccion' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function AnaliticaClient({ movimientos, initialTab }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<TabKey>(
    (TABS.find(t => t.key === initialTab)?.key ?? 'resumen') as TabKey
  )

  function changeTab(key: TabKey) {
    setTab(key)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div>
      {/* Sub-tabs nav */}
      <div className="flex gap-1 overflow-x-auto px-4 py-2 border-b border-border no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => changeTab(t.key)}
            className={cn(
              'shrink-0 px-3 py-1.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 pt-4">
        {tab === 'resumen' && <div className="text-muted-foreground text-sm">Resumen — pending</div>}
        {tab === 'gastos' && <div className="text-muted-foreground text-sm">Gastos — pending</div>}
        {tab === 'ingresos' && <div className="text-muted-foreground text-sm">Ingresos — pending</div>}
        {tab === 'deuda' && <div className="text-muted-foreground text-sm">Deuda — pending</div>}
        {tab === 'flujo' && <div className="text-muted-foreground text-sm">Flujo — pending</div>}
        {tab === 'proyeccion' && <div className="text-muted-foreground text-sm">Proyeccion — pending</div>}
      </div>
    </div>
  )
}
```

> Nota: Los tab contents son placeholders en este task. Se reemplazan en tasks subsiguientes a medida que se construyen los tabs.

- [ ] **Step 11.2: Verificar build completo**

```bash
cd persofinancia && npx tsc --noEmit && npm run build
```

Expected: Build passes. `/analitica` accesible con sub-tabs vacíos.

- [ ] **Step 11.3: Commit**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/app/\(dashboard\)/analitica/analitica-client.tsx
git commit -m "feat(analitica): add client with sub-tabs navigation (URL-synced)"
```

---

## FASE C — Tab Resumen

### Task 12: Card `BehaviorMetrics`

**Files:**
- Create: `persofinancia/components/analitica/cards/behavior-metrics.tsx`

- [ ] **Step 12.1: Crear archivo**

```typescript
// persofinancia/components/analitica/cards/behavior-metrics.tsx
import { fmt } from '@/lib/utils/currency'
import { groupByMes } from '@/lib/analitica/aggregations'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  currentMonth: string
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, x) => s + x, 0) / arr.length
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1)
  return Math.sqrt(variance)
}

export function BehaviorMetrics({ movimientos, currentMonth }: Props) {
  const byMes = groupByMes(movimientos).filter(m => m.mes < currentMonth)
  const ingresos = byMes.map(m => m.ingresos)
  const gastos = byMes.map(m => m.gastos)

  const avgIngresos = mean(ingresos)
  const avgGastos = mean(gastos)
  const volatilidad = std(gastos)
  const tasaAhorro = avgIngresos > 0 ? ((avgIngresos - avgGastos) / avgIngresos) * 100 : 0

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-card border border-border rounded-xl p-3">
        <p className="text-xs text-muted-foreground uppercase">Ingreso prom/mes</p>
        <p className="text-lg font-bold text-green-500 mt-1">{fmt(avgIngresos)}</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-3">
        <p className="text-xs text-muted-foreground uppercase">Gasto prom/mes</p>
        <p className="text-lg font-bold text-red-500 mt-1">{fmt(avgGastos)}</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-3">
        <p className="text-xs text-muted-foreground uppercase">Volatilidad</p>
        <p className="text-lg font-bold mt-1">{fmt(volatilidad)}</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-3">
        <p className="text-xs text-muted-foreground uppercase">Tasa de ahorro</p>
        <p className={`text-lg font-bold mt-1 ${tasaAhorro >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {tasaAhorro.toFixed(1)}%
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 12.2: Verificar build**

```bash
cd persofinancia && npx tsc --noEmit
```

- [ ] **Step 12.3: Commit**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/analitica/cards/
git commit -m "feat(analitica): add BehaviorMetrics card with 4 behavioral KPIs"
```

---

### Task 13: Gráfica Allocation 50/30/20

**Files:**
- Create: `persofinancia/components/analitica/charts/allocation-50-30-20.tsx`

- [ ] **Step 13.1: Crear archivo**

```typescript
// persofinancia/components/analitica/charts/allocation-50-30-20.tsx
'use client'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { sumByFlujo } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'
import type { Categoria } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
}

export function Allocation503020({ movimientos, categorias }: Props) {
  const colors = useChartColors()
  const totalIngresos = sumByFlujo(movimientos, 'in')
  const totalGastos = sumByFlujo(movimientos, 'out')

  if (totalIngresos === 0 && totalGastos === 0) {
    return <ChartEmpty icon="🥧" title="Sin movimientos" description="No hay datos para calcular asignacion" />
  }

  // Categorize each movimiento by its grupo
  const catMap = new Map(categorias.map(c => [c.nombre, c.grupo]))
  let necesidades = 0
  let deseos = 0
  for (const m of movimientos) {
    if (m.flujo !== 'out' || !m.categoria) continue
    const grupo = catMap.get(m.categoria) ?? 'Variable'
    if (grupo === 'Fijo' || grupo === 'Deuda') necesidades += Number(m.monto)
    else if (grupo === 'Variable') deseos += Number(m.monto)
  }
  const ahorro = Math.max(0, totalIngresos - totalGastos)

  const data = [
    { name: 'Necesidades (50%)', value: necesidades, color: colors.expense },
    { name: 'Deseos (30%)', value: deseos, color: colors.primary },
    { name: 'Ahorro (20%)', value: ahorro, color: colors.income },
  ].filter(d => d.value > 0)

  const total = data.reduce((s, d) => s + d.value, 0)
  const balanceNegativo = totalIngresos < totalGastos

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Regla 50/30/20</p>
      {balanceNegativo && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
          ⚠ Balance negativo: gastas más de lo que ingresas
        </p>
      )}
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={2}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => [fmt(v), `${((v / total) * 100).toFixed(0)}%`]}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 13.2: Verificar build**

```bash
cd persofinancia && npx tsc --noEmit
```

- [ ] **Step 13.3: Commit**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/analitica/charts/allocation-50-30-20.tsx
git commit -m "feat(analitica): add 50/30/20 allocation donut chart"
```

---

### Task 14: Gráfica Allocation por Grupo

**Files:**
- Create: `persofinancia/components/analitica/charts/allocation-by-grupo.tsx`

- [ ] **Step 14.1: Crear archivo**

```typescript
// persofinancia/components/analitica/charts/allocation-by-grupo.tsx
'use client'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento, Categoria } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
}

export function AllocationByGrupo({ movimientos, categorias }: Props) {
  const colors = useChartColors()
  const catMap = new Map(categorias.map(c => [c.nombre, c.grupo]))

  const grupos = new Map<string, number>()
  for (const m of movimientos) {
    if (m.flujo !== 'out' || !m.categoria) continue
    const grupo = catMap.get(m.categoria) ?? 'Otros'
    grupos.set(grupo, (grupos.get(grupo) ?? 0) + Number(m.monto))
  }

  if (grupos.size === 0) {
    return <ChartEmpty icon="🥧" title="Sin gastos categorizados" description="Categoriza tus movimientos para ver esta gráfica" />
  }

  const data = Array.from(grupos.entries()).map(([name, value], i) => ({
    name,
    value,
    color: colors.palette[i % colors.palette.length],
  }))

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Asignación real por grupo</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={2}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip
            formatter={(v: number) => [fmt(v), `${((v / total) * 100).toFixed(0)}%`]}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 14.2: Verificar y commit**

```bash
cd persofinancia && npx tsc --noEmit
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/analitica/charts/allocation-by-grupo.tsx
git commit -m "feat(analitica): add real allocation by grupo donut chart"
```

---

### Task 15: Tab Resumen (wiring)

**Files:**
- Create: `persofinancia/components/analitica/tabs/resumen-tab.tsx`
- Modify: `persofinancia/app/(dashboard)/analitica/page.tsx` — fetch categorias también
- Modify: `persofinancia/app/(dashboard)/analitica/analitica-client.tsx` — usar ResumenTab

- [ ] **Step 15.1: Crear `resumen-tab.tsx`**

```typescript
// persofinancia/components/analitica/tabs/resumen-tab.tsx
import { KpiCard } from '@/components/shared/kpi-card'
import { BehaviorMetrics } from '../cards/behavior-metrics'
import { Allocation503020 } from '../charts/allocation-50-30-20'
import { AllocationByGrupo } from '../charts/allocation-by-grupo'
import { sumByFlujo } from '@/lib/analitica/aggregations'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento, Categoria } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
}

export function ResumenTab({ movimientos, categorias }: Props) {
  const ingresos = sumByFlujo(movimientos, 'in')
  const gastos = sumByFlujo(movimientos, 'out')
  const balance = ingresos - gastos
  const tasaAhorro = ingresos > 0 ? ((balance / ingresos) * 100).toFixed(1) : '0'
  const currentMonth = new Date().toISOString().slice(0, 7)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Ingresos" value={fmt(ingresos)} positive={true} />
        <KpiCard label="Gastos" value={fmt(gastos)} positive={false} />
        <KpiCard label="Balance" value={fmt(balance)} positive={balance >= 0} highlight />
        <KpiCard label="Ahorro" value={`${tasaAhorro}%`} positive={Number(tasaAhorro) >= 0} />
      </div>
      <Allocation503020 movimientos={movimientos} categorias={categorias} />
      <AllocationByGrupo movimientos={movimientos} categorias={categorias} />
      <BehaviorMetrics movimientos={movimientos} currentMonth={currentMonth} />
    </div>
  )
}
```

- [ ] **Step 15.2: Modificar `page.tsx` para fetch categorias**

Reemplazar el contenido de `persofinancia/app/(dashboard)/analitica/page.tsx`:

```typescript
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { parseRangeKey, rangeToDates } from '@/lib/analitica/ranges'
import { RangeSelector } from '@/components/analitica/range-selector'
import { AnaliticaClient } from './analitica-client'
import type { Movimiento, Categoria } from '@/lib/types/database'

interface PageProps {
  searchParams: Promise<{ tab?: string; rango?: string; desde?: string; hasta?: string }>
}

export default async function AnaliticaPage({ searchParams }: PageProps) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const rango = parseRangeKey(params.rango)
  const custom = params.desde && params.hasta ? { from: params.desde, to: params.hasta } : undefined
  const { start, end } = rangeToDates(rango, custom)

  const [{ data: movs }, { data: cats }] = await Promise.all([
    supabase.from('movimientos').select('*').eq('user_id', user.id)
      .gte('fecha', start).lte('fecha', end)
      .order('fecha', { ascending: true }),
    supabase.from('categorias').select('*').eq('user_id', user.id),
  ])

  const movimientos = (movs ?? []) as Movimiento[]
  const categorias = (cats ?? []) as Categoria[]

  return (
    <div className="pb-4">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold">Analitica</h1>
        <p className="text-xs text-muted-foreground">
          {start} a {end} · {movimientos.length} movimientos
        </p>
      </div>
      <Suspense fallback={null}>
        <RangeSelector />
      </Suspense>
      <AnaliticaClient
        movimientos={movimientos}
        categorias={categorias}
        initialTab={params.tab ?? 'resumen'}
      />
    </div>
  )
}
```

- [ ] **Step 15.3: Modificar `analitica-client.tsx` para incluir ResumenTab**

Reemplazar la sección de tab content en `analitica-client.tsx`:

```typescript
// Cambiar el interface Props:
interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
  initialTab: string
}

// Cambiar la función signature:
export function AnaliticaClient({ movimientos, categorias, initialTab }: Props) {

// Agregar import al top del archivo:
import { ResumenTab } from '@/components/analitica/tabs/resumen-tab'
import type { Movimiento, Categoria } from '@/lib/types/database'

// Reemplazar el tab content del 'resumen':
{tab === 'resumen' && <ResumenTab movimientos={movimientos} categorias={categorias} />}
```

- [ ] **Step 15.4: Build completo**

```bash
cd persofinancia && npx tsc --noEmit && npm run build
```

Expected: Build passes. `/analitica?tab=resumen` muestra KPIs, donuts y métricas.

- [ ] **Step 15.5: Commit**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/
git commit -m "feat(analitica): wire ResumenTab — KPIs, 50/30/20 donut, allocation, behavior metrics"
```

---

## FASE D — Tab Gastos

### Task 16: Gráfica `CategoryDonut`

**Files:**
- Create: `persofinancia/components/analitica/charts/category-donut.tsx`

- [ ] **Step 16.1: Crear archivo**

```typescript
// persofinancia/components/analitica/charts/category-donut.tsx
'use client'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByCategoria, topNWithOthers, type CategoriaTotal } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  flujo?: 'in' | 'out'
}

export function CategoryDonut({ movimientos, flujo = 'out' }: Props) {
  const colors = useChartColors()
  const filtered = movimientos.filter(m => m.flujo === flujo)
  const grouped = groupByCategoria(filtered)
  const data = topNWithOthers<CategoriaTotal>(grouped, 8, 'categoria')

  if (data.length === 0) {
    return <ChartEmpty icon="🍕" title="Sin gastos categorizados" />
  }

  const total = data.reduce((s, d) => s + d.total, 0)

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Gastos por categoría</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="total" nameKey="categoria" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors.palette[i % colors.palette.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => [fmt(v), `${((v / total) * 100).toFixed(0)}%`]}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 16.2: Verificar y commit**

```bash
cd persofinancia && npx tsc --noEmit
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/analitica/charts/category-donut.tsx
git commit -m "feat(analitica): add CategoryDonut chart (top 8 + Otros)"
```

---

### Task 17: Gráfica `TopMerchantsBar`

**Files:**
- Create: `persofinancia/components/analitica/charts/top-merchants-bar.tsx`

- [ ] **Step 17.1: Crear archivo**

```typescript
// persofinancia/components/analitica/charts/top-merchants-bar.tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByEntidad } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function TopMerchantsBar({ movimientos }: Props) {
  const colors = useChartColors()
  const grouped = groupByEntidad(movimientos).slice(0, 10)

  if (grouped.length === 0) {
    return <ChartEmpty icon="🏬" title="Sin comercios" description="No hay gastos en el rango" />
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Top 10 comercios</p>
      <ResponsiveContainer width="100%" height={Math.max(200, grouped.length * 28)}>
        <BarChart data={grouped} layout="vertical" margin={{ left: 10, right: 30 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="entidad"
            width={120}
            tick={{ fontSize: 11, fill: colors.text }}
          />
          <Tooltip
            formatter={(v: number) => fmt(v)}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Bar dataKey="total" radius={[0, 6, 6, 0]}>
            {grouped.map((_, i) => (
              <Cell key={i} fill={colors.expense} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 17.2: Verificar y commit**

```bash
cd persofinancia && npx tsc --noEmit
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/analitica/charts/top-merchants-bar.tsx
git commit -m "feat(analitica): add TopMerchantsBar horizontal chart"
```

---

### Task 18: Gráfica `MonthlyBars` (con proyección)

**Files:**
- Create: `persofinancia/components/analitica/charts/monthly-bars.tsx`

- [ ] **Step 18.1: Crear archivo**

```typescript
// persofinancia/components/analitica/charts/monthly-bars.tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByMes } from '@/lib/analitica/aggregations'
import { projectCurrentMonth } from '@/lib/analitica/projection'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  flujo: 'in' | 'out'
  title: string
}

export function MonthlyBars({ movimientos, flujo, title }: Props) {
  const colors = useChartColors()
  const byMes = groupByMes(movimientos)
  const currentMonth = new Date().toISOString().slice(0, 7)

  if (byMes.length === 0) {
    return <ChartEmpty icon="📊" title="Sin movimientos en el rango" />
  }

  // Add projection for current month
  const projection = projectCurrentMonth(movimientos, flujo, currentMonth, 3)

  const barColor = flujo === 'in' ? colors.income : colors.expense

  const data = byMes.map(m => {
    const value = flujo === 'in' ? m.ingresos : m.gastos
    if (m.mes === currentMonth) {
      return {
        mes: m.mes,
        actual: projection.actualToDate,
        projected: Math.max(0, projection.projected - projection.actualToDate),
        isCurrent: true,
      }
    }
    return { mes: m.mes, actual: value, projected: 0, isCurrent: false }
  })

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            formatter={(v: number, name: string) => [fmt(v), name === 'actual' ? 'Real' : 'Proyectado']}
            labelFormatter={(label: string) => label}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Bar dataKey="actual" stackId="a" fill={barColor} radius={[0, 0, 0, 0]} />
          <Bar dataKey="projected" stackId="a" fill={barColor} fillOpacity={0.35} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-2">
        Mes en curso: <span className="font-medium">{fmt(projection.actualToDate)}</span> real ·{' '}
        <span className="opacity-70">{fmt(projection.projected)}</span> proyectado
      </p>
    </div>
  )
}
```

- [ ] **Step 18.2: Verificar y commit**

```bash
cd persofinancia && npx tsc --noEmit
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/analitica/charts/monthly-bars.tsx
git commit -m "feat(analitica): add MonthlyBars chart with current-month projection overlay"
```

---

### Task 19: Gráfica `CategoryTrendLine` (multi-line top 5)

**Files:**
- Create: `persofinancia/components/analitica/charts/category-trend-line.tsx`

- [ ] **Step 19.1: Crear archivo**

```typescript
// persofinancia/components/analitica/charts/category-trend-line.tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByCategoria } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

interface MonthPoint {
  mes: string
  [categoria: string]: number | string
}

export function CategoryTrendLine({ movimientos }: Props) {
  const colors = useChartColors()
  const gastos = movimientos.filter(m => m.flujo === 'out')

  // Find top 5 categorias by total
  const topCategorias = groupByCategoria(gastos).slice(0, 5).map(c => c.categoria)

  if (topCategorias.length === 0) {
    return <ChartEmpty icon="📈" title="Sin gastos categorizados" />
  }

  // Build monthly series for each top categoria
  const monthMap = new Map<string, MonthPoint>()
  for (const m of gastos) {
    if (!m.categoria || !topCategorias.includes(m.categoria)) continue
    const mes = m.fecha.slice(0, 7)
    if (!monthMap.has(mes)) monthMap.set(mes, { mes })
    const point = monthMap.get(mes)!
    point[m.categoria] = (Number(point[m.categoria]) || 0) + Number(m.monto)
  }

  const data = Array.from(monthMap.values()).sort((a, b) =>
    (a.mes as string).localeCompare(b.mes as string)
  )

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Tendencia top 5 categorías</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            formatter={(v: number) => fmt(v)}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {topCategorias.map((cat, i) => (
            <Line
              key={cat}
              type="monotone"
              dataKey={cat}
              stroke={colors.palette[i]}
              strokeWidth={2}
              dot={{ r: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 19.2: Verificar y commit**

```bash
cd persofinancia && npx tsc --noEmit
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/analitica/charts/category-trend-line.tsx
git commit -m "feat(analitica): add CategoryTrendLine multi-line chart (top 5)"
```

---

### Task 20: Gráfica `DailyCumulative`

**Files:**
- Create: `persofinancia/components/analitica/charts/daily-cumulative.tsx`

- [ ] **Step 20.1: Crear archivo**

```typescript
// persofinancia/components/analitica/charts/daily-cumulative.tsx
'use client'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { dailyCumulative } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function DailyCumulative({ movimientos }: Props) {
  const colors = useChartColors()
  const currentMonth = new Date().toISOString().slice(0, 7)
  const today = new Date().getDate()

  const data = dailyCumulative(movimientos, currentMonth).slice(0, today)

  if (data.every(d => d.cumulative === 0)) {
    return <ChartEmpty icon="📆" title="Sin gastos este mes" />
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Gasto acumulado del mes</p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.expense} stopOpacity={0.5} />
              <stop offset="100%" stopColor={colors.expense} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: colors.text }} />
          <YAxis tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            formatter={(v: number) => fmt(v)}
            labelFormatter={(d: number) => `Día ${d}`}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={colors.expense}
            strokeWidth={2}
            fill="url(#cumulativeGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 20.2: Verificar y commit**

```bash
cd persofinancia && npx tsc --noEmit
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/analitica/charts/daily-cumulative.tsx
git commit -m "feat(analitica): add DailyCumulative area chart for current month"
```

---

### Task 21: Tab Gastos (sin presupuestos aún)

**Files:**
- Create: `persofinancia/components/analitica/tabs/gastos-tab.tsx`
- Modify: `persofinancia/app/(dashboard)/analitica/analitica-client.tsx` — usar GastosTab

- [ ] **Step 21.1: Crear `gastos-tab.tsx`**

```typescript
// persofinancia/components/analitica/tabs/gastos-tab.tsx
import { CategoryDonut } from '../charts/category-donut'
import { TopMerchantsBar } from '../charts/top-merchants-bar'
import { MonthlyBars } from '../charts/monthly-bars'
import { CategoryTrendLine } from '../charts/category-trend-line'
import { DailyCumulative } from '../charts/daily-cumulative'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function GastosTab({ movimientos }: Props) {
  return (
    <div className="space-y-4">
      <CategoryDonut movimientos={movimientos} flujo="out" />
      <TopMerchantsBar movimientos={movimientos} />
      <MonthlyBars movimientos={movimientos} flujo="out" title="Gastos por mes" />
      <CategoryTrendLine movimientos={movimientos} />
      <DailyCumulative movimientos={movimientos} />
    </div>
  )
}
```

- [ ] **Step 21.2: Wire en `analitica-client.tsx`**

Agregar import:
```typescript
import { GastosTab } from '@/components/analitica/tabs/gastos-tab'
```

Reemplazar el placeholder de gastos:
```typescript
{tab === 'gastos' && <GastosTab movimientos={movimientos} />}
```

- [ ] **Step 21.3: Build completo y commit**

```bash
cd persofinancia && npx tsc --noEmit && npm run build
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/
git commit -m "feat(analitica): wire GastosTab with 5 charts (donut, merchants, monthly, trend, cumulative)"
```

---

## FASE E — Presupuestos

### Task 22: Página `/config/presupuestos`

**Files:**
- Replace: `persofinancia/app/(dashboard)/config/presupuestos/page.tsx` (no existe aún, lo creamos)
- Modify: `persofinancia/app/(dashboard)/config/page.tsx` — el link a `/config/presupuestos` ya existe

- [ ] **Step 22.1: Crear directorio + page.tsx**

```typescript
// persofinancia/app/(dashboard)/config/presupuestos/page.tsx
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { fmtFull } from '@/lib/utils/currency'

async function upsertPresupuesto(formData: FormData) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const categoria_id = String(formData.get('categoria_id') ?? '')
  const monto = parseFloat(String(formData.get('monto') ?? '0'))

  if (!categoria_id || isNaN(monto) || monto < 0) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('presupuestos') as any).upsert(
    { user_id: user.id, categoria_id, monto, activo: true },
    { onConflict: 'user_id,categoria_id' }
  )
  revalidatePath('/config/presupuestos')
  revalidatePath('/analitica')
}

export default async function PresupuestosPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get gasto categorias (exclude Ingreso group)
  const { data: cats } = await supabase
    .from('categorias')
    .select('*')
    .eq('user_id', user.id)
    .neq('grupo', 'Ingreso')
    .order('grupo')
    .order('nombre')

  // Get current presupuestos
  const { data: presup } = await supabase
    .from('presupuestos')
    .select('*')
    .eq('user_id', user.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const presupMap = new Map((presup ?? []).map((p: any) => [p.categoria_id, p.monto]))
  const categorias = cats ?? []
  const totalPresupuestado = (presup ?? []).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: number, p: any) => s + Number(p.monto), 0
  )

  // Calculate average monthly income for context
  const { data: ingresos } = await supabase
    .from('movimientos')
    .select('monto, fecha')
    .eq('user_id', user.id)
    .eq('flujo', 'in')

  const ingresosByMonth = new Map<string, number>()
  for (const m of ingresos ?? []) {
    const mes = m.fecha.slice(0, 7)
    ingresosByMonth.set(mes, (ingresosByMonth.get(mes) ?? 0) + Number(m.monto))
  }
  const months = Array.from(ingresosByMonth.values())
  const avgIngreso = months.length > 0 ? months.reduce((a, b) => a + b, 0) / months.length : 0
  const pctOfIncome = avgIngreso > 0 ? (totalPresupuestado / avgIngreso) * 100 : 0

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h1 className="text-xl font-bold">Presupuestos</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Define cuánto deseas gastar por categoría cada mes
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-1">
        <p className="text-xs text-muted-foreground uppercase">Total presupuestado</p>
        <p className="text-2xl font-bold">{fmtFull(totalPresupuestado)}</p>
        <p className="text-xs text-muted-foreground">
          Ingreso promedio mensual: {fmtFull(avgIngreso)}
        </p>
        {avgIngreso > 0 && (
          <p className={`text-xs font-medium ${pctOfIncome > 100 ? 'text-red-500' : pctOfIncome > 80 ? 'text-yellow-500' : 'text-green-500'}`}>
            Tu presupuesto es {pctOfIncome.toFixed(0)}% de tu ingreso promedio
            {pctOfIncome > 100 && ' — ⚠ supera tu ingreso'}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {categorias.map((cat) => (
          <form
            key={cat.id}
            action={upsertPresupuesto}
            className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
          >
            <span className="text-xl shrink-0">{cat.icono}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{cat.nombre}</p>
              <p className="text-xs text-muted-foreground">{cat.grupo}</p>
            </div>
            <input type="hidden" name="categoria_id" value={cat.id} />
            <input
              type="number"
              name="monto"
              defaultValue={presupMap.get(cat.id) ?? ''}
              placeholder="0"
              min="0"
              step="1000"
              className="w-32 bg-background border border-input rounded-md px-3 py-1.5 text-sm text-right"
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-xs font-medium"
            >
              ✓
            </button>
          </form>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 22.2: Build + commit**

```bash
cd persofinancia && npx tsc --noEmit && npm run build
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/app/\(dashboard\)/config/presupuestos/
git commit -m "feat(presupuestos): add presupuestos config page with upsert per category"
```

---

### Task 23: Gráfica `BudgetVsActual`

**Files:**
- Create: `persofinancia/components/analitica/charts/budget-vs-actual.tsx`

- [ ] **Step 23.1: Crear archivo**

```typescript
// persofinancia/components/analitica/charts/budget-vs-actual.tsx
'use client'
import { useChartColors } from '@/lib/analitica/colors'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import { groupByCategoria } from '@/lib/analitica/aggregations'
import type { Movimiento, Categoria, Presupuesto } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
  presupuestos: Presupuesto[]
}

interface Row {
  nombre: string
  icono: string
  gasto: number
  presupuesto: number
  pct: number  // 0-100+ %
}

function mesesEnRango(movs: Movimiento[]): number {
  const meses = new Set(movs.map(m => m.fecha.slice(0, 7)))
  return Math.max(1, meses.size)
}

export function BudgetVsActual({ movimientos, categorias, presupuestos }: Props) {
  const colors = useChartColors()
  const gastos = movimientos.filter(m => m.flujo === 'out')

  if (presupuestos.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold mb-2">Gasto vs presupuesto</p>
        <ChartEmpty
          icon="🎯"
          title="Sin presupuestos definidos"
          description="Configura presupuestos en /config/presupuestos"
        />
      </div>
    )
  }

  const months = mesesEnRango(movimientos)
  const byCategoria = new Map(groupByCategoria(gastos).map(c => [c.categoria, c.total]))
  const catMap = new Map(categorias.map(c => [c.id, c]))

  const rows: Row[] = presupuestos
    .map(p => {
      const cat = catMap.get(p.categoria_id)
      if (!cat) return null
      const gasto = byCategoria.get(cat.nombre) ?? 0
      const budget = Number(p.monto) * months
      const pct = budget > 0 ? (gasto / budget) * 100 : 0
      return { nombre: cat.nombre, icono: cat.icono, gasto, presupuesto: budget, pct }
    })
    .filter((r): r is Row => r !== null)
    .sort((a, b) => b.pct - a.pct)

  function barColor(pct: number): string {
    if (pct < 80) return colors.income
    if (pct < 100) return '#eab308'
    return colors.expense
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold">Gasto vs presupuesto</p>
      <p className="text-xs text-muted-foreground">
        Acumulado de {months} {months === 1 ? 'mes' : 'meses'} del rango actual
      </p>
      {rows.map(row => (
        <div key={row.nombre}>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="font-medium flex items-center gap-1">
              <span>{row.icono}</span>
              <span>{row.nombre}</span>
            </span>
            <span className="text-muted-foreground">
              {fmt(row.gasto)} / {fmt(row.presupuesto)} ({row.pct.toFixed(0)}%)
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.min(100, row.pct)}%`,
                backgroundColor: barColor(row.pct),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 23.2: Verificar y commit**

```bash
cd persofinancia && npx tsc --noEmit
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/analitica/charts/budget-vs-actual.tsx
git commit -m "feat(analitica): add BudgetVsActual progress bars chart"
```

---

### Task 24: Conectar `BudgetVsActual` a `GastosTab`

**Files:**
- Modify: `persofinancia/app/(dashboard)/analitica/page.tsx` — fetch presupuestos
- Modify: `persofinancia/app/(dashboard)/analitica/analitica-client.tsx` — pasar presupuestos
- Modify: `persofinancia/components/analitica/tabs/gastos-tab.tsx` — recibir + usar

- [ ] **Step 24.1: Modificar `page.tsx`**

Agregar fetch de presupuestos al Promise.all y al type:

```typescript
import type { Movimiento, Categoria, Presupuesto } from '@/lib/types/database'

// ...

const [{ data: movs }, { data: cats }, { data: pres }] = await Promise.all([
  supabase.from('movimientos').select('*').eq('user_id', user.id)
    .gte('fecha', start).lte('fecha', end)
    .order('fecha', { ascending: true }),
  supabase.from('categorias').select('*').eq('user_id', user.id),
  supabase.from('presupuestos').select('*').eq('user_id', user.id),
])

const movimientos = (movs ?? []) as Movimiento[]
const categorias = (cats ?? []) as Categoria[]
const presupuestos = (pres ?? []) as Presupuesto[]

// ...
<AnaliticaClient
  movimientos={movimientos}
  categorias={categorias}
  presupuestos={presupuestos}
  initialTab={params.tab ?? 'resumen'}
/>
```

- [ ] **Step 24.2: Modificar `analitica-client.tsx`**

Agregar `presupuestos` al interface Props y pasarlo a GastosTab:

```typescript
import type { Movimiento, Categoria, Presupuesto } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
  presupuestos: Presupuesto[]
  initialTab: string
}

export function AnaliticaClient({ movimientos, categorias, presupuestos, initialTab }: Props) {

// ...

{tab === 'gastos' && <GastosTab movimientos={movimientos} categorias={categorias} presupuestos={presupuestos} />}
```

- [ ] **Step 24.3: Modificar `gastos-tab.tsx`**

```typescript
// persofinancia/components/analitica/tabs/gastos-tab.tsx
import { CategoryDonut } from '../charts/category-donut'
import { TopMerchantsBar } from '../charts/top-merchants-bar'
import { MonthlyBars } from '../charts/monthly-bars'
import { CategoryTrendLine } from '../charts/category-trend-line'
import { BudgetVsActual } from '../charts/budget-vs-actual'
import { DailyCumulative } from '../charts/daily-cumulative'
import type { Movimiento, Categoria, Presupuesto } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
  presupuestos: Presupuesto[]
}

export function GastosTab({ movimientos, categorias, presupuestos }: Props) {
  return (
    <div className="space-y-4">
      <CategoryDonut movimientos={movimientos} flujo="out" />
      <TopMerchantsBar movimientos={movimientos} />
      <MonthlyBars movimientos={movimientos} flujo="out" title="Gastos por mes" />
      <CategoryTrendLine movimientos={movimientos} />
      <BudgetVsActual movimientos={movimientos} categorias={categorias} presupuestos={presupuestos} />
      <DailyCumulative movimientos={movimientos} />
    </div>
  )
}
```

- [ ] **Step 24.4: Build completo + commit**

```bash
cd persofinancia && npx tsc --noEmit && npm run build
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/
git commit -m "feat(analitica): wire BudgetVsActual into GastosTab with presupuestos fetch"
```

---

## FASE F — Tab Ingresos

### Task 25: Gráfica `IncomeByTypeBar`

**Files:**
- Create: `persofinancia/components/analitica/charts/income-by-type-bar.tsx`

- [ ] **Step 25.1: Crear archivo**

```typescript
// persofinancia/components/analitica/charts/income-by-type-bar.tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByTipo } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function IncomeByTypeBar({ movimientos }: Props) {
  const colors = useChartColors()
  const data = groupByTipo(movimientos, 'in')

  if (data.length === 0) {
    return <ChartEmpty icon="💰" title="Sin ingresos en el rango" />
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Ingresos por tipo</p>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="tipo" width={140} tick={{ fontSize: 11, fill: colors.text }} />
          <Tooltip
            formatter={(v: number) => fmt(v)}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Bar dataKey="total" radius={[0, 6, 6, 0]}>
            {data.map((_, i) => <Cell key={i} fill={colors.income} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 25.2: Verificar y commit**

```bash
cd persofinancia && npx tsc --noEmit
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/analitica/charts/income-by-type-bar.tsx
git commit -m "feat(analitica): add IncomeByTypeBar horizontal chart"
```

---

### Task 26: Tab Ingresos (wiring)

**Files:**
- Create: `persofinancia/components/analitica/tabs/ingresos-tab.tsx`
- Modify: `persofinancia/app/(dashboard)/analitica/analitica-client.tsx`

- [ ] **Step 26.1: Crear `ingresos-tab.tsx`**

```typescript
// persofinancia/components/analitica/tabs/ingresos-tab.tsx
import { KpiCard } from '@/components/shared/kpi-card'
import { MonthlyBars } from '../charts/monthly-bars'
import { IncomeByTypeBar } from '../charts/income-by-type-bar'
import { groupByMes } from '@/lib/analitica/aggregations'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function IngresosTab({ movimientos }: Props) {
  const byMes = groupByMes(movimientos)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const completed = byMes.filter(m => m.mes < currentMonth)
  const ingresos = completed.map(m => m.ingresos)
  const avg = ingresos.length > 0 ? ingresos.reduce((s, x) => s + x, 0) / ingresos.length : 0
  const max = ingresos.length > 0 ? Math.max(...ingresos) : 0
  const variance =
    ingresos.length > 1
      ? Math.sqrt(
          ingresos.reduce((s, x) => s + (x - avg) ** 2, 0) / (ingresos.length - 1)
        )
      : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <KpiCard label="Promedio" value={fmt(avg)} positive={true} />
        <KpiCard label="Máximo" value={fmt(max)} positive={true} />
        <KpiCard label="Varianza" value={fmt(variance)} />
      </div>
      <MonthlyBars movimientos={movimientos} flujo="in" title="Ingresos por mes" />
      <IncomeByTypeBar movimientos={movimientos} />
    </div>
  )
}
```

- [ ] **Step 26.2: Wire en `analitica-client.tsx`**

```typescript
import { IngresosTab } from '@/components/analitica/tabs/ingresos-tab'

// ...

{tab === 'ingresos' && <IngresosTab movimientos={movimientos} />}
```

- [ ] **Step 26.3: Build + commit**

```bash
cd persofinancia && npx tsc --noEmit && npm run build
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/
git commit -m "feat(analitica): wire IngresosTab with KPIs, monthly bars, income by type"
```

---

## FASE G — Tab Deuda

### Task 27: Gráficas de Deuda

**Files:**
- Create: `persofinancia/components/analitica/charts/debt-by-month-line.tsx`
- Create: `persofinancia/components/analitica/charts/debt-by-entity-bar.tsx`

- [ ] **Step 27.1: Crear `debt-by-month-line.tsx`**

```typescript
// persofinancia/components/analitica/charts/debt-by-month-line.tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByMes } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function DebtByMonthLine({ movimientos }: Props) {
  const colors = useChartColors()
  const deudas = movimientos.filter(m => m.categoria === 'Deuda')

  if (deudas.length === 0) {
    return <ChartEmpty icon="🏦" title="Sin pagos de deuda en el rango" />
  }

  const data = groupByMes(deudas).map(m => ({ mes: m.mes, total: m.gastos }))

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Pagos a deuda por mes</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            formatter={(v: number) => fmt(v)}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Line type="monotone" dataKey="total" stroke={colors.debt} strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 27.2: Crear `debt-by-entity-bar.tsx`**

```typescript
// persofinancia/components/analitica/charts/debt-by-entity-bar.tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByEntidad } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function DebtByEntityBar({ movimientos }: Props) {
  const colors = useChartColors()
  const deudas = movimientos.filter(m => m.categoria === 'Deuda')
  const data = groupByEntidad(deudas).slice(0, 10)

  if (data.length === 0) {
    return <ChartEmpty icon="🏦" title="Sin pagos a entidades" />
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Pagos por entidad</p>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="entidad"
            width={120}
            tick={{ fontSize: 11, fill: colors.text }}
          />
          <Tooltip
            formatter={(v: number) => fmt(v)}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Bar dataKey="total" radius={[0, 6, 6, 0]}>
            {data.map((_, i) => <Cell key={i} fill={colors.debt} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 27.3: Commit**

```bash
cd persofinancia && npx tsc --noEmit
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/analitica/charts/
git commit -m "feat(analitica): add DebtByMonthLine and DebtByEntityBar charts"
```

---

### Task 28: Tab Deuda (wiring)

**Files:**
- Create: `persofinancia/components/analitica/tabs/deuda-tab.tsx`
- Modify: `persofinancia/app/(dashboard)/analitica/analitica-client.tsx`

- [ ] **Step 28.1: Crear `deuda-tab.tsx`**

```typescript
// persofinancia/components/analitica/tabs/deuda-tab.tsx
import { KpiCard } from '@/components/shared/kpi-card'
import { DebtByMonthLine } from '../charts/debt-by-month-line'
import { DebtByEntityBar } from '../charts/debt-by-entity-bar'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function DeudaTab({ movimientos }: Props) {
  const deudas = movimientos.filter(m => m.categoria === 'Deuda')
  const total = deudas.reduce((s, m) => s + Number(m.monto), 0)
  const count = deudas.length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Total pagado" value={fmt(total)} positive={false} highlight />
        <KpiCard label="Pagos" value={String(count)} />
      </div>
      <DebtByMonthLine movimientos={movimientos} />
      <DebtByEntityBar movimientos={movimientos} />
    </div>
  )
}
```

- [ ] **Step 28.2: Wire en `analitica-client.tsx`**

```typescript
import { DeudaTab } from '@/components/analitica/tabs/deuda-tab'

// ...

{tab === 'deuda' && <DeudaTab movimientos={movimientos} />}
```

- [ ] **Step 28.3: Build + commit**

```bash
cd persofinancia && npx tsc --noEmit && npm run build
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/
git commit -m "feat(analitica): wire DeudaTab with KPIs and debt charts"
```

---

## FASE H — Tab Flujo

### Task 29: Gráfica `CashflowCombo` (bars + line combinada)

**Files:**
- Create: `persofinancia/components/analitica/charts/cashflow-combo.tsx`

- [ ] **Step 29.1: Crear archivo**

```typescript
// persofinancia/components/analitica/charts/cashflow-combo.tsx
'use client'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByMes } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function CashflowCombo({ movimientos }: Props) {
  const colors = useChartColors()
  const data = groupByMes(movimientos)

  if (data.length === 0) {
    return <ChartEmpty icon="🌊" title="Sin datos para mostrar flujo" />
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm font-semibold mb-2">Ingresos vs Gastos vs Neto</p>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data}>
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            formatter={(v: number) => fmt(v)}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="ingresos" fill={colors.income} radius={[4, 4, 0, 0]} />
          <Bar dataKey="gastos" fill={colors.expense} radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="neto" stroke={colors.primary} strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 29.2: Verificar y commit**

```bash
cd persofinancia && npx tsc --noEmit
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/analitica/charts/cashflow-combo.tsx
git commit -m "feat(analitica): add CashflowCombo chart (bars + line)"
```

---

### Task 30: Tabla `CashflowTable` + Tab Flujo (wiring)

**Files:**
- Create: `persofinancia/components/analitica/charts/cashflow-table.tsx`
- Create: `persofinancia/components/analitica/tabs/flujo-tab.tsx`
- Modify: `persofinancia/app/(dashboard)/analitica/analitica-client.tsx`

- [ ] **Step 30.1: Crear `cashflow-table.tsx`**

```typescript
// persofinancia/components/analitica/charts/cashflow-table.tsx
import { groupByMes } from '@/lib/analitica/aggregations'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function CashflowTable({ movimientos }: Props) {
  const data = groupByMes(movimientos)
  const currentMonth = new Date().toISOString().slice(0, 7)

  if (data.length === 0) {
    return <ChartEmpty icon="📋" title="Sin datos en el rango" />
  }

  // Totals row
  const totals = data.reduce(
    (acc, m) => ({
      ingresos: acc.ingresos + m.ingresos,
      gastos: acc.gastos + m.gastos,
      neto: acc.neto + m.neto,
    }),
    { ingresos: 0, gastos: 0, neto: 0 }
  )
  const totalAhorro = totals.ingresos > 0 ? ((totals.neto / totals.ingresos) * 100).toFixed(1) : '0'

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <p className="text-sm font-semibold p-4 pb-2">Detalle mensual</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2">Mes</th>
              <th className="text-right px-3 py-2">Ingresos</th>
              <th className="text-right px-3 py-2">Gastos</th>
              <th className="text-right px-3 py-2">Neto</th>
              <th className="text-right px-3 py-2">% Ahorro</th>
            </tr>
          </thead>
          <tbody>
            {data.map(m => {
              const ahorro = m.ingresos > 0 ? ((m.neto / m.ingresos) * 100).toFixed(1) : '0'
              const isCurrent = m.mes === currentMonth
              return (
                <tr key={m.mes} className={isCurrent ? 'italic text-muted-foreground' : ''}>
                  <td className="px-3 py-2">{m.mes}{isCurrent && '*'}</td>
                  <td className="text-right text-green-500 px-3 py-2">{fmt(m.ingresos)}</td>
                  <td className="text-right text-red-500 px-3 py-2">{fmt(m.gastos)}</td>
                  <td className={`text-right px-3 py-2 font-medium ${m.neto >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {fmt(m.neto)}
                  </td>
                  <td className="text-right px-3 py-2">{ahorro}%</td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-border font-bold bg-muted/30">
              <td className="px-3 py-2">TOTAL</td>
              <td className="text-right text-green-500 px-3 py-2">{fmt(totals.ingresos)}</td>
              <td className="text-right text-red-500 px-3 py-2">{fmt(totals.gastos)}</td>
              <td className={`text-right px-3 py-2 ${totals.neto >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {fmt(totals.neto)}
              </td>
              <td className="text-right px-3 py-2">{totalAhorro}%</td>
            </tr>
          </tbody>
        </table>
      </div>
      {data.some(m => m.mes === currentMonth) && (
        <p className="text-xs text-muted-foreground p-3 pt-0">* Mes en curso (incompleto)</p>
      )}
    </div>
  )
}
```

- [ ] **Step 30.2: Crear `flujo-tab.tsx`**

```typescript
// persofinancia/components/analitica/tabs/flujo-tab.tsx
import { CashflowCombo } from '../charts/cashflow-combo'
import { CashflowTable } from '../charts/cashflow-table'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function FlujoTab({ movimientos }: Props) {
  return (
    <div className="space-y-4">
      <CashflowCombo movimientos={movimientos} />
      <CashflowTable movimientos={movimientos} />
    </div>
  )
}
```

- [ ] **Step 30.3: Wire en `analitica-client.tsx`**

```typescript
import { FlujoTab } from '@/components/analitica/tabs/flujo-tab'

// ...

{tab === 'flujo' && <FlujoTab movimientos={movimientos} />}
```

- [ ] **Step 30.4: Build + commit**

```bash
cd persofinancia && npx tsc --noEmit && npm run build
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/
git commit -m "feat(analitica): wire FlujoTab with combo chart and 13-month table"
```

---

## FASE I — Tab Proyección

### Task 31: Gráfica `ProjectionLine` + Tab Proyección

**Files:**
- Create: `persofinancia/components/analitica/charts/projection-line.tsx`
- Create: `persofinancia/components/analitica/tabs/proyeccion-tab.tsx`
- Modify: `persofinancia/app/(dashboard)/analitica/analitica-client.tsx`

- [ ] **Step 31.1: Crear `projection-line.tsx`**

```typescript
// persofinancia/components/analitica/charts/projection-line.tsx
'use client'
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useChartColors } from '@/lib/analitica/colors'
import { groupByMes } from '@/lib/analitica/aggregations'
import { forecast } from '@/lib/analitica/regression'
import { ChartEmpty } from '../shared/chart-empty'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  flujo: 'in' | 'out'
}

export function ProjectionLine({ movimientos, flujo }: Props) {
  const colors = useChartColors()
  const byMes = groupByMes(movimientos)
  const currentMonth = new Date().toISOString().slice(0, 7)

  const monthly = byMes.map(m => ({
    mes: m.mes,
    total: flujo === 'in' ? m.ingresos : m.gastos,
  }))

  // Only completed months for regression
  const completed = monthly.filter(m => m.mes < currentMonth)

  if (completed.length < 3) {
    return (
      <ChartEmpty
        icon="🔮"
        title="Datos insuficientes"
        description="Se necesitan al menos 3 meses completos para proyectar"
      />
    )
  }

  const { points: projected, regression } = forecast(monthly, 3, currentMonth)

  // Combined chart data
  const chartData = [
    ...completed.map(m => ({
      mes: m.mes,
      historico: m.total,
      proyectado: null as number | null,
      lo: null as number | null,
      hi: null as number | null,
    })),
    ...projected.map(p => ({
      mes: p.mes,
      historico: null,
      proyectado: p.predicted,
      lo: p.lo,
      hi: p.hi,
    })),
  ]

  const totalGastoCompletado = completed.reduce((s, x) => s + x.total, 0)
  const avg = totalGastoCompletado / completed.length
  const slope = regression.slope
  const slopePct = avg > 0 ? (slope / avg) * 100 : 0
  const volatilidad = regression.residualStd
  const volPct = avg > 0 ? (volatilidad / avg) * 100 : 0

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold">Proyección 3 meses ({flujo === 'in' ? 'Ingresos' : 'Gastos'})</p>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData}>
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: colors.text }} tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            formatter={(v: number) => fmt(v)}
            contentStyle={{ background: colors.background, border: `1px solid ${colors.grid}`, fontSize: 12 }}
          />
          <Area dataKey="hi" stroke="none" fill={colors.primary} fillOpacity={0.15} />
          <Area dataKey="lo" stroke="none" fill={colors.background} fillOpacity={1} />
          <Line type="monotone" dataKey="historico" stroke={flujo === 'in' ? colors.income : colors.expense} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          <Line type="monotone" dataKey="proyectado" stroke={colors.primary} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="space-y-1 text-xs">
        <p className="text-muted-foreground">
          <strong>Lectura del analista:</strong> Tu tendencia mensual es{' '}
          <span className={slopePct >= 0 ? 'text-green-500' : 'text-red-500'}>
            {slopePct >= 0 ? '+' : ''}{slopePct.toFixed(1)}%
          </span>{' '}
          con volatilidad del{' '}
          <span className={volPct > 30 ? 'text-yellow-500' : ''}>{volPct.toFixed(0)}%</span>.
        </p>
        <p className="text-muted-foreground">R² = {regression.r2.toFixed(2)} ({regression.r2 > 0.7 ? 'tendencia clara' : regression.r2 > 0.4 ? 'tendencia moderada' : 'tendencia débil'})</p>
        {volPct > 30 && (
          <p className="text-yellow-600 dark:text-yellow-400 font-medium">
            ⚠ Alta volatilidad — la proyección tiene incertidumbre significativa
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 31.2: Crear `proyeccion-tab.tsx`**

```typescript
// persofinancia/components/analitica/tabs/proyeccion-tab.tsx
import { ProjectionLine } from '../charts/projection-line'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function ProyeccionTab({ movimientos }: Props) {
  return (
    <div className="space-y-4">
      <ProjectionLine movimientos={movimientos} flujo="out" />
      <ProjectionLine movimientos={movimientos} flujo="in" />
    </div>
  )
}
```

> Nota: Proyección usa TODO el histórico disponible, no solo el rango seleccionado. Por eso para que la proyección sea precisa, la página debería fetch sin filtro de fecha cuando el tab es proyeccion. Sin embargo, para mantener atomicidad, en Fase 3 base usaremos el dataset del rango. La mejora a "fetch all for projection" se hace si la regression queda mal.

- [ ] **Step 31.3: Wire en `analitica-client.tsx`**

```typescript
import { ProyeccionTab } from '@/components/analitica/tabs/proyeccion-tab'

// ...

{tab === 'proyeccion' && <ProyeccionTab movimientos={movimientos} />}
```

- [ ] **Step 31.4: Build + commit**

```bash
cd persofinancia && npx tsc --noEmit && npm run build
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/
git commit -m "feat(analitica): wire ProyeccionTab with linear regression forecast for in/out"
```

---

## FASE J — Rewrite jerárquico de Categorías

### Task 32: Componente `CategoriaFormDialog`

**Files:**
- Create: `persofinancia/components/config/categoria-form-dialog.tsx`

- [ ] **Step 32.1: Instalar shadcn Dialog si no está instalado**

```bash
cd persofinancia
npx shadcn@latest add dialog -y
```

- [ ] **Step 32.2: Crear archivo**

```typescript
// persofinancia/components/config/categoria-form-dialog.tsx
'use client'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Categoria } from '@/lib/types/database'

interface Props {
  trigger: React.ReactNode
  categoria?: Categoria  // if provided, edit mode
  grupos: string[]
  subgruposPorGrupo: Map<string, string[]>
  onSubmit: (formData: FormData) => Promise<void>
}

const GRUPOS_FIJOS = ['Variable', 'Fijo', 'Ingreso', 'Deuda']

export function CategoriaFormDialog({ trigger, categoria, grupos, subgruposPorGrupo, onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [grupo, setGrupo] = useState(categoria?.grupo ?? 'Variable')
  const allGrupos = Array.from(new Set([...GRUPOS_FIJOS, ...grupos]))
  const subgrupos = subgruposPorGrupo.get(grupo) ?? []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{categoria ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            await onSubmit(formData)
            setOpen(false)
          }}
          className="space-y-3"
        >
          {categoria && <input type="hidden" name="id" value={categoria.id} />}
          <div className="space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input name="nombre" defaultValue={categoria?.nombre} placeholder="Domicilios" required />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Grupo</Label>
              <Select name="grupo" defaultValue={grupo} onValueChange={setGrupo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allGrupos.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subgrupo</Label>
              <Input
                name="subgrupo"
                defaultValue={categoria?.subgrupo}
                list="subgrupos-options"
                placeholder="Alimentación"
              />
              <datalist id="subgrupos-options">
                {subgrupos.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Icono</Label>
              <Input name="icono" defaultValue={categoria?.icono ?? '📌'} maxLength={2} className="text-center" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <Input name="color" type="color" defaultValue={categoria?.color ?? '#64748b'} className="h-10 p-1" />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full">{categoria ? 'Guardar cambios' : 'Crear categoría'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 32.3: Build + commit**

```bash
cd persofinancia && npx tsc --noEmit
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/
git commit -m "feat(categorias): add CategoriaFormDialog with create/edit modes"
```

---

### Task 33: Componente `CategoriaTree`

**Files:**
- Create: `persofinancia/components/config/categoria-tree.tsx`

- [ ] **Step 33.1: Crear archivo**

```typescript
// persofinancia/components/config/categoria-tree.tsx
'use client'
import { useState } from 'react'
import { ChevronRight, ChevronDown, Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategoriaFormDialog } from './categoria-form-dialog'
import type { Categoria } from '@/lib/types/database'

interface Props {
  categorias: Categoria[]
  onCreate: (formData: FormData) => Promise<void>
  onUpdate: (formData: FormData) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRenameGrupo: (oldName: string, newName: string) => Promise<void>
  onRenameSubgrupo: (grupo: string, oldName: string, newName: string) => Promise<void>
}

interface TreeStructure {
  [grupo: string]: {
    [subgrupo: string]: Categoria[]
  }
}

function buildTree(categorias: Categoria[]): TreeStructure {
  const tree: TreeStructure = {}
  for (const c of categorias) {
    const g = c.grupo || 'Sin grupo'
    const sg = c.subgrupo || '(sin subgrupo)'
    if (!tree[g]) tree[g] = {}
    if (!tree[g][sg]) tree[g][sg] = []
    tree[g][sg].push(c)
  }
  return tree
}

function buildSubgruposMap(categorias: Categoria[]): Map<string, string[]> {
  const map = new Map<string, Set<string>>()
  for (const c of categorias) {
    if (!c.subgrupo) continue
    if (!map.has(c.grupo)) map.set(c.grupo, new Set())
    map.get(c.grupo)!.add(c.subgrupo)
  }
  return new Map(Array.from(map.entries()).map(([k, v]) => [k, Array.from(v)]))
}

export function CategoriaTree({
  categorias, onCreate, onUpdate, onDelete, onRenameGrupo, onRenameSubgrupo,
}: Props) {
  const tree = buildTree(categorias)
  const subgruposMap = buildSubgruposMap(categorias)
  const grupos = Object.keys(tree).sort()
  const [expanded, setExpanded] = useState<Set<string>>(new Set(grupos))

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleRenameGrupo(oldName: string) {
    const newName = prompt(`Renombrar grupo "${oldName}" a:`, oldName)
    if (newName && newName !== oldName) await onRenameGrupo(oldName, newName)
  }

  async function handleRenameSubgrupo(grupo: string, oldName: string) {
    const newName = prompt(`Renombrar subgrupo "${oldName}" a:`, oldName)
    if (newName && newName !== oldName) await onRenameSubgrupo(grupo, oldName, newName)
  }

  async function handleDelete(cat: Categoria) {
    if (confirm(`¿Borrar categoría "${cat.nombre}"? Los movimientos asociados quedarán sin categoría.`)) {
      await onDelete(cat.id)
    }
  }

  return (
    <div className="space-y-2">
      {grupos.map(g => {
        const isExpanded = expanded.has(g)
        const subgrupos = Object.keys(tree[g]).sort()
        const totalCount = subgrupos.reduce((s, sg) => s + tree[g][sg].length, 0)

        return (
          <div key={g} className="bg-card border border-border rounded-xl overflow-hidden">
            <div
              className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/30"
              onClick={() => toggle(g)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="font-semibold text-sm flex-1">{g}</span>
              <span className="text-xs text-muted-foreground">{totalCount} categorías</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleRenameGrupo(g) }}
                className="h-6 w-6 p-0"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>

            {isExpanded && (
              <div className="px-2 pb-2 space-y-1">
                {subgrupos.map(sg => {
                  const sgKey = `${g}::${sg}`
                  const sgExpanded = expanded.has(sgKey)
                  const cats = tree[g][sg]
                  return (
                    <div key={sgKey} className="ml-4">
                      <div
                        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/30 rounded"
                        onClick={() => toggle(sgKey)}
                      >
                        {sgExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        <span className="text-xs font-medium flex-1">{sg}</span>
                        <span className="text-xs text-muted-foreground">{cats.length}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleRenameSubgrupo(g, sg) }}
                          className="h-6 w-6 p-0"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                      {sgExpanded && (
                        <div className="ml-6 space-y-1">
                          {cats.map(c => (
                            <div key={c.id} className="flex items-center gap-2 p-2 hover:bg-muted/30 rounded">
                              <span className="text-lg">{c.icono}</span>
                              <span className="text-sm flex-1">{c.nombre}</span>
                              <CategoriaFormDialog
                                trigger={
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                }
                                categoria={c}
                                grupos={grupos}
                                subgruposPorGrupo={subgruposMap}
                                onSubmit={onUpdate}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(c)}
                                className="h-6 w-6 p-0 text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <CategoriaFormDialog
        trigger={
          <Button variant="outline" className="w-full gap-2">
            <Plus className="h-4 w-4" /> Nueva categoría
          </Button>
        }
        grupos={grupos}
        subgruposPorGrupo={subgruposMap}
        onSubmit={onCreate}
      />
    </div>
  )
}
```

- [ ] **Step 33.2: Build + commit**

```bash
cd persofinancia && npx tsc --noEmit
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/components/config/categoria-tree.tsx
git commit -m "feat(categorias): add hierarchical CategoriaTree with expand/collapse"
```

---

### Task 34: Rewrite `/config/categorias`

**Files:**
- Replace: `persofinancia/app/(dashboard)/config/categorias/page.tsx`

- [ ] **Step 34.1: Reescribir page.tsx**

```typescript
// persofinancia/app/(dashboard)/config/categorias/page.tsx
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { CategoriaTree } from '@/components/config/categoria-tree'
import type { Categoria } from '@/lib/types/database'

async function createCategoria(formData: FormData) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const nombre = String(formData.get('nombre') ?? '').trim()
  if (!nombre) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('categorias') as any).insert({
    user_id: user.id,
    nombre,
    grupo: String(formData.get('grupo') ?? 'Variable'),
    subgrupo: String(formData.get('subgrupo') ?? '').trim(),
    icono: String(formData.get('icono') ?? '📌').trim(),
    color: String(formData.get('color') ?? '#64748b'),
  })
  revalidatePath('/config/categorias')
}

async function updateCategoria(formData: FormData) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const id = String(formData.get('id') ?? '')
  if (!id) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('categorias') as any).update({
    nombre: String(formData.get('nombre') ?? '').trim(),
    grupo: String(formData.get('grupo') ?? 'Variable'),
    subgrupo: String(formData.get('subgrupo') ?? '').trim(),
    icono: String(formData.get('icono') ?? '📌').trim(),
    color: String(formData.get('color') ?? '#64748b'),
  }).eq('id', id).eq('user_id', user.id)
  revalidatePath('/config/categorias')
}

async function deleteCategoria(id: string) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('categorias').delete().eq('id', id).eq('user_id', user.id)
  revalidatePath('/config/categorias')
}

async function renameGrupo(oldName: string, newName: string) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('categorias') as any).update({ grupo: newName })
    .eq('user_id', user.id).eq('grupo', oldName)
  revalidatePath('/config/categorias')
}

async function renameSubgrupo(grupo: string, oldName: string, newName: string) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('categorias') as any).update({ subgrupo: newName })
    .eq('user_id', user.id).eq('grupo', grupo).eq('subgrupo', oldName)
  revalidatePath('/config/categorias')
}

export default async function CategoriasPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cats } = await supabase
    .from('categorias')
    .select('*')
    .eq('user_id', user.id)
    .order('grupo')
    .order('subgrupo')
    .order('nombre')

  const categorias = (cats ?? []) as Categoria[]

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h1 className="text-xl font-bold">Categorías</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Gestiona tus categorías organizadas en 3 niveles: Grupo → Subgrupo → Categoría
        </p>
      </div>

      <CategoriaTree
        categorias={categorias}
        onCreate={createCategoria}
        onUpdate={updateCategoria}
        onDelete={deleteCategoria}
        onRenameGrupo={renameGrupo}
        onRenameSubgrupo={renameSubgrupo}
      />
    </div>
  )
}
```

- [ ] **Step 34.2: Build + commit**

```bash
cd persofinancia && npx tsc --noEmit && npm run build
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales/PersoFinancIA"
git add persofinancia/
git commit -m "feat(categorias): rewrite /config/categorias with hierarchical CRUD"
```

---

## Resumen de Tareas — Fase 3

| # | Tarea | Fase |
|---|-------|------|
| 1 | Migración SQL `presupuestos` | A |
| 2 | Tipos TypeScript actualizar | A |
| 3 | `lib/analitica/ranges.ts` | A |
| 4 | `lib/analitica/aggregations.ts` | A |
| 5 | `lib/analitica/projection.ts` | A |
| 6 | `lib/analitica/regression.ts` | A |
| 7 | `lib/analitica/colors.ts` (useChartColors) | A |
| 8 | `ChartEmpty` shared | A |
| 9 | `RangeSelector` | B |
| 10 | `/analitica` server page | B |
| 11 | `AnaliticaClient` con sub-tabs | B |
| 12 | `BehaviorMetrics` card | C |
| 13 | `Allocation50_30_20` donut | C |
| 14 | `AllocationByGrupo` donut | C |
| 15 | `ResumenTab` wiring | C |
| 16 | `CategoryDonut` chart | D |
| 17 | `TopMerchantsBar` chart | D |
| 18 | `MonthlyBars` chart (con proyección) | D |
| 19 | `CategoryTrendLine` chart | D |
| 20 | `DailyCumulative` chart | D |
| 21 | `GastosTab` wiring (sin presupuesto) | D |
| 22 | `/config/presupuestos` page | E |
| 23 | `BudgetVsActual` chart | E |
| 24 | Wire `BudgetVsActual` en GastosTab | E |
| 25 | `IncomeByTypeBar` chart | F |
| 26 | `IngresosTab` wiring | F |
| 27 | `DebtByMonthLine` + `DebtByEntityBar` | G |
| 28 | `DeudaTab` wiring | G |
| 29 | `CashflowCombo` chart | H |
| 30 | `CashflowTable` + `FlujoTab` | H |
| 31 | `ProjectionLine` + `ProyeccionTab` | I |
| 32 | `CategoriaFormDialog` | J |
| 33 | `CategoriaTree` | J |
| 34 | Rewrite `/config/categorias` | J |

**Total: 34 tareas atómicas** (1-3 archivos por tarea, ~5-15 min cada una).

---

## Cobertura del Spec

- [x] Sección 2 (Arquitectura): Tasks 10, 11
- [x] Sección 3 (Selector de rango): Tasks 3, 9
- [x] Sección 4 (Proyección meses incompletos): Tasks 5, 18
- [x] Sección 5 — Resumen tab: Tasks 12, 13, 14, 15
- [x] Sección 5 — Gastos tab: Tasks 16-21, 23-24
- [x] Sección 5 — Ingresos tab: Tasks 25, 26
- [x] Sección 5 — Deuda tab: Tasks 27, 28
- [x] Sección 5 — Flujo tab: Tasks 29, 30
- [x] Sección 5 — Proyección tab: Tasks 6, 31
- [x] Sección 6 (Presupuestos): Tasks 1, 2, 22, 23, 24
- [x] Sección 7 (Categorías rewrite): Tasks 32, 33, 34
- [x] Sección 8 (Estructura archivos): Cubierta por todas las tareas
- [x] Sección 9 (Funciones puras lib/analitica): Tasks 3, 4, 5, 6
- [x] Sección 10 (Tema-aware): Task 7
- [x] Sección 11 (Estados vacíos): Task 8
- [x] Sección 13 (Criterios aceptación): Validados al final con build + manual testing
