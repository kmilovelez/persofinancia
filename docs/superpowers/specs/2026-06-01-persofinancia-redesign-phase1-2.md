# PersoFinancIA — Rediseño Escalable · Fase 1 + 2

**Fecha:** 2026-06-01  
**Autor:** Juan Camilo Vélez  
**Estado:** Aprobado para implementación  
**Scope:** Fase 1 (Fundación) + Fase 2 (Ingesta de emails)

---

## 1. Contexto y objetivo

### Situación actual
PersoFinancIA existe hoy como dos archivos HTML standalone (`finanzas_app.html` y `finanzas_personal.html`) que:
- Consumen datos de Supabase con una API key pública expuesta en el HTML
- Solo leen datos de la tabla `bancolombia_movimientos` (un solo banco)
- No tienen autenticación real — cualquiera con la URL puede ver los datos
- No son mantenibles a medida que crecen (858 y 1050 líneas en un solo archivo)
- Los datos entran vía un scheduled de Claude Cowork que lee Gmail

### Objetivo
Convertir PersoFinancIA en una aplicación web escalable, segura y mobile-first que sea la herramienta principal de análisis financiero personal de Juan Camilo Vélez, con soporte multi-usuario, ingesta automática de emails de 7 bancos, motor de categorización inteligente con IA, y chat conversacional sobre sus propias finanzas.

### Fases del proyecto
| Fase | Contenido | Este documento |
|------|-----------|---------------|
| **Fase 1** | Fundación: auth, modelo de datos, CRUD, deploy | ✅ |
| **Fase 2** | Ingesta: Edge Functions, parsers por banco, gestión de bancos | ✅ |
| Fase 3 | Dashboard: migración de gráficas al nuevo stack | Spec futuro |
| Fase 4 | Categorización: motor de reglas + Claude fallback | Spec futuro |
| Fase 5 | IA: chat conversacional + alertas proactivas | Spec futuro |

---

## 2. Stack tecnológico

### Frontend
- **Framework:** Next.js 14 con App Router y TypeScript
- **UI:** shadcn/ui + Tailwind CSS
- **Gráficas:** Recharts
- **PWA:** `next-pwa` — manifest + service worker para instalar en celular
- **Tema:** Dark / Light / System (detecta `prefers-color-scheme`), persiste en `localStorage` y en `profiles.tema`
- **Deploy:** Vercel (plan gratuito, CI/CD automático desde GitHub)

### Backend
- **Base de datos + Auth:** Supabase (proyecto existente `hgvgjwvwiycuxcebqfvx`)
- **Seguridad:** Row Level Security (RLS) activo en todas las tablas — cada usuario solo accede a sus propios datos
- **Storage:** Supabase Storage, bucket privado `csv-imports/{user_id}/`
- **Edge Functions:** Deno — reemplazan el scheduled de Claude Cowork

### IA (Fase 5, arquitectura definida ahora)
- **Chat + clasificación:** Claude Sonnet vía Supabase Edge Functions
- **API key:** Solo en variables de entorno de Edge Functions — nunca llega al browser

---

## 3. Arquitectura general

```
Browser / PWA (Next.js 14)
        │
        ├── Supabase JS SDK  →  Auth + DB queries (RLS)
        │
        └── /api/* (Next.js API Routes)  →  proxy seguro para Edge Functions
                                              (evita exponer URLs de Edge Fn al cliente)

Supabase
        ├── Auth  (email + magic link)
        ├── PostgreSQL  (RLS por user_id)
        ├── Storage  (CSV uploads)
        ├── Realtime  (alertas en vivo)
        └── Edge Functions (Deno)
                ├── ingest-emails    → cron 7:30am, lee Gmail, parsea, upsert
                ├── classify-tx      → reglas + Claude fallback
                ├── ai-chat          → chat conversacional (Fase 5)
                └── ai-alerts        → análisis proactivo diario (Fase 5)
```

**Flujo de seguridad:**
1. Usuario se autentica → Supabase emite JWT
2. Todas las queries llevan el JWT → RLS verifica `auth.uid() = user_id`
3. API keys de Claude viven solo en `SUPABASE_EDGE_SECRETS` — nunca en el cliente

---

## 4. Modelo de datos

### Tabla: `profiles`
Extiende `auth.users` con datos de la aplicación.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `user_id` | uuid PK | FK → `auth.users.id` |
| `nombre` | text | Nombre display |
| `email` | text | Copiado de auth |
| `tema` | text | `dark` / `light` / `system` |
| `gmail_token` | text | OAuth token cifrado (Supabase Vault) |
| `created_at` | timestamptz | |

### Tabla: `bancos`
Un registro por banco configurado, por usuario.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid PK | |
| `user_id` | uuid FK | → `profiles.user_id` |
| `nombre` | text | Ej: "Bancolombia", "Nequi" |
| `icono` | text | Emoji o URL de icono |
| `gmail_query` | text | Query para Gmail search_threads |
| `parser_type` | text | `bancolombia` / `nequi` / `rappicard` / `occidente` / `lulobank` / `nu` / `hapi` / `generic` |
| `parser_config` | jsonb | Config específica del parser (verbos, regex, remitente) |
| `activo` | boolean | Si el cron lo procesa |
| `ultimo_sync` | timestamptz | Última ejecución exitosa |
| `created_at` | timestamptz | |

**Bancos preconfigurados al registro:** Bancolombia, Nequi, RappiCard, Banco de Occidente, Lulobank, NU, Hapi. El usuario solo activa los que tiene.

### Tabla: `movimientos`
Tabla unificada para todos los bancos. Reemplaza `bancolombia_movimientos`.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | text PK | Gmail message ID (idempotencia) o UUID para manuales |
| `user_id` | uuid FK | → `profiles.user_id` |
| `banco_id` | uuid FK | → `bancos.id` (null para manuales sin banco) |
| `fecha` | date | Fecha del movimiento |
| `hora` | text | HH:MM |
| `tipo` | text | Compra / Transferencia / Pago / Ingreso / etc. |
| `flujo` | text | `in` / `out` |
| `monto` | numeric | COP, siempre positivo |
| `descripcion` | text | Descripción del movimiento |
| `categoria` | text | Categoría aplicada |
| `categoria_manual` | boolean | true si el usuario la cambió manualmente |
| `regla_aplicada` | uuid | FK → `reglas_categoria.id` (null si fue Claude o manual) |
| `confianza_ia` | numeric | 0-100, score de Claude (null si fue por regla) |
| `origen` | text | `email` / `csv` / `manual` |
| `cuenta` | text | Ej: `*4000` (número de cuenta/tarjeta) |
| `raw` | text | Texto original del email snippet |
| `created_at` | timestamptz | |

**Migración:** Los datos de `bancolombia_movimientos` se migran a `movimientos` como parte de Fase 1.

### Tabla: `categorias`
Categorías personalizables por usuario.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `nombre` | text | Ej: "Domicilios/Comida" |
| `grupo` | text | Ej: "Variable" |
| `subgrupo` | text | Ej: "Alimentación" |
| `icono` | text | Emoji |
| `color` | text | Hex color para gráficas |

**Categorías por defecto al registro:** Mercado/Hogar, Domicilios/Comida, Transporte/Gasolina, Compras/Retail, Salud/Farmacia, Suscripciones/Tech, Pagos/Servicios, Transferencias, Pagos QR, Deuda, Ingreso, Otros.

### Tabla: `reglas_categoria`
Motor de reglas para categorización automática.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `categoria_id` | uuid FK | → `categorias.id` |
| `campo` | text | `descripcion` / `monto` / `tipo` / `banco` |
| `operador` | text | `contains` / `starts_with` / `equals` / `gt` / `lt` |
| `valor` | text | Valor a comparar |
| `prioridad` | integer | Orden de evaluación (menor = primero) |
| `activa` | boolean | |
| `origen` | text | `manual` / `ai_suggestion` |
| `aplicaciones` | integer | Cuántas veces se ha aplicado |
| `created_at` | timestamptz | |

### Tabla: `alertas`
Alertas generadas por la Edge Function `ai-alerts` (Fase 5).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `tipo` | text | `critica` / `advertencia` / `sugerencia` |
| `titulo` | text | |
| `mensaje` | text | |
| `leida` | boolean | |
| `created_at` | timestamptz | |

### RLS — políticas base (aplica a todas las tablas)
```sql
-- Ejemplo para `movimientos` (igual para todas las tablas del usuario)
CREATE POLICY "users_own_data" ON movimientos
  FOR ALL USING (auth.uid() = user_id);
```

---

## 5. Navegación — 5 tabs (Bottom Navigation)

```
🏠 Inicio  |  📋 Movimientos  |  ✦ Chat IA  |  📊 Analítica  |  ⚙️ Config
```

### 🏠 Inicio (Dashboard)
- KPIs del mes actual: ingresos, gastos, balance, tasa de ahorro
- Gráfica de flujo de caja (6 meses)
- Alertas críticas activas
- Sugerencias proactivas de IA (Fase 5)

### 📋 Movimientos
- Lista paginada con búsqueda full-text y filtros (todos / ingresos / gastos / deuda / banco / mes)
- Cada ítem muestra: descripción, categoría con ícono, monto, fecha, origen (email/manual/csv)
- Indicador amarillo "sin categoría" para movimientos pendientes
- Indicador morado "manual" para movimientos creados a mano
- **FAB (+)** para crear movimiento manual
- Tap en ítem → drawer de edición (categoría, descripción, monto, fecha)
- Swipe izquierda → botón eliminar (con confirmación)

### ✦ Chat IA (Fase 5 — pantalla existe desde Fase 1, funcional en Fase 5)
- Interfaz de chat estilo WhatsApp
- Historial de conversaciones persistido
- Sugerencias rápidas precargadas: "¿Cuánto gasté esta semana?", "Simular pago RappiCard", etc.
- Acceso al contexto completo de movimientos del usuario

### 📊 Analítica
Sub-tabs internos: Gastos · Ingresos · Deuda · Flujo · Proyección  
(Migración completa de las funcionalidades existentes — Fase 3)

### ⚙️ Config
- **Bancos:** lista de bancos con toggle activo/inactivo + último sync + botón "Agregar banco"
- **Categorías:** CRUD de categorías personales
- **Reglas:** lista de reglas con prioridad drag-to-reorder, toggle, origen (manual/IA)
- **Importar CSV:** subir extracto bancario, mapear columnas, previsualizar antes de importar
- **Tema:** selector Dark / Light / System
- **Cuenta:** nombre, email, cerrar sesión

---

## 6. Tema de color (Dark / Light / System)

- Selector en Config → Tema
- Persiste en `localStorage` (inmediato) y en `profiles.tema` (para sincronizar entre dispositivos)
- `System` usa `prefers-color-scheme` del OS
- Implementado con `next-themes` + variables CSS de Tailwind
- Aplica a toda la app incluyendo gráficas (paleta adaptada por tema)

---

## 7. Ingesta de emails — Edge Function `ingest-emails`

### Trigger
- Cron de Supabase: `0 7 30 * * *` (7:30am hora Colombia, UTC-5)
- También invocable manualmente desde Config → Bancos → "Sync ahora"

### Flujo
```
1. SELECT bancos WHERE activo = true (por cada usuario con gmail_token)
2. Por cada banco activo:
   a. Gmail search_threads con gmail_query del banco (ayer)
   b. Para cada thread/mensaje:
      - Extraer snippet
      - Invocar parser específico del banco
      - Obtener: fecha, hora, tipo, flujo, monto, descripcion, cuenta
   c. Invocar classify-tx para asignar categoría
   d. INSERT INTO movimientos ... ON CONFLICT (id) DO NOTHING
3. Registrar ultimo_sync en bancos
4. Generar resumen (movimientos guardados, total ingresos, total egresos)
```

### Parsers por banco

| Banco | Estado | Parser type | Remitente |
|-------|--------|-------------|-----------|
| Bancolombia | ✅ Migrado de Claude Cowork | `bancolombia` | `@bancolombia.com.co` |
| Nequi | 🔨 Nuevo | `nequi` | `@nequi.com.co` |
| RappiCard | 🔨 Nuevo | `rappicard` | `@rappi.com` |
| Banco de Occidente | 🔨 Nuevo | `occidente` | `@bancodeoccidente.com.co` |
| Lulobank | 🔨 Nuevo | `lulobank` | `@lulobank.com` |
| NU | 🔨 Nuevo | `nu` | `@nu.com.co` |
| Hapi | 🔨 Nuevo | `hapi` | `@hapi.com.co` |

**Parsers nuevos (Nequi–Hapi):** Se construyen en Fase 2 analizando emails reales del usuario. El modo `generic` permite al usuario configurar un parser básico desde la UI para bancos no soportados.

### Idempotencia
- PK de `movimientos.id` = Gmail message ID para emails
- `ON CONFLICT (id) DO NOTHING` — correr el cron varias veces nunca duplica
- Movimientos manuales usan UUID como `id`

### Gestión de Gmail OAuth
- Token OAuth de Gmail guardado cifrado en Supabase Vault (no en texto plano)
- La Edge Function usa el token del usuario que está siendo procesado
- Si el token expiró → marcar banco como `requiere_reautorizacion` y notificar al usuario

---

## 8. Motor de categorización — Edge Function `classify-tx`

### Capas de prioridad (evaluadas en orden)

**Capa 1 — Reglas manuales** (prioridad más alta)
- Se evalúan ordenadas por `reglas_categoria.prioridad ASC`
- Condición: `campo` + `operador` + `valor`
- Si hay match → aplicar categoría, guardar `regla_aplicada = regla.id`
- Determinístico, sin IA

**Capa 2 — Reglas sugeridas por IA** (aprendizaje automático)
- Misma evaluación que capa 1, pero `origen = 'ai_suggestion'`
- Creadas automáticamente cuando el usuario corrige una categoría
- El usuario las puede aprobar, modificar o eliminar desde Config → Reglas

**Capa 3 — Claude fallback**
- Se activa solo si ninguna regla hizo match
- Prompt: descripción + tipo + monto + banco + últimas 30 transacciones similares del usuario
- Respuesta: `{ categoria: string, confianza: number (0-100), razonamiento: string }`
- Si `confianza >= 70` → aplicar automáticamente, guardar `confianza_ia`
- Si el banco es nuevo o la descripción es muy genérica → Claude recibe más contexto histórico

**Capa 4 — Pendiente revisión**
- `confianza < 70` → `categoria = null`, marcado visualmente en amarillo en Movimientos
- El usuario categoriza manualmente → se le pregunta "¿Crear regla para futuras transacciones similares?"
- Si acepta → se crea una `regla_categoria` con `origen = 'ai_suggestion'` para su revisión

### Loop de aprendizaje
```
Usuario corrige categoría
        │
        ▼
¿Quieres crear una regla?
  Sí → regla con origen 'ai_suggestion' (visible en Config → Reglas)
  No → solo corrige ese movimiento
        │
        ▼
Con el tiempo: las reglas manuales cubren 80%+ de los movimientos
Claude solo maneja casos nuevos o inusuales
```

### Conexión inicial de Gmail (onboarding)
El primer paso después del registro es conectar Gmail para habilitar la ingesta:

1. Config → Bancos → "Conectar Gmail"
2. Redirect a Google OAuth consent screen (scopes: `gmail.readonly`)
3. Al aprobar: token guardado cifrado en Supabase Vault bajo `profiles.gmail_token`
4. La Edge Function `ingest-emails` usa este token para autenticarse en Gmail API
5. Si el token expira (refresh token inválido): alerta en Config → Bancos con botón "Reconectar Gmail"

**Sin conexión de Gmail:** los bancos quedan en estado `pendiente_gmail`. El usuario puede aún crear movimientos manuales e importar CSV.

---

## 9. CRUD manual de movimientos

### Crear movimiento manual
- FAB (+) en tab Movimientos
- Campos: fecha, descripción, monto, flujo (in/out), banco (opcional), categoría
- `origen = 'manual'`, `id = UUID`, `banco_id = null` si no se especifica
- Se incluye en todas las analíticas

### Editar movimiento
- Tap en movimiento → drawer lateral
- Campos editables: descripción, monto, fecha, categoría, cuenta
- Al cambiar categoría → se pregunta sobre crear regla

### Eliminar movimiento
- Swipe izquierda → botón rojo "Eliminar"
- Confirmación: "¿Eliminar este movimiento? Esta acción no se puede deshacer."
- Solo disponible para movimientos con `origen = 'manual'` o `origen = 'csv'`
- Movimientos de email: solo se puede cambiar categoría, no eliminar (para mantener trazabilidad)

---

## 10. Importación CSV

### Flujo
1. Config → Importar CSV → seleccionar archivo
2. Subir a Supabase Storage en `csv-imports/{user_id}/`
3. Previsualizar: mostrar primeras 5 filas y mapeo de columnas sugerido
4. Usuario confirma mapeo: ¿cuál columna es fecha? ¿monto? ¿descripción?
5. Edge Function procesa el archivo: parsear → clasificar → upsert
6. Reporte: X movimientos importados, Y duplicados ignorados, Z pendientes de categoría

### Deduplicación
- Hash de `(fecha + monto + descripcion + user_id)` como clave de idempotencia para CSV
- Si el mismo hash ya existe en `movimientos` → ignorar

---

## 11. Pantallas de autenticación

### Login (`/login`)
- Email + magic link (Supabase Auth)
- Sin contraseñas — el usuario recibe un link al email para entrar
- Opción futura: OAuth con Google (para reutilizar el token de Gmail)

### Registro (`/register`)
- Email → magic link
- Al verificar: crear `profiles` con nombre + tema por defecto (`system`)
- Crear categorías por defecto
- Crear bancos preconfigurados (inactivos) para los 7 bancos soportados

---

## 12. PWA — experiencia móvil

- `next-pwa` genera `manifest.json` y service worker automáticamente
- Instalar en Android/iOS: "Agregar a pantalla de inicio" → se abre como app nativa
- Icono, splash screen y colores de tema definidos en `manifest.json`
- Service worker: cache de assets estáticos para carga rápida
- **Sin modo offline** en Fase 1 — requiere conexión para datos (Supabase)

---

## 13. Estructura de carpetas (Next.js App Router)

```
persofinancia/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          ← BottomNav + ThemeProvider
│   │   ├── page.tsx            ← 🏠 Inicio
│   │   ├── movimientos/
│   │   │   ├── page.tsx        ← Lista + filtros
│   │   │   └── [id]/page.tsx   ← Detalle / edición
│   │   ├── chat/page.tsx       ← ✦ Chat IA (placeholder Fase 5)
│   │   ├── analitica/page.tsx  ← 📊 (placeholder Fase 3)
│   │   └── config/
│   │       ├── page.tsx        ← Config home
│   │       ├── bancos/page.tsx
│   │       ├── categorias/page.tsx
│   │       ├── reglas/page.tsx
│   │       ├── importar/page.tsx
│   │       └── tema/page.tsx
│   └── api/
│       ├── ingest/route.ts     ← proxy → Edge Function ingest-emails
│       └── classify/route.ts   ← proxy → Edge Function classify-tx
├── components/
│   ├── ui/                     ← shadcn/ui components
│   ├── bottom-nav.tsx
│   ├── movimiento-item.tsx
│   ├── movimiento-drawer.tsx
│   └── kpi-card.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           ← browser client
│   │   └── server.ts           ← server client (RSC)
│   └── utils.ts
├── supabase/
│   ├── functions/
│   │   ├── ingest-emails/
│   │   │   ├── index.ts
│   │   │   └── parsers/
│   │   │       ├── bancolombia.ts
│   │   │       ├── nequi.ts
│   │   │       ├── rappicard.ts
│   │   │       ├── occidente.ts
│   │   │       ├── lulobank.ts
│   │   │       ├── nu.ts
│   │   │       ├── hapi.ts
│   │   │       └── generic.ts
│   │   └── classify-tx/
│   │       └── index.ts
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── 002_migrate_bancolombia.sql
└── public/
    ├── manifest.json
    └── icons/
```

---

## 14. Migraciones y compatibilidad

### Migración de datos existentes
1. Crear todas las tablas nuevas con RLS
2. Crear registro en `bancos` para Bancolombia (para Juan Camilo)
3. `INSERT INTO movimientos SELECT id, :user_id, :banco_id, fecha, hora, tipo, flujo, monto, descripcion, categoria, false, null, null, 'email', cuenta, raw FROM bancolombia_movimientos`
4. Verificar conteos antes/después
5. La tabla `bancolombia_movimientos` queda como backup durante 30 días, luego se archiva

### Compatibilidad hacia atrás
- Las dos aplicaciones HTML actuales siguen funcionando mientras dure la migración
- La vista `v_movimiento_clasificado` se actualiza para leer de `movimientos` en vez de `bancolombia_movimientos`

---

## 15. Fases siguientes (fuera de scope de este spec)

| Fase | Descripción |
|------|-------------|
| **Fase 3** | Migración del dashboard de gráficas (Chart.js → Recharts, todas las pestañas de analítica) |
| **Fase 4** | Motor de reglas completo en UI + Claude categorización en producción |
| **Fase 5** | Chat IA conversacional + alertas proactivas diarias |

---

## 16. Criterios de aceptación — Fase 1

- [ ] Usuario puede registrarse con email y recibir magic link
- [ ] Usuario puede ver sus movimientos (migrados de `bancolombia_movimientos`)
- [ ] Usuario puede crear un movimiento manual
- [ ] Usuario puede editar la categoría de un movimiento
- [ ] Usuario puede cambiar tema (dark/light/system)
- [ ] App instalable como PWA en Android/iOS
- [ ] API key de Supabase y Claude nunca aparecen en el bundle del frontend
- [ ] RLS: usuario A no puede ver datos de usuario B

## 17. Criterios de aceptación — Fase 2

- [ ] Edge Function `ingest-emails` reemplaza el scheduled de Claude Cowork
- [ ] Bancolombia: misma lógica de parsing, misma idempotencia
- [ ] Al menos 2 bancos adicionales parseados correctamente (Nequi + uno más)
- [ ] Usuario puede activar/desactivar bancos desde Config
- [ ] Usuario puede agregar un banco nuevo con parser genérico
- [ ] Sync manual disponible desde Config → Bancos
- [ ] Importación CSV funcional con deduplicación
