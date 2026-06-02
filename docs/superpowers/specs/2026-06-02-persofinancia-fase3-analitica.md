# PersoFinancIA — Fase 3 · Dashboard de Analítica

**Fecha:** 2026-06-02
**Autor:** Juan Camilo Vélez
**Estado:** Aprobado para implementación
**Scope:** Migración completa de las gráficas analíticas de `finanzas_app.html` al stack Next.js + mejora del CRUD de categorías + nueva gestión de presupuestos

---

## 1. Contexto y objetivo

Hoy el tab `Analítica` en PersoFinancIA es un placeholder. Las gráficas y análisis financieros viven en el archivo legacy `finanzas_app.html` (Chart.js, datos vía Supabase REST). Fase 3 migra esa funcionalidad al stack moderno (Next.js 14 + Recharts) con mejoras significativas:

1. **Selector de rango unificado** en lugar del selector mensual rígido
2. **Proyección de meses incompletos** usando promedio trailing de 3 meses
3. **Tabla `presupuestos`** persistida en Supabase (antes era localStorage)
4. **CRUD jerárquico** para gestionar categorías de los 3 niveles (grupo > subgrupo > categoría)

Datos disponibles: 586 movimientos migrados de Bancolombia para `kmivelez@gmail.com` (user_id `176c3601-8f07-4cf7-9c98-ce89d06cda76`), con rango 2024-06-06 a 2026-06-01.

---

## 2. Arquitectura

### Página principal: `/analitica`

Reemplaza el placeholder actual. Server Component que:
1. Lee `searchParams` (tab + rango)
2. Hace una sola query a `movimientos` para todo el rango
3. Pasa los datos al Client Component que renderiza tabs + gráficas

### Estado URL-driven

Filtros viven en query string:
```
/analitica?tab=gastos&rango=3m
/analitica?tab=proyeccion
/analitica?tab=flujo&rango=12m
```

Beneficios:
- Compartir/marcar URL específica
- El back del browser navega entre filtros
- Server Component re-fetch al cambiar de rango

### Sub-tabs internos

Una página, 6 sub-tabs scrolleables horizontalmente (UX mobile-first):

```
Resumen | Gastos | Ingresos | Deuda | Flujo | Proyección
```

Tab activo destacado, el resto en `text-muted-foreground`.

### Patrón de datos

- **Una sola query por rango** — el server fetch todos los movimientos del periodo
- El cliente hace todas las agregaciones en memoria
- Cambiar de sub-tab es instantáneo (sin re-fetch)
- Cambiar de rango = nueva navegación = nuevo fetch

---

## 3. Selector de rango

Topbar sticky con chips horizontales:

```
[1M] [3M] [6M] [12M] [YTD] [Personalizado]
```

**Default:** `3M` (últimos 3 meses) — buen balance entre contexto y relevancia

**Personalizado:** abre un date range picker (componente shadcn `Calendar`). Los valores se serializan en URL como `&desde=2026-01-01&hasta=2026-03-31`.

**Aplica a:** Resumen, Gastos, Ingresos, Deuda, Flujo.
**NO aplica a:** Proyección (siempre mira al futuro: 3 meses adelante usando todo el histórico).

---

## 4. Proyección de meses incompletos

### Problema
A inicio de mes, las gráficas muestran un mes "casi vacío" que distorsiona promedios y comparativas.

### Solución
Para el mes en curso, calcular proyección al cierre:

```
proyección_mes_actual =
  gasto_real_hasta_hoy +
  (promedio_diario_últimos_3_meses_completos × días_restantes_del_mes)
```

### Aplicación visual

- Meses pasados completos → barra sólida (color del flujo)
- Mes en curso → barra dividida:
  - Parte inferior sólida (real hasta hoy)
  - Parte superior translúcida (proyección al cierre)
- Meses futuros (solo en tab Proyección) → barra translúcida con banda ±1σ

### Reglas especiales

- Usuario nuevo con <3 meses de historial → usar todos los meses disponibles
- Datos viejos → ignorar meses anteriores a los últimos 6
- "Gasto promedio mensual" en KPIs → solo cuenta meses completos del rango (mes en curso NO contribuye, ni real ni proyectado)

---

## 5. Sub-tabs y gráficas

### 📊 Resumen

**KPIs (4 tarjetas):**
- Ingresos del rango
- Gastos del rango
- Balance
- Tasa de ahorro (balance / ingresos × 100)

**Gráficas:**
- **Donut 50/30/20** — Necesidades vs Deseos vs Ahorro. Mapeo desde `categorias.grupo`:
  - Grupo `Fijo` OR `Deuda` → Necesidades (target 50%)
  - Grupo `Variable` → Deseos (target 30%)
  - Balance positivo (ingresos − gastos) → Ahorro (target 20%)
  - Si balance es negativo, no se muestra segmento de Ahorro y aparece warning visual
- **Donut de asignación real** — Cómo se distribuyen tus gastos por grupo
- **Métricas conductuales:** ingreso promedio mensual, gasto promedio mensual, volatilidad (desviación estándar), tasa de ahorro mensual

### 💸 Gastos

**Gráficas:**
- **Donut de categorías** — Top 8 categorías + "Otros" agregado
- **Top 10 comercios** — Bar horizontal ordenado descendente
- **Gastos por mes** — Bar chart. Mes en curso con barra dividida (real + proyección)
- **Tendencia por categoría** — Multi-line, top 5 categorías por gasto total
- **Comparativa vs presupuesto** — Bar chart con metas. Lee de tabla `presupuestos`. Colores: verde si bajo presupuesto, amarillo cerca del límite, rojo si lo superó
- **Gasto acumulado diario del mes** — Line chart del mes en curso (X = día del mes, Y = gasto acumulado)

### 💰 Ingresos

**KPIs (3 tarjetas):**
- Ingreso promedio mensual
- Ingreso máximo del rango
- Varianza (cuánto fluctúa)

**Gráficas:**
- **Ingresos por mes** — Bar chart. Mes en curso con proyección translúcida
- **Desglose por tipo** — Horizontal bar. Tipos basados en `categoria` (Nómina, Transferencias, Ingreso, Otros)

### 🏦 Deuda

Filtra movimientos donde `categoria = 'Deuda'`.

**KPI:** Total pagado en el rango seleccionado

**Gráficas:**
- **Pagos a deuda por mes** — Line chart
- **Pagos por entidad/acreedor** — Horizontal bar. La entidad se extrae de `descripcion` (parser simple: primeras 2-3 palabras)

### 🌊 Flujo de Caja

**Gráficas:**
- **Ingresos vs Gastos vs Neto** — Combo chart: 2 grupos de barras (ingresos verde, gastos rojo) + 1 línea de neto
- **Tabla de 13 meses** — Columnas: mes, ingresos, gastos, neto, tasa de ahorro. Última fila TOTAL. Mes en curso en cursiva con asterisco indicando proyección

### 🔮 Proyección

**Modelo:** Regresión lineal sobre meses completos del histórico disponible (no afectado por selector de rango).

**Salida:**
- 3 meses futuros con punto + banda de confianza ±1σ
- R² del modelo
- Lectura del analista (texto generado): "Tu tendencia mensual es +X%, con volatilidad Y%. La proyección a 3 meses es ~$Z."
- Si volatilidad > 30% del promedio → warning visual amarillo

**Gráfica:**
- Línea histórica (meses completos) sólida
- Línea proyectada (3 meses futuros) punteada
- Banda translúcida ±1σ alrededor de los proyectados

---

## 6. Presupuestos

### Tabla `presupuestos`

```sql
CREATE TABLE public.presupuestos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  monto        NUMERIC(15,2) NOT NULL CHECK (monto >= 0),
  activo       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, categoria_id)
);

ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presupuestos_own" ON public.presupuestos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Un solo presupuesto por categoría (UNIQUE constraint). Mismo monto cada mes — sin overrides mensuales (YAGNI).

### UI: `/config/presupuestos`

Lista plana de categorías de gasto (excluye Ingreso) con input numérico:

```
🛒 Mercado/Hogar         [    $800.000 ]
🍕 Domicilios/Comida     [    $400.000 ]
🚗 Transporte            [    $250.000 ]
💊 Salud/Farmacia        [    $150.000 ]
...

TOTAL PRESUPUESTADO: $5.450.000
INGRESO PROMEDIO MENSUAL: $15.800.000

Tu presupuesto es 35% de tu ingreso promedio
```

Si total > ingreso → warning rojo "Tu presupuesto supera tu ingreso promedio".

### Integración con tab Gastos

La gráfica "Comparativa vs presupuesto" lee de esta tabla. Para cada categoría:
```
gasto_real_del_rango / (presupuesto_mensual × meses_en_rango) = % de uso
```

Color del bar:
- < 80% → verde
- 80-100% → amarillo
- > 100% → rojo

---

## 7. Categorías — Rewrite con vista jerárquica

### Estado actual
`/config/categorias` hoy solo tiene Crear + Borrar. No se puede editar nada.

### Rewrite

**Layout:** Lista de 3 niveles expandible/colapsable.

```
▼ Variable (8 categorías)              [✏️ renombrar]
   ▼ Alimentación (2)                  [✏️ renombrar]
       🛒 Mercado/Hogar                [✏️ | 🗑️]
       🍕 Domicilios/Comida            [✏️ | 🗑️]
       [+ Agregar categoría]
   ▶ Movilidad (1)
   ▶ Compras (3)
   [+ Agregar subgrupo]

▶ Fijo (3 categorías)
▶ Ingreso (1 categoría)
```

### Acciones por nivel

**Grupo:**
- Renombrar (cascada): `UPDATE categorias SET grupo = 'nuevo' WHERE user_id = ? AND grupo = 'viejo'`
- NO se puede crear/borrar (son los 4 grupos fijos: Variable, Fijo, Ingreso, Deuda)

**Subgrupo:**
- Renombrar (cascada): igual al grupo
- Crear nuevo: agrega un nodo vacío que aparece al crear la primera categoría con ese subgrupo
- Borrar (si está vacío): valida que no haya categorías con ese subgrupo

**Categoría:**
- Crear: form con nombre + grupo (dropdown) + subgrupo (dropdown filtrado por grupo) + ícono + color
- Editar: misma form pre-llenada
- Borrar: si tiene movimientos asociados, advertir antes de borrar (los movimientos quedan con `categoria = null`)

### Implementación

Server Actions para todas las mutaciones. `revalidatePath('/config/categorias')` después de cada cambio.

---

## 8. Estructura de archivos

```
app/(dashboard)/analitica/
├── page.tsx                                ← Server: fetch + render shell
├── analitica-client.tsx                    ← Client: tabs + state + aggregations
└── _ranges.ts                              ← Constants (1M, 3M, 6M, 12M, YTD)

components/analitica/
├── range-selector.tsx                      ← Chips horizontales sticky
├── tabs/
│   ├── resumen-tab.tsx
│   ├── gastos-tab.tsx
│   ├── ingresos-tab.tsx
│   ├── deuda-tab.tsx
│   ├── flujo-tab.tsx
│   └── proyeccion-tab.tsx
├── charts/
│   ├── category-donut.tsx                  ← Top N + Otros agregado
│   ├── allocation-50-30-20.tsx             ← Donut 50/30/20
│   ├── allocation-by-grupo.tsx             ← Donut real por grupo
│   ├── top-merchants-bar.tsx               ← Horizontal bar top 10
│   ├── monthly-bars.tsx                    ← Bar con proyección translúcida
│   ├── category-trend-line.tsx             ← Multi-line top 5
│   ├── budget-vs-actual.tsx                ← Bar con metas
│   ├── daily-cumulative.tsx                ← Line gasto acumulado intra-mes
│   ├── income-by-type-bar.tsx              ← Horizontal bar
│   ├── debt-by-month-line.tsx
│   ├── debt-by-entity-bar.tsx              ← Horizontal bar
│   ├── cashflow-combo.tsx                  ← Bars + line combo
│   ├── cashflow-table.tsx                  ← 13-month table
│   └── projection-line.tsx                 ← Line con banda confianza
├── cards/
│   └── behavior-metrics.tsx                ← 4 métricas conductuales
└── shared/
    ├── chart-empty.tsx                     ← Empty state "Sin datos"
    └── chart-tooltip.tsx                   ← Tooltip styled con tema

lib/analitica/
├── aggregations.ts                         ← groupByCategoria, byMes, byEntidad
├── projection.ts                           ← Trailing avg + month extrapolation
├── regression.ts                           ← Linear regression + R² + ±1σ
├── ranges.ts                               ← rangeToDates (1M → {start, end})
└── colors.ts                               ← Paleta de colores para categorías

app/(dashboard)/config/categorias/
└── page.tsx                                ← REESCRITA: hierarchical CRUD

app/(dashboard)/config/presupuestos/
└── page.tsx                                ← NUEVO

components/config/
├── categoria-tree.tsx                      ← Vista jerárquica con expand/collapse
├── categoria-form-dialog.tsx               ← Dialog crear/editar categoría
└── presupuesto-item.tsx                    ← Row con input numérico

supabase/migrations/
└── 20260602000001_presupuestos.sql         ← Tabla + RLS + UNIQUE constraint

lib/types/database.ts
└── Add Presupuesto interface + Database.Tables.presupuestos
```

---

## 9. Funciones puras en `lib/analitica/`

Todas las funciones de agregación son puras (sin estado, sin side effects) para ser fácilmente testeables.

### `aggregations.ts`

```typescript
groupByCategoria(movs: Movimiento[]): { categoria: string, total: number, count: number }[]
groupByMes(movs: Movimiento[]): { mes: string, ingresos: number, gastos: number }[]
groupByEntidad(movs: Movimiento[]): { entidad: string, total: number }[]
groupByTipo(movs: Movimiento[]): { tipo: string, total: number }[]
topN<T extends { total: number }>(items: T[], n: number): T[]
```

### `projection.ts`

```typescript
projectCurrentMonth(
  movs: Movimiento[],
  currentMonth: string,        // YYYY-MM
  trailing: number = 3         // # de meses previos a promediar
): { actual: number, projected: number, dailyAverage: number }
```

### `regression.ts`

```typescript
linearRegression(points: { x: number, y: number }[]): {
  slope: number
  intercept: number
  r2: number
  predict(x: number): number
  confidenceBand(x: number, sigma: number): { lo: number, hi: number }
}

forecast(
  monthlyTotals: { mes: string, total: number }[],
  monthsAhead: number = 3
): { mes: string, predicted: number, lo: number, hi: number }[]
```

### `ranges.ts`

```typescript
type RangeKey = '1m' | '3m' | '6m' | '12m' | 'ytd' | 'custom'

rangeToDates(key: RangeKey, custom?: { from: Date, to: Date }): {
  start: string   // YYYY-MM-DD
  end: string     // YYYY-MM-DD
}
```

---

## 10. Tema-aware en Recharts

Recharts usa hex colors por default. Para que dark/light funcione, todos los componentes de gráficas leen colores del CSS:

```typescript
// shared/chart-colors.ts
function useChartColors() {
  // Read CSS variables on mount (client-side)
  return {
    income: 'hsl(var(--income))',
    expense: 'hsl(var(--expense))',
    debt: 'hsl(var(--debt))',
    primary: 'hsl(var(--primary))',
    muted: 'hsl(var(--muted-foreground))',
    grid: 'hsl(var(--border))',
  }
}
```

Los componentes de gráficas usan este hook. Al cambiar tema → Recharts re-renderiza con colores nuevos.

Para paleta de categorías (10+ colores distintos), usar una paleta fija balanceada para ambos temas.

---

## 11. Estados vacíos

Cuando una gráfica no tiene datos para mostrar:

```
🌵
Sin movimientos en este rango
Ajusta el rango o filtros para ver tus datos
```

Componente `<ChartEmpty>` reutilizable. Cada chart hace check `if (data.length === 0) return <ChartEmpty />`.

---

## 12. Performance

Con 586 movimientos del usuario actual:
- Una query de Supabase trae todos los del rango (típicamente 50-200 movimientos)
- Las agregaciones in-memory son <10ms (incluso para 10K movimientos)
- Recharts renderiza típicamente <50ms por gráfica
- Total: cambio de tab instantáneo (<100ms)

Para usuarios futuros con >10K movimientos (caso extremo):
- La query sigue siendo eficiente gracias al índice `idx_movimientos_user_fecha`
- Si se vuelve lento → migrar agregaciones a Postgres con materialized views (FUTURO, no en Fase 3)

---

## 13. Criterios de aceptación

### Analítica
- [ ] Tab `/analitica` muestra los 6 sub-tabs
- [ ] Selector de rango funciona y persiste en URL
- [ ] Las 14 gráficas listadas renderizan correctamente con datos reales
- [ ] Mes en curso muestra proyección visible (barra dividida)
- [ ] Cambio entre sub-tabs es <100ms (sin re-fetch)
- [ ] Tema dark/light cambia colores de las gráficas correctamente

### Presupuestos
- [ ] Tabla `presupuestos` creada con RLS
- [ ] `/config/presupuestos` permite editar metas por categoría
- [ ] Gráfica "Comparativa vs presupuesto" en tab Gastos lee de la tabla
- [ ] Indicador de % presupuestado vs ingreso aparece en header

### Categorías
- [ ] `/config/categorias` muestra vista jerárquica de 3 niveles
- [ ] Renombrar grupo/subgrupo aplica cascada en BD
- [ ] Crear/editar/borrar categoría funciona
- [ ] Borrar categoría con movimientos asociados muestra warning

---

## 14. Fuera de scope (futuras fases)

- Comparativas año vs año (YoY)
- Exportar reportes a PDF
- Overrides de presupuesto por mes
- Subcategorías como 4° nivel (sería Fase 6+ si se necesita)
- Chat IA conversacional sobre los datos (Fase 5)
- Alertas proactivas basadas en los presupuestos (Fase 5)
