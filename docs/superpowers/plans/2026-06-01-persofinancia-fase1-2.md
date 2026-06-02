# PersoFinancIA Fase 1+2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar PersoFinancIA de dos archivos HTML standalone a una app Next.js 14 multi-usuario, mobile-first, con auth real, ingesta automática de emails de 7 bancos vía Supabase Edge Functions, motor de categorización con reglas + Claude, y CRUD completo de movimientos.

**Architecture:** Next.js 14 App Router (frontend + API proxy) + Supabase (Auth, PostgreSQL con RLS, Storage, Edge Functions Deno). Las API keys de Claude y Gmail viven exclusivamente en variables de entorno de las Edge Functions — nunca en el bundle del cliente. La tabla `movimientos` unifica todos los bancos con `banco_id` como FK.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, next-themes, Recharts, Supabase JS v2, Supabase Edge Functions (Deno), next-pwa, Vitest, Playwright

---

## Estructura de archivos

```
persofinancia/
├── app/
│   ├── layout.tsx                        ← Root layout + ThemeProvider + fonts
│   ├── globals.css                        ← Tailwind base + CSS variables de tema
│   ├── (auth)/
│   │   ├── login/page.tsx                 ← Pantalla de login con magic link
│   │   └── register/page.tsx              ← Pantalla de registro
│   ├── (dashboard)/
│   │   ├── layout.tsx                     ← Layout con BottomNav + auth guard
│   │   ├── page.tsx                       ← 🏠 Inicio — KPIs + alertas
│   │   ├── movimientos/
│   │   │   ├── page.tsx                   ← Lista paginada con filtros
│   │   │   └── nuevo/page.tsx             ← Formulario crear movimiento manual
│   │   ├── chat/page.tsx                  ← ✦ Chat IA (placeholder Fase 5)
│   │   ├── analitica/page.tsx             ← 📊 Analítica (placeholder Fase 3)
│   │   └── config/
│   │       ├── page.tsx                   ← Config home — links a subsecciones
│   │       ├── bancos/
│   │       │   ├── page.tsx               ← Lista bancos con toggle + último sync
│   │       │   └── nuevo/page.tsx         ← Formulario agregar banco
│   │       ├── categorias/page.tsx        ← CRUD categorías
│   │       ├── reglas/page.tsx            ← Lista + crear reglas
│   │       ├── importar/page.tsx          ← Upload CSV + previsualización
│   │       └── tema/page.tsx              ← Selector Dark/Light/System
│   └── api/
│       ├── auth/callback/route.ts         ← Supabase OAuth callback
│       └── ingest/route.ts                ← Proxy → Edge Function ingest-emails
├── components/
│   ├── ui/                                ← shadcn/ui (generado con CLI)
│   ├── layout/
│   │   ├── bottom-nav.tsx                 ← 5 tabs: Inicio/Movs/Chat/Analítica/Config
│   │   └── theme-provider.tsx             ← next-themes wrapper
│   ├── movimientos/
│   │   ├── movimiento-item.tsx            ← Ítem de lista con indicadores de origen
│   │   ├── movimiento-drawer.tsx          ← Drawer edición (categoría, desc, monto)
│   │   ├── movimiento-filters.tsx         ← Chips de filtro (todos/ingresos/gastos/deuda)
│   │   └── movimiento-form.tsx            ← Form crear/editar movimiento manual
│   ├── config/
│   │   ├── banco-item.tsx                 ← Banco con toggle activo + último sync
│   │   ├── banco-form.tsx                 ← Form nombre/remitente/query/parser
│   │   ├── regla-item.tsx                 ← Regla con origen manual/IA + toggle
│   │   └── regla-form.tsx                 ← Form campo/operador/valor/categoría
│   └── shared/
│       ├── kpi-card.tsx                   ← Tarjeta KPI con label/valor/delta
│       └── theme-toggle.tsx               ← Botón 3 estados Dark/Light/System
├── lib/
│   ├── supabase/
│   │   ├── client.ts                      ← createBrowserClient (singleton)
│   │   ├── server.ts                      ← createServerClient (cookies RSC)
│   │   └── middleware.ts                  ← refreshSession helper
│   ├── types/
│   │   └── database.ts                    ← Tipos TS de todas las tablas
│   └── utils/
│       ├── currency.ts                    ← fmt(n) → "$15.8M" en COP
│       └── dates.ts                       ← yesterday(), parseColDate()
├── supabase/
│   ├── functions/
│   │   ├── ingest-emails/
│   │   │   ├── index.ts                   ← Handler cron + loop por banco
│   │   │   └── parsers/
│   │   │       ├── types.ts               ← interface ParsedTransaction
│   │   │       ├── bancolombia.ts         ← Parser migrado de Claude Cowork
│   │   │       ├── nequi.ts
│   │   │       ├── rappicard.ts
│   │   │       ├── occidente.ts
│   │   │       ├── lulobank.ts
│   │   │       ├── nu.ts
│   │   │       ├── hapi.ts
│   │   │       └── generic.ts             ← Parser configurable por el usuario
│   │   └── classify-tx/
│   │       └── index.ts                   ← Reglas → Claude fallback → confianza
│   └── migrations/
│       ├── 20260601000001_initial_schema.sql   ← Todas las tablas + RLS
│       └── 20260601000002_migrate_bancolombia.sql ← Migra datos existentes
├── middleware.ts                           ← Next.js middleware — protege rutas /dashboard
├── next.config.ts                          ← Next.js + withPWA
├── public/
│   ├── manifest.json                       ← PWA manifest
│   └── icons/                             ← icon-192.png, icon-512.png
└── package.json
```

---

## Tareas

### Task 1: Scaffolding del proyecto Next.js

**Files:**
- Create: `persofinancia/` (directorio raíz del proyecto)
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`
- Create: `app/globals.css`, `app/layout.tsx`

- [ ] **Step 1.1: Crear el proyecto Next.js 14**

```bash
cd "C:/Users/jvelez/OneDrive - C.I Matec Logística S.A.S/Documentos/Claude/Projects/Fianzas personales"
npx create-next-app@14 persofinancia \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --no-import-alias
cd persofinancia
```

Cuando pregunte sobre el directorio `src/`, responder **No** — usamos `app/` en la raíz.

- [ ] **Step 1.2: Instalar dependencias**

```bash
npm install @supabase/supabase-js @supabase/ssr next-themes next-pwa
npm install recharts
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
npm install -D @playwright/test
```

- [ ] **Step 1.3: Instalar shadcn/ui**

```bash
npx shadcn@latest init
```

Respuestas:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

Luego instalar componentes necesarios:

```bash
npx shadcn@latest add button card input label badge drawer sheet tabs select switch toast
```

- [ ] **Step 1.4: Crear `next.config.ts`**

```typescript
// next.config.ts
import type { NextConfig } from 'next'
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

const nextConfig: NextConfig = {
  // Supabase Storage images
  images: {
    domains: ['hgvgjwvwiycuxcebqfvx.supabase.co'],
  },
}

module.exports = withPWA(nextConfig)
```

- [ ] **Step 1.5: Crear variables de entorno**

```bash
# .env.local (NUNCA commitear)
NEXT_PUBLIC_SUPABASE_URL=https://hgvgjwvwiycuxcebqfvx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key_de_supabase_dashboard>
```

```bash
# .env.example (sí commitear)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

```bash
echo ".env.local" >> .gitignore
echo ".env*.local" >> .gitignore
```

- [ ] **Step 1.6: Crear `app/globals.css` con variables de tema**

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --border: 214.3 31.8% 91.4%;
    --income: 142 71% 45%;
    --expense: 0 72% 51%;
    --debt: 221 83% 53%;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 47.4% 11.2%;
    --card-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --border: 217.2 32.6% 17.5%;
    --income: 142 71% 45%;
    --expense: 0 72% 51%;
    --debt: 217 91% 60%;
  }
}
```

- [ ] **Step 1.7: Crear `app/layout.tsx`**

```typescript
// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/layout/theme-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PersoFinancIA',
  description: 'Tu herramienta de análisis financiero personal',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'PersoFinancIA' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 1.8: Commit inicial**

```bash
git add -A
git commit -m "chore: scaffold Next.js 14 project with Tailwind, shadcn/ui, PWA"
```

---

### Task 2: Clientes de Supabase y tipos TypeScript

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `lib/types/database.ts`
- Create: `lib/utils/currency.ts`
- Create: `lib/utils/dates.ts`

- [ ] **Step 2.1: Crear cliente browser**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}
```

- [ ] **Step 2.2: Crear cliente server (RSC + Server Actions)**

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database'

export async function getSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 2.3: Crear helper middleware**

```typescript
// lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirigir a login si no autenticado y ruta es /dashboard
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirigir a dashboard si ya autenticado y visita /login o /register
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}
```

- [ ] **Step 2.4: Crear `middleware.ts` en la raíz**

```typescript
// middleware.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
}
```

- [ ] **Step 2.5: Crear tipos de base de datos**

```typescript
// lib/types/database.ts
export type FlowType = 'in' | 'out'
export type ThemeType = 'dark' | 'light' | 'system'
export type MovimientoOrigen = 'email' | 'csv' | 'manual'
export type ReglaOrigen = 'manual' | 'ai_suggestion'
export type ReglaOperador = 'contains' | 'starts_with' | 'equals' | 'gt' | 'lt'
export type ReglaCampo = 'descripcion' | 'monto' | 'tipo' | 'banco'

export interface Profile {
  user_id: string
  nombre: string
  email: string
  tema: ThemeType
  gmail_token: string | null
  created_at: string
}

export interface Banco {
  id: string
  user_id: string
  nombre: string
  icono: string
  gmail_query: string
  parser_type: string
  parser_config: Record<string, unknown>
  activo: boolean
  ultimo_sync: string | null
  created_at: string
}

export interface Movimiento {
  id: string
  user_id: string
  banco_id: string | null
  fecha: string           // YYYY-MM-DD
  hora: string            // HH:MM
  tipo: string
  flujo: FlowType
  monto: number
  descripcion: string
  categoria: string | null
  categoria_manual: boolean
  regla_aplicada: string | null
  confianza_ia: number | null
  origen: MovimientoOrigen
  cuenta: string | null
  raw: string | null
  created_at: string
}

export interface Categoria {
  id: string
  user_id: string
  nombre: string
  grupo: string
  subgrupo: string
  icono: string
  color: string
}

export interface ReglaCategoria {
  id: string
  user_id: string
  categoria_id: string
  campo: ReglaCategoria
  operador: ReglaOperador
  valor: string
  prioridad: number
  activa: boolean
  origen: ReglaOrigen
  aplicaciones: number
  created_at: string
}

export interface Alerta {
  id: string
  user_id: string
  tipo: 'critica' | 'advertencia' | 'sugerencia'
  titulo: string
  mensaje: string
  leida: boolean
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at'>; Update: Partial<Profile> }
      bancos: { Row: Banco; Insert: Omit<Banco, 'id' | 'created_at'>; Update: Partial<Banco> }
      movimientos: { Row: Movimiento; Insert: Omit<Movimiento, 'created_at'>; Update: Partial<Movimiento> }
      categorias: { Row: Categoria; Insert: Omit<Categoria, 'id'>; Update: Partial<Categoria> }
      reglas_categoria: { Row: ReglaCategoria; Insert: Omit<ReglaCategoria, 'id' | 'aplicaciones' | 'created_at'>; Update: Partial<ReglaCategoria> }
      alertas: { Row: Alerta; Insert: Omit<Alerta, 'id' | 'created_at'>; Update: Partial<Alerta> }
    }
  }
}
```

- [ ] **Step 2.6: Crear utilidades de formato**

```typescript
// lib/utils/currency.ts
const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export function fmt(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return COP.format(amount)
}

export function fmtFull(amount: number): string {
  return COP.format(amount)
}
```

```typescript
// lib/utils/dates.ts
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

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
```

- [ ] **Step 2.7: Commit**

```bash
git add -A
git commit -m "feat: add Supabase clients, TypeScript types, currency/date utils"
```

---

### Task 3: Migraciones de base de datos

**Files:**
- Create: `supabase/migrations/20260601000001_initial_schema.sql`
- Create: `supabase/migrations/20260601000002_migrate_bancolombia.sql`

- [ ] **Step 3.1: Instalar Supabase CLI**

```bash
npm install -g supabase
supabase login
supabase link --project-ref hgvgjwvwiycuxcebqfvx
```

- [ ] **Step 3.2: Crear migración inicial con todas las tablas**

```sql
-- supabase/migrations/20260601000001_initial_schema.sql

-- ──────────────────────────────────────────
-- PROFILES
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre    TEXT NOT NULL DEFAULT '',
  email     TEXT NOT NULL DEFAULT '',
  tema      TEXT NOT NULL DEFAULT 'system' CHECK (tema IN ('dark','light','system')),
  gmail_token TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles FOR ALL USING (auth.uid() = user_id);

-- Auto-crear profile al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, nombre)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email,'@',1)));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────
-- BANCOS
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bancos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,
  icono        TEXT NOT NULL DEFAULT '🏦',
  gmail_query  TEXT NOT NULL DEFAULT '',
  parser_type  TEXT NOT NULL DEFAULT 'generic',
  parser_config JSONB NOT NULL DEFAULT '{}',
  activo       BOOLEAN NOT NULL DEFAULT false,
  ultimo_sync  TIMESTAMPTZ DEFAULT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bancos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bancos_own" ON public.bancos FOR ALL USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- CATEGORIAS
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categorias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  grupo      TEXT NOT NULL DEFAULT 'Variable',
  subgrupo   TEXT NOT NULL DEFAULT '',
  icono      TEXT NOT NULL DEFAULT '📌',
  color      TEXT NOT NULL DEFAULT '#64748b'
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categorias_own" ON public.categorias FOR ALL USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- MOVIMIENTOS
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.movimientos (
  id                TEXT PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  banco_id          UUID REFERENCES public.bancos(id) ON DELETE SET NULL,
  fecha             DATE NOT NULL,
  hora              TEXT NOT NULL DEFAULT '00:00',
  tipo              TEXT NOT NULL,
  flujo             TEXT NOT NULL CHECK (flujo IN ('in','out')),
  monto             NUMERIC(15,2) NOT NULL CHECK (monto >= 0),
  descripcion       TEXT NOT NULL DEFAULT '',
  categoria         TEXT DEFAULT NULL,
  categoria_manual  BOOLEAN NOT NULL DEFAULT false,
  regla_aplicada    UUID REFERENCES public.reglas_categoria(id) ON DELETE SET NULL,
  confianza_ia      NUMERIC(5,2) DEFAULT NULL,
  origen            TEXT NOT NULL DEFAULT 'email' CHECK (origen IN ('email','csv','manual')),
  cuenta            TEXT DEFAULT NULL,
  raw               TEXT DEFAULT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movimientos_user_fecha ON public.movimientos(user_id, fecha DESC);
CREATE INDEX idx_movimientos_user_flujo ON public.movimientos(user_id, flujo);
CREATE INDEX idx_movimientos_user_categoria ON public.movimientos(user_id, categoria);

ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movimientos_own" ON public.movimientos FOR ALL USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- REGLAS_CATEGORIA
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reglas_categoria (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  campo        TEXT NOT NULL CHECK (campo IN ('descripcion','monto','tipo','banco')),
  operador     TEXT NOT NULL CHECK (operador IN ('contains','starts_with','equals','gt','lt')),
  valor        TEXT NOT NULL,
  prioridad    INTEGER NOT NULL DEFAULT 100,
  activa       BOOLEAN NOT NULL DEFAULT true,
  origen       TEXT NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual','ai_suggestion')),
  aplicaciones INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reglas_categoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reglas_own" ON public.reglas_categoria FOR ALL USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- ALERTAS
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alertas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('critica','advertencia','sugerencia')),
  titulo     TEXT NOT NULL,
  mensaje    TEXT NOT NULL,
  leida      BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alertas_own" ON public.alertas FOR ALL USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- STORAGE bucket para CSV
-- ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('csv-imports', 'csv-imports', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "csv_own_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'csv-imports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "csv_own_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'csv-imports' AND auth.uid()::text = (storage.foldername(name))[1]);
```

- [ ] **Step 3.3: Crear migración de datos de Bancolombia**

```sql
-- supabase/migrations/20260601000002_migrate_bancolombia.sql
-- NOTA: Ejecutar DESPUÉS de que el usuario de producción (Juan Camilo) esté registrado
-- Reemplaza :JUAN_USER_ID con el UUID real del usuario

-- 1. Insertar banco Bancolombia para el usuario
INSERT INTO public.bancos (id, user_id, nombre, icono, gmail_query, parser_type, activo)
VALUES (
  'bc0000-0000-0000-0000-bancolombia01',
  :'JUAN_USER_ID',
  'Bancolombia',
  '🏦',
  'from:(notificacionesbancolombia.com OR bancolombia.com.co)',
  'bancolombia',
  true
) ON CONFLICT DO NOTHING;

-- 2. Migrar movimientos existentes
INSERT INTO public.movimientos (id, user_id, banco_id, fecha, hora, tipo, flujo, monto, descripcion, categoria, origen, cuenta, raw)
SELECT
  id,
  :'JUAN_USER_ID',
  'bc0000-0000-0000-0000-bancolombia01',
  fecha,
  COALESCE(hora, '00:00'),
  tipo,
  flujo,
  monto,
  descripcion,
  categoria,
  'email',
  cuenta,
  raw
FROM public.bancolombia_movimientos
ON CONFLICT (id) DO NOTHING;

-- 3. Verificar
SELECT
  COUNT(*) AS total_migrados,
  SUM(monto) FILTER (WHERE flujo = 'out') AS egresos,
  SUM(monto) FILTER (WHERE flujo = 'in') AS ingresos
FROM public.movimientos
WHERE user_id = :'JUAN_USER_ID';
```

- [ ] **Step 3.4: Aplicar migración inicial**

```bash
supabase db push
```

Salida esperada:
```
Applying migration 20260601000001_initial_schema.sql...
Applied 1 migration.
```

- [ ] **Step 3.5: Commit**

```bash
git add supabase/
git commit -m "feat: add database migrations — all tables, RLS policies, Bancolombia migration script"
```

---

### Task 4: Autenticación — Login y Registro

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`
- Create: `app/api/auth/callback/route.ts`

- [ ] **Step 4.1: Crear API route del callback OAuth**

```typescript
// app/api/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await getSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
```

- [ ] **Step 4.2: Crear pantalla de login**

```typescript
// app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { toast } = useToast()
  const supabase = getSupabaseBrowserClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/api/auth/callback` },
    })
    setLoading(false)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Revisa tu correo ✉️</CardTitle>
            <CardDescription>Enviamos un link de acceso a <strong>{email}</strong></CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">PersoFinancIA</CardTitle>
          <CardDescription>Ingresa tu email para recibir un link de acceso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link de acceso'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4.3: Crear pantalla de registro**

```typescript
// app/(auth)/register/page.tsx
'use client'
import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function RegisterPage() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = getSupabaseBrowserClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/api/auth/callback`,
        data: { nombre },
      },
    })
    setLoading(false)
    if (!error) setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>¡Listo, {nombre}! ✅</CardTitle>
            <CardDescription>Revisa tu email para activar tu cuenta.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Crear cuenta</CardTitle>
          <CardDescription>Empieza a controlar tus finanzas personales</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" placeholder="Juan Camilo" value={nombre} onChange={e => setNombre(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4.4: Probar auth manualmente**

```bash
npm run dev
```

1. Ir a `http://localhost:3000/login`
2. Ingresar email real → verificar que llega el magic link
3. Hacer clic en el link → verificar redirección a `/`
4. Verificar en Supabase Dashboard → Authentication → Users que el usuario fue creado
5. Verificar en Table Editor → profiles que se creó el perfil automáticamente

- [ ] **Step 4.5: Commit**

```bash
git add -A
git commit -m "feat: add magic link auth — login, register, OAuth callback"
```

---

### Task 5: Tema Dark/Light/System

**Files:**
- Create: `components/layout/theme-provider.tsx`
- Create: `components/shared/theme-toggle.tsx`
- Create: `app/(dashboard)/config/tema/page.tsx`

- [ ] **Step 5.1: Crear ThemeProvider**

```typescript
// components/layout/theme-provider.tsx
'use client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

- [ ] **Step 5.2: Crear ThemeToggle con 3 estados**

```typescript
// components/shared/theme-toggle.tsx
'use client'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'

const OPTIONS = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark',  label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <div className="flex gap-2">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          variant={theme === value ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTheme(value)}
          className="flex-1"
        >
          <Icon className="h-4 w-4 mr-1" />
          {label}
        </Button>
      ))}
    </div>
  )
}
```

- [ ] **Step 5.3: Crear pagina de tema en Config**

```typescript
// app/(dashboard)/config/tema/page.tsx
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function TemaPage() {
  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Apariencia</h1>
      <Card>
        <CardHeader>
          <CardTitle>Tema de color</CardTitle>
          <CardDescription>Elige como quieres ver la app</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5.4: Verificar**

```bash
npm run dev
```

Ir a `http://localhost:3000/config/tema`. Verificar que los 3 botones cambian el tema y que persiste al recargar.

- [ ] **Step 5.5: Commit**

```bash
git add -A
git commit -m "feat: add dark/light/system theme with next-themes"
```

---

### Task 6: Layout con BottomNav

**Files:**
- Create: `components/layout/bottom-nav.tsx`
- Create: `app/(dashboard)/layout.tsx`
- Create: `app/(dashboard)/chat/page.tsx`
- Create: `app/(dashboard)/analitica/page.tsx`

- [ ] **Step 6.1: Crear BottomNav**

```typescript
// components/layout/bottom-nav.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, List, Sparkles, BarChart2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/',            label: 'Inicio',   icon: Home },
  { href: '/movimientos', label: 'Movs',     icon: List },
  { href: '/chat',        label: 'Chat IA',  icon: Sparkles },
  { href: '/analitica',   label: 'Analisis', icon: BarChart2 },
  { href: '/config',      label: 'Config',   icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 6.2: Crear layout del dashboard con auth guard**

```typescript
// app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/layout/bottom-nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-20 max-w-lg mx-auto">{children}</main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 6.3: Crear placeholders para Chat y Analitica**

```typescript
// app/(dashboard)/chat/page.tsx
export default function ChatPage() {
  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <p className="text-4xl mb-3">✦</p>
      <h1 className="text-xl font-bold">Chat IA</h1>
      <p className="text-muted-foreground mt-2">Disponible en Fase 5</p>
    </div>
  )
}
```

```typescript
// app/(dashboard)/analitica/page.tsx
export default function AnaliticaPage() {
  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <p className="text-4xl mb-3">📊</p>
      <h1 className="text-xl font-bold">Analitica</h1>
      <p className="text-muted-foreground mt-2">Disponible en Fase 3</p>
    </div>
  )
}
```

- [ ] **Step 6.4: Verificar navegacion**

```bash
npm run dev
```

1. Sin auth: `http://localhost:3000` redirige a `/login`
2. Con auth: BottomNav visible, los 5 tabs navegan correctamente
3. Tab activo se ve resaltado en azul

- [ ] **Step 6.5: Commit**

```bash
git add -A
git commit -m "feat: add BottomNav layout with 5 tabs and server-side auth guard"
```

---

### Task 7: Pantalla Inicio con KPIs

**Files:**
- Create: `components/shared/kpi-card.tsx`
- Create: `app/(dashboard)/page.tsx`

- [ ] **Step 7.1: Crear KpiCard**

```typescript
// components/shared/kpi-card.tsx
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string
  positive?: boolean
  highlight?: boolean
}

export function KpiCard({ label, value, positive, highlight }: KpiCardProps) {
  return (
    <div className={cn(
      'bg-card rounded-xl p-4 border',
      highlight && positive ? 'border-green-500/30' : '',
      highlight && positive === false ? 'border-red-500/30' : '',
      !highlight ? 'border-border' : ''
    )}>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn(
        'text-2xl font-bold mt-1',
        positive === true ? 'text-green-500' : '',
        positive === false ? 'text-red-500' : ''
      )}>{value}</p>
    </div>
  )
}
```

- [ ] **Step 7.2: Crear pagina Inicio**

```typescript
// app/(dashboard)/page.tsx
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { KpiCard } from '@/components/shared/kpi-card'
import { fmt } from '@/lib/utils/currency'
import { currentMonth } from '@/lib/utils/dates'

async function getKpis(userId: string) {
  const supabase = await getSupabaseServerClient()
  const month = currentMonth()
  const { data } = await supabase
    .from('movimientos')
    .select('flujo, monto')
    .eq('user_id', userId)
    .gte('fecha', `${month}-01`)
    .lte('fecha', `${month}-31`)

  const movs = data ?? []
  const ingresos = movs.filter(m => m.flujo === 'in').reduce((s, m) => s + Number(m.monto), 0)
  const gastos   = movs.filter(m => m.flujo === 'out').reduce((s, m) => s + Number(m.monto), 0)
  const balance  = ingresos - gastos
  const ahorro   = ingresos > 0 ? ((balance / ingresos) * 100).toFixed(1) : '0'
  return { ingresos, gastos, balance, ahorro }
}

export default async function InicioPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles').select('nombre').eq('user_id', user.id).single()

  const kpis = await getKpis(user.id)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos dias' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h1 className="text-xl font-bold">{greeting}, {profile?.nombre?.split(' ')[0]} </h1>
        <p className="text-muted-foreground text-sm">Resumen del mes actual</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Ingresos" value={fmt(kpis.ingresos)} positive={true} />
        <KpiCard label="Gastos"   value={fmt(kpis.gastos)}   positive={false} />
        <KpiCard label="Balance"  value={fmt(kpis.balance)}  positive={kpis.balance >= 0} highlight />
        <KpiCard label="Ahorro"   value={`${kpis.ahorro}%`}  positive={Number(kpis.ahorro) >= 0} />
      </div>
    </div>
  )
}
```

- [ ] **Step 7.3: Verificar KPIs en browser**

Ir a `http://localhost:3000`. Con datos migrados de Bancolombia los KPIs deben mostrar valores reales. Verificar formato: `$15.8M`, `$526K`.

- [ ] **Step 7.4: Commit**

```bash
git add -A
git commit -m "feat: add Inicio page with live KPI cards"
```

---

### Task 8: Movimientos — Lista con filtros

**Files:**
- Create: `components/movimientos/movimiento-item.tsx`
- Create: `components/movimientos/movimiento-filters.tsx`
- Create: `app/(dashboard)/movimientos/page.tsx`

- [ ] **Step 8.1: Crear MovimientoItem**

```typescript
// components/movimientos/movimiento-item.tsx
import { cn } from '@/lib/utils'
import { fmt } from '@/lib/utils/currency'
import { fmtDate } from '@/lib/utils/dates'
import type { Movimiento } from '@/lib/types/database'

interface MovimientoItemProps {
  movimiento: Movimiento
  onClick?: () => void
}

export function MovimientoItem({ movimiento, onClick }: MovimientoItemProps) {
  const isIn = movimiento.flujo === 'in'
  const sinCategoria = !movimiento.categoria
  const isManual = movimiento.origen === 'manual'

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-card rounded-xl border border-border hover:bg-muted/50 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{movimiento.descripcion}</p>
          {isManual && (
            <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0 bg-purple-500/10 text-purple-500">
              Manual
            </span>
          )}
        </div>
        <p className={cn('text-xs mt-0.5', sinCategoria ? 'text-yellow-500' : 'text-muted-foreground')}>
          {sinCategoria ? 'Sin categoria' : movimiento.categoria}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn('font-semibold text-sm', isIn ? 'text-green-500' : 'text-red-500')}>
          {isIn ? '+' : '-'}{fmt(movimiento.monto)}
        </p>
        <p className="text-xs text-muted-foreground">{fmtDate(movimiento.fecha)}</p>
      </div>
    </button>
  )
}
```

- [ ] **Step 8.2: Crear MovimientoFilters**

```typescript
// components/movimientos/movimiento-filters.tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const FILTERS = [
  { key: 'todos',    label: 'Todos' },
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'gastos',   label: 'Gastos' },
  { key: 'deuda',    label: 'Deuda' },
]

export function MovimientoFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const active = searchParams.get('flujo') ?? 'todos'

  function setFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (key === 'todos') params.delete('flujo')
    else params.set('flujo', key)
    router.push(`/movimientos?${params.toString()}`)
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setFilter(key)}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            active === key
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 8.3: Crear pagina de Movimientos**

```typescript
// app/(dashboard)/movimientos/page.tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { MovimientoItem } from '@/components/movimientos/movimiento-item'
import { MovimientoFilters } from '@/components/movimientos/movimiento-filters'

interface PageProps {
  searchParams: { flujo?: string }
}

async function MovimientosList({ flujo, userId }: { flujo?: string; userId: string }) {
  const supabase = await getSupabaseServerClient()
  let query = supabase
    .from('movimientos')
    .select('*')
    .eq('user_id', userId)
    .order('fecha', { ascending: false })
    .limit(50)

  if (flujo === 'ingresos') query = query.eq('flujo', 'in')
  if (flujo === 'gastos')   query = query.eq('flujo', 'out')
  if (flujo === 'deuda')    query = query.eq('categoria', 'Deuda')

  const { data: movimientos } = await query

  if (!movimientos?.length) {
    return <p className="text-center text-muted-foreground py-12">Sin movimientos</p>
  }

  return (
    <div className="space-y-2">
      {movimientos.map(m => <MovimientoItem key={m.id} movimiento={m as any} />)}
    </div>
  )
}

export default async function MovimientosPage({ searchParams }: PageProps) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-4">
        <h1 className="text-xl font-bold">Movimientos</h1>
        <Link
          href="/movimientos/nuevo"
          className="flex items-center gap-1 bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Nuevo
        </Link>
      </div>
      <MovimientoFilters />
      <Suspense fallback={<p className="text-muted-foreground text-sm">Cargando...</p>}>
        <MovimientosList flujo={searchParams.flujo} userId={user.id} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 8.4: Verificar lista**

```bash
npm run dev
```

1. Ir a `/movimientos` — debe mostrar movimientos migrados de Bancolombia
2. Probar filtros Ingresos / Gastos / Deuda
3. Verificar formato de montos y fechas
4. Verificar indicador amarillo "Sin categoria" para movimientos sin categoria

- [ ] **Step 8.5: Commit**

```bash
git add -A
git commit -m "feat: add Movimientos list with filters and origin indicators"
```

---

### Task 9: Movimientos — CRUD (Crear, Editar, Eliminar)

**Files:**
- Create: `components/movimientos/movimiento-form.tsx`
- Create: `components/movimientos/movimiento-drawer.tsx`
- Create: `app/(dashboard)/movimientos/nuevo/page.tsx`
- Modify: `app/(dashboard)/movimientos/page.tsx`

- [ ] **Step 9.1: Crear formulario de movimiento manual**

```typescript
// components/movimientos/movimiento-form.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Movimiento } from '@/lib/types/database'

interface MovimientoFormProps {
  userId: string
  categorias: Array<{ id: string; nombre: string }>
  onSuccess?: () => void
}

export function MovimientoForm({ userId, categorias, onSuccess }: MovimientoFormProps) {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    descripcion: '',
    monto: '',
    flujo: 'out' as 'in' | 'out',
    categoria: '',
    cuenta: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.descripcion || !form.monto) return
    setLoading(true)

    const { error } = await supabase.from('movimientos').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      banco_id: null,
      fecha: form.fecha,
      hora: new Date().toTimeString().slice(0, 5),
      tipo: form.flujo === 'in' ? 'Ingreso' : 'Gasto',
      flujo: form.flujo,
      monto: parseFloat(form.monto),
      descripcion: form.descripcion.toUpperCase(),
      categoria: form.categoria || null,
      categoria_manual: !!form.categoria,
      origen: 'manual',
      cuenta: form.cuenta || null,
    })

    setLoading(false)
    if (!error) {
      router.push('/movimientos')
      router.refresh()
      onSuccess?.()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={form.flujo} onValueChange={v => setForm(f => ({ ...f, flujo: v as 'in' | 'out' }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="out">Gasto (salida)</SelectItem>
              <SelectItem value="in">Ingreso (entrada)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Fecha</Label>
          <Input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Descripcion</Label>
        <Input placeholder="RAPPI, Mercado, Nomina..." value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} required />
      </div>

      <div className="space-y-1.5">
        <Label>Monto (COP)</Label>
        <Input type="number" placeholder="35000" min="0" step="100" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} required />
      </div>

      <div className="space-y-1.5">
        <Label>Categoria</Label>
        <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
          <SelectTrigger><SelectValue placeholder="Sin categoria" /></SelectTrigger>
          <SelectContent>
            {categorias.map(c => <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Guardando...' : 'Guardar movimiento'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 9.2: Crear pagina Nuevo Movimiento**

```typescript
// app/(dashboard)/movimientos/nuevo/page.tsx
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { MovimientoForm } from '@/components/movimientos/movimiento-form'

export default async function NuevoMovimientoPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, nombre')
    .eq('user_id', user.id)
    .order('nombre')

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4 pt-4">Nuevo movimiento</h1>
      <MovimientoForm userId={user.id} categorias={categorias ?? []} />
    </div>
  )
}
```

- [ ] **Step 9.3: Crear drawer de edicion de categoria**

```typescript
// components/movimientos/movimiento-drawer.tsx
'use client'
import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fmt } from '@/lib/utils/currency'
import type { Movimiento } from '@/lib/types/database'

interface MovimientoDrawerProps {
  movimiento: Movimiento | null
  categorias: Array<{ id: string; nombre: string }>
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function MovimientoDrawer({ movimiento, categorias, open, onClose, onSaved }: MovimientoDrawerProps) {
  const supabase = getSupabaseBrowserClient()
  const [categoria, setCategoria] = useState(movimiento?.categoria ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function saveCategoria() {
    if (!movimiento) return
    setSaving(true)
    await supabase
      .from('movimientos')
      .update({ categoria, categoria_manual: true })
      .eq('id', movimiento.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  async function deleteMovimiento() {
    if (!movimiento || movimiento.origen === 'email') return
    setDeleting(true)
    await supabase.from('movimientos').delete().eq('id', movimiento.id)
    setDeleting(false)
    onSaved()
    onClose()
  }

  if (!movimiento) return null

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">{movimiento.descripcion}</SheetTitle>
          <p className={movimiento.flujo === 'in' ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>
            {movimiento.flujo === 'in' ? '+' : '-'}{fmt(movimiento.monto)}
          </p>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Categoria</p>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue placeholder="Sin categoria" /></SelectTrigger>
              <SelectContent>
                {categorias.map(c => <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={saveCategoria} disabled={saving} className="w-full">
            {saving ? 'Guardando...' : 'Guardar categoria'}
          </Button>

          {movimiento.origen !== 'email' && (
            <Button
              variant="destructive"
              onClick={deleteMovimiento}
              disabled={deleting}
              className="w-full"
            >
              {deleting ? 'Eliminando...' : 'Eliminar movimiento'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 9.4: Conectar drawer a la lista de movimientos**

Modificar `app/(dashboard)/movimientos/page.tsx` — agregar la parte client que maneja el drawer. Crear un componente client wrapper:

```typescript
// components/movimientos/movimientos-list-client.tsx
'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MovimientoItem } from './movimiento-item'
import { MovimientoDrawer } from './movimiento-drawer'
import type { Movimiento, Categoria } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
}

export function MovimientosListClient({ movimientos, categorias }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Movimiento | null>(null)
  const [, startTransition] = useTransition()

  function onSaved() {
    startTransition(() => router.refresh())
  }

  return (
    <>
      <div className="space-y-2">
        {movimientos.map(m => (
          <MovimientoItem key={m.id} movimiento={m} onClick={() => setSelected(m)} />
        ))}
      </div>
      <MovimientoDrawer
        movimiento={selected}
        categorias={categorias}
        open={!!selected}
        onClose={() => setSelected(null)}
        onSaved={onSaved}
      />
    </>
  )
}
```

- [ ] **Step 9.5: Verificar CRUD**

```bash
npm run dev
```

1. Ir a `/movimientos/nuevo` — crear un movimiento manual con monto y descripcion
2. Verificar que aparece en la lista con badge "Manual" en morado
3. Tocar un movimiento — verificar que se abre el drawer
4. Cambiar la categoria y guardar — verificar que se actualiza
5. Tocar un movimiento manual en el drawer — verificar que aparece "Eliminar"
6. Tocar un movimiento de email — verificar que NO aparece "Eliminar"

- [ ] **Step 9.6: Commit**

```bash
git add -A
git commit -m "feat: add Movimientos CRUD — create manual, edit category, delete manual"
```

---

### Task 10: Config — Categorias

**Files:**
- Create: `app/(dashboard)/config/categorias/page.tsx`

- [ ] **Step 10.1: Crear pagina CRUD de categorias**

```typescript
// app/(dashboard)/config/categorias/page.tsx
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

async function createCategoria(formData: FormData) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('categorias').insert({
    user_id: user.id,
    nombre: String(formData.get('nombre')),
    grupo: String(formData.get('grupo') || 'Variable'),
    icono: String(formData.get('icono') || '📌'),
    color: String(formData.get('color') || '#64748b'),
  })
  revalidatePath('/config/categorias')
}

async function deleteCategoria(id: string) {
  'use server'
  const supabase = await getSupabaseServerClient()
  await supabase.from('categorias').delete().eq('id', id)
  revalidatePath('/config/categorias')
}

export default async function CategoriasPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: categorias } = await supabase
    .from('categorias')
    .select('*')
    .eq('user_id', user.id)
    .order('nombre')

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold pt-4">Categorias</h1>

      <form action={createCategoria} className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="font-semibold text-sm">Nueva categoria</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input name="nombre" placeholder="Domicilios" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Grupo</Label>
            <Input name="grupo" placeholder="Variable" defaultValue="Variable" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Icono</Label>
            <Input name="icono" placeholder="🍕" defaultValue="📌" maxLength={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Color</Label>
            <Input name="color" type="color" defaultValue="#64748b" />
          </div>
        </div>
        <Button type="submit" size="sm" className="w-full">Crear</Button>
      </form>

      <div className="space-y-2">
        {categorias?.map(cat => (
          <div key={cat.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
            <span className="text-xl">{cat.icono}</span>
            <div className="flex-1">
              <p className="font-medium text-sm">{cat.nombre}</p>
              <p className="text-xs text-muted-foreground">{cat.grupo}</p>
            </div>
            <form action={deleteCategoria.bind(null, cat.id)}>
              <Button type="submit" variant="ghost" size="sm" className="text-destructive">Borrar</Button>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 10.2: Verificar CRUD de categorias**

```bash
npm run dev
```

1. Ir a `/config/categorias`
2. Crear categoria "Domicilios" con icono "🍕" — verificar que aparece
3. Borrar una categoria — verificar que desaparece
4. Crear categoria con nombre duplicado — no debe dar error (SQL lo permite para diferentes usuarios)

- [ ] **Step 10.3: Commit**

```bash
git add -A
git commit -m "feat: add Categorias CRUD with Server Actions"
```

---

### Task 11: Config — Reglas de categorizacion

**Files:**
- Create: `components/config/regla-item.tsx`
- Create: `app/(dashboard)/config/reglas/page.tsx`

- [ ] **Step 11.1: Crear ReglaItem**

```typescript
// components/config/regla-item.tsx
'use client'
import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { ReglaCategoria } from '@/lib/types/database'

interface ReglaItemProps {
  regla: ReglaCategoria & { categorias: { nombre: string } | null }
  onChanged: () => void
}

export function ReglaItem({ regla, onChanged }: ReglaItemProps) {
  const supabase = getSupabaseBrowserClient()
  const [activa, setActiva] = useState(regla.activa)

  async function toggleActiva(value: boolean) {
    setActiva(value)
    await supabase.from('reglas_categoria').update({ activa: value }).eq('id', regla.id)
    onChanged()
  }

  const OPERADOR_LABEL: Record<string, string> = {
    contains: 'contiene',
    starts_with: 'empieza con',
    equals: 'es igual a',
    gt: 'mayor que',
    lt: 'menor que',
  }

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={regla.origen === 'manual' ? 'default' : 'secondary'} className="text-xs">
            {regla.origen === 'manual' ? 'Manual' : 'Sugerida IA'}
          </Badge>
          <span className="text-xs text-muted-foreground">#{regla.prioridad}</span>
        </div>
        <Switch checked={activa} onCheckedChange={toggleActiva} />
      </div>
      <p className="text-sm">
        Si <span className="font-medium">{regla.campo}</span>{' '}
        {OPERADOR_LABEL[regla.operador]}{' '}
        <span className="font-medium text-primary">"{regla.valor}"</span>
      </p>
      <p className="text-xs text-green-500">Categoria: {regla.categorias?.nombre ?? 'N/A'}</p>
    </div>
  )
}
```

- [ ] **Step 11.2: Crear pagina de Reglas**

```typescript
// app/(dashboard)/config/reglas/page.tsx
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

async function createRegla(formData: FormData) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('reglas_categoria').insert({
    user_id: user.id,
    categoria_id: String(formData.get('categoria_id')),
    campo: String(formData.get('campo')),
    operador: String(formData.get('operador')),
    valor: String(formData.get('valor')).toUpperCase(),
    prioridad: parseInt(String(formData.get('prioridad') || '100')),
    origen: 'manual',
  })
  revalidatePath('/config/reglas')
}

export default async function ReglasPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: reglas }, { data: categorias }] = await Promise.all([
    supabase
      .from('reglas_categoria')
      .select('*, categorias(nombre)')
      .eq('user_id', user.id)
      .order('prioridad'),
    supabase
      .from('categorias')
      .select('id, nombre')
      .eq('user_id', user.id)
      .order('nombre'),
  ])

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold pt-4">Reglas de categorizacion</h1>

      <form action={createRegla} className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="font-semibold text-sm">Nueva regla</p>
        <div className="space-y-2">
          <Select name="campo" required>
            <SelectTrigger><SelectValue placeholder="Campo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="descripcion">Descripcion</SelectItem>
              <SelectItem value="monto">Monto</SelectItem>
              <SelectItem value="tipo">Tipo</SelectItem>
            </SelectContent>
          </Select>
          <Select name="operador" required>
            <SelectTrigger><SelectValue placeholder="Operador" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="contains">contiene</SelectItem>
              <SelectItem value="starts_with">empieza con</SelectItem>
              <SelectItem value="equals">es igual a</SelectItem>
              <SelectItem value="gt">mayor que</SelectItem>
              <SelectItem value="lt">menor que</SelectItem>
            </SelectContent>
          </Select>
          <Input name="valor" placeholder='Valor (ej: "RAPPI")' required />
          <Select name="categoria_id" required>
            <SelectTrigger><SelectValue placeholder="Categoria destino" /></SelectTrigger>
            <SelectContent>
              {categorias?.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input name="prioridad" type="number" placeholder="Prioridad (1=mayor)" defaultValue="100" min="1" />
        </div>
        <Button type="submit" size="sm" className="w-full">Crear regla</Button>
      </form>

      <div className="space-y-2">
        {reglas?.map(r => (
          <div key={r.id} className="bg-card border border-border rounded-xl p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm">
                  Si <strong>{r.campo}</strong> contiene <strong className="text-primary">"{r.valor}"</strong>
                </p>
                <p className="text-xs text-green-500 mt-1">
                  Categoria: {(r as any).categorias?.nombre ?? 'N/A'}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">#{r.prioridad}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 11.3: Verificar reglas**

```bash
npm run dev
```

1. Ir a `/config/reglas`
2. Crear regla: campo=descripcion, operador=contains, valor=RAPPI, categoria=Domicilios/Comida, prioridad=10
3. Verificar que aparece en la lista con prioridad #10
4. Crear segunda regla con prioridad 5 — verificar que aparece antes en la lista

- [ ] **Step 11.4: Commit**

```bash
git add -A
git commit -m "feat: add Reglas CRUD for categorization rules"
```

---

### Task 12: Config home + PWA manifest

**Files:**
- Create: `app/(dashboard)/config/page.tsx`
- Create: `public/manifest.json`
- Create: `public/icons/icon-192.png` (ver instruccion abajo)
- Create: `public/icons/icon-512.png`

- [ ] **Step 12.1: Crear Config home**

```typescript
// app/(dashboard)/config/page.tsx
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/server'

const CONFIG_LINKS = [
  { href: '/config/bancos',     label: 'Bancos conectados',      desc: 'Gestiona tus fuentes de datos' },
  { href: '/config/categorias', label: 'Categorias',              desc: 'Crea y edita tus categorias' },
  { href: '/config/reglas',     label: 'Reglas automaticas',      desc: 'Define reglas de categorizacion' },
  { href: '/config/importar',   label: 'Importar CSV',            desc: 'Sube extractos bancarios' },
  { href: '/config/tema',       label: 'Apariencia',              desc: 'Claro, oscuro o sistema' },
]

export default async function ConfigPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('nombre, email').eq('user_id', user!.id).single()

  return (
    <div className="p-4 space-y-6">
      <div className="pt-4">
        <h1 className="text-xl font-bold">Configuracion</h1>
        <p className="text-muted-foreground text-sm mt-1">{profile?.nombre} · {profile?.email}</p>
      </div>

      <div className="space-y-2">
        {CONFIG_LINKS.map(({ href, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1">
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <form action={async () => {
        'use server'
        const s = await getSupabaseServerClient()
        await s.auth.signOut()
      }}>
        <button type="submit" className="w-full text-destructive text-sm py-2">
          Cerrar sesion
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 12.2: Crear manifest.json para PWA**

```json
// public/manifest.json
{
  "name": "PersoFinancIA",
  "short_name": "PersoFinancIA",
  "description": "Tu herramienta de analisis financiero personal",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 12.3: Generar iconos PWA**

```bash
# Instalar herramienta de generacion de iconos
npm install -D pwa-asset-generator

# Generar iconos desde un SVG o imagen de referencia
# Si no tienes imagen, crear un SVG simple:
cat > /tmp/icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#0f172a"/>
  <text x="256" y="320" text-anchor="middle" font-size="300" fill="#3b82f6">$</text>
</svg>
EOF

npx pwa-asset-generator /tmp/icon.svg public/icons --icon-only --no-sandbox
```

Si el script falla en Windows, crear `public/icons/icon-192.png` y `public/icons/icon-512.png` manualmente (cualquier imagen PNG de 192x192 y 512x512 px sirve como placeholder).

- [ ] **Step 12.4: Verificar PWA en Chrome**

```bash
npm run build && npm start
```

1. Ir a `http://localhost:3000`
2. Abrir DevTools → Application → Manifest — verificar que carga sin errores
3. En Chrome mobile: el banner "Agregar a pantalla de inicio" debe aparecer
4. Verificar que el tema oscuro/claro funciona al cambiar desde Config

- [ ] **Step 12.5: Commit — fin de Fase 1**

```bash
git add -A
git commit -m "feat: add Config home, PWA manifest — Fase 1 complete"
```

---

## FASE 2 — Ingesta de emails

---

### Task 13: Edge Function classify-tx

**Files:**
- Create: `supabase/functions/classify-tx/index.ts`

- [ ] **Step 13.1: Crear la Edge Function classify-tx**

```typescript
// supabase/functions/classify-tx/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ClassifyRequest {
  user_id: string
  movimiento_id: string
  descripcion: string
  monto: number
  tipo: string
  banco: string
}

interface ClassifyResult {
  categoria: string | null
  confianza: number
  regla_id: string | null
  metodo: 'regla_manual' | 'regla_ia' | 'claude' | 'pendiente'
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const body: ClassifyRequest = await req.json()
  const { user_id, descripcion, monto, tipo } = body

  // CAPA 1+2: Evaluar reglas (manuales primero, luego IA)
  const { data: reglas } = await supabase
    .from('reglas_categoria')
    .select('*, categorias(nombre)')
    .eq('user_id', user_id)
    .eq('activa', true)
    .order('origen', { ascending: false }) // 'manual' antes que 'ai_suggestion'
    .order('prioridad', { ascending: true })

  for (const regla of reglas ?? []) {
    const campoValor = regla.campo === 'descripcion' ? descripcion
      : regla.campo === 'tipo' ? tipo
      : regla.campo === 'monto' ? String(monto) : ''

    let match = false
    switch (regla.operador) {
      case 'contains':    match = campoValor.toUpperCase().includes(regla.valor.toUpperCase()); break
      case 'starts_with': match = campoValor.toUpperCase().startsWith(regla.valor.toUpperCase()); break
      case 'equals':      match = campoValor.toUpperCase() === regla.valor.toUpperCase(); break
      case 'gt':          match = Number(campoValor) > Number(regla.valor); break
      case 'lt':          match = Number(campoValor) < Number(regla.valor); break
    }

    if (match) {
      // Incrementar contador de aplicaciones
      await supabase
        .from('reglas_categoria')
        .update({ aplicaciones: (regla.aplicaciones ?? 0) + 1 })
        .eq('id', regla.id)

      const result: ClassifyResult = {
        categoria: (regla as any).categorias?.nombre ?? null,
        confianza: 100,
        regla_id: regla.id,
        metodo: regla.origen === 'manual' ? 'regla_manual' : 'regla_ia',
      }
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
    }
  }

  // CAPA 3: Claude fallback
  const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')
  if (!CLAUDE_API_KEY) {
    return new Response(JSON.stringify({ categoria: null, confianza: 0, regla_id: null, metodo: 'pendiente' } as ClassifyResult), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Obtener categorias del usuario para el prompt
  const { data: categorias } = await supabase
    .from('categorias')
    .select('nombre, grupo')
    .eq('user_id', user_id)

  const categoriasStr = categorias?.map(c => `- ${c.nombre} (${c.grupo})`).join('\n') ?? ''

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Clasifica esta transaccion financiera colombiana en una de las categorias disponibles.

Transaccion: "${descripcion}" | Monto: $${monto} COP | Tipo: ${tipo}

Categorias disponibles:
${categoriasStr}

Responde SOLO con JSON: {"categoria": "nombre exacto de la categoria", "confianza": numero_del_0_al_100}
Si no encaja en ninguna, usa "Otros" con confianza baja.`
      }]
    })
  })

  if (!claudeRes.ok) {
    return new Response(JSON.stringify({ categoria: null, confianza: 0, regla_id: null, metodo: 'pendiente' } as ClassifyResult), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const claudeData = await claudeRes.json()
  const text = claudeData.content?.[0]?.text ?? '{}'
  let parsed = { categoria: null as string | null, confianza: 0 }
  try { parsed = JSON.parse(text) } catch { /* keep defaults */ }

  const metodo: ClassifyResult['metodo'] = parsed.confianza >= 70 ? 'claude' : 'pendiente'
  const result: ClassifyResult = {
    categoria: metodo === 'pendiente' ? null : parsed.categoria,
    confianza: parsed.confianza,
    regla_id: null,
    metodo,
  }

  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
})
```

- [ ] **Step 13.2: Configurar secrets de Edge Functions en Supabase**

```bash
supabase secrets set CLAUDE_API_KEY=sk-ant-...
# Verificar que esta seteado
supabase secrets list
```

Salida esperada:
```
Name             Value
CLAUDE_API_KEY   sk-ant-...[redacted]
```

- [ ] **Step 13.3: Deploy de classify-tx**

```bash
supabase functions deploy classify-tx --no-verify-jwt
```

Salida esperada:
```
Deploying Function classify-tx...
Done. Function classify-tx deployed.
```

- [ ] **Step 13.4: Probar classify-tx con curl**

```bash
# Reemplazar <PROJECT_REF> y <ANON_KEY> con los valores reales
curl -X POST https://hgvgjwvwiycuxcebqfvx.supabase.co/functions/v1/classify-tx \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<tu-user-id>","movimiento_id":"test","descripcion":"RAPPI","monto":35000,"tipo":"Compra","banco":"Bancolombia"}'
```

Respuesta esperada:
```json
{"categoria":"Domicilios/Comida","confianza":100,"regla_id":"<uuid>","metodo":"regla_manual"}
```

Si no hay reglas creadas, Claude debe responder con su clasificacion.

- [ ] **Step 13.5: Commit**

```bash
git add supabase/functions/classify-tx/
git commit -m "feat: add classify-tx Edge Function with rules + Claude fallback"
```

---

### Task 14: Edge Function ingest-emails + tipos de parsers

**Files:**
- Create: `supabase/functions/ingest-emails/parsers/types.ts`
- Create: `supabase/functions/ingest-emails/index.ts`

- [ ] **Step 14.1: Crear interfaz ParsedTransaction**

```typescript
// supabase/functions/ingest-emails/parsers/types.ts
export interface ParsedTransaction {
  id: string        // Gmail message ID (PK idempotente)
  fecha: string     // YYYY-MM-DD
  hora: string      // HH:MM
  tipo: string      // Compra / Transferencia / Ingreso / etc.
  flujo: 'in' | 'out'
  monto: number     // COP, siempre positivo
  descripcion: string
  cuenta: string | null  // '*4000'
  raw: string       // snippet original del email
}

export interface BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null
}
```

- [ ] **Step 14.2: Crear handler principal de ingest-emails**

```typescript
// supabase/functions/ingest-emails/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BancolombiaParser } from './parsers/bancolombia.ts'
import { NequiParser } from './parsers/nequi.ts'
import { RappiCardParser } from './parsers/rappicard.ts'
import { OccidenteParser } from './parsers/occidente.ts'
import { LulobankParser } from './parsers/lulobank.ts'
import { NuParser } from './parsers/nu.ts'
import { HapiParser } from './parsers/hapi.ts'
import type { BankParser, ParsedTransaction } from './parsers/types.ts'

const PARSERS: Record<string, BankParser> = {
  bancolombia: new BancolombiaParser(),
  nequi:       new NequiParser(),
  rappicard:   new RappiCardParser(),
  occidente:   new OccidenteParser(),
  lulobank:    new LulobankParser(),
  nu:          new NuParser(),
  hapi:        new HapiParser(),
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Obtener todos los usuarios con bancos activos
  const { data: bancos } = await supabase
    .from('bancos')
    .select('*, profiles(gmail_token)')
    .eq('activo', true)

  if (!bancos?.length) {
    return new Response(JSON.stringify({ message: 'No active banks' }), { status: 200 })
  }

  const summary: Record<string, number> = {}

  for (const banco of bancos) {
    const gmailToken = (banco.profiles as any)?.gmail_token
    if (!gmailToken) continue

    const parser = PARSERS[banco.parser_type]
    if (!parser) continue

    // Calcular ayer
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    const ayerStr = ayer.toISOString().slice(0, 10).replace(/-/g, '/')
    const hoyStr = new Date().toISOString().slice(0, 10).replace(/-/g, '/')

    // Buscar emails en Gmail
    const gmailQuery = `${banco.gmail_query} after:${ayerStr} before:${hoyStr}`
    const gmailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(gmailQuery)}&maxResults=50`,
      { headers: { Authorization: `Bearer ${gmailToken}` } }
    )

    if (!gmailRes.ok) {
      console.error(`Gmail error for banco ${banco.nombre}: ${gmailRes.status}`)
      continue
    }

    const gmailData = await gmailRes.json()
    const messages = gmailData.messages ?? []
    const transactions: ParsedTransaction[] = []

    for (const msg of messages) {
      // Obtener snippet del mensaje
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=snippet`,
        { headers: { Authorization: `Bearer ${gmailToken}` } }
      )
      const msgData = await msgRes.json()
      const snippet = msgData.snippet ?? ''

      const parsed = parser.parse(snippet, msg.id)
      if (parsed) transactions.push(parsed)
    }

    if (transactions.length === 0) continue

    // Clasificar y hacer upsert
    let saved = 0
    for (const tx of transactions) {
      // Invocar classify-tx para obtener categoria
      const classifyRes = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/classify-tx`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: banco.user_id,
            movimiento_id: tx.id,
            descripcion: tx.descripcion,
            monto: tx.monto,
            tipo: tx.tipo,
            banco: banco.nombre,
          }),
        }
      )

      const classification = classifyRes.ok ? await classifyRes.json() : null

      const { error } = await supabase.from('movimientos').insert({
        id: tx.id,
        user_id: banco.user_id,
        banco_id: banco.id,
        fecha: tx.fecha,
        hora: tx.hora,
        tipo: tx.tipo,
        flujo: tx.flujo,
        monto: tx.monto,
        descripcion: tx.descripcion,
        categoria: classification?.categoria ?? null,
        categoria_manual: false,
        regla_aplicada: classification?.regla_id ?? null,
        confianza_ia: classification?.confianza ?? null,
        origen: 'email',
        cuenta: tx.cuenta,
        raw: tx.raw,
      }).onConflict('id').ignore()

      if (!error) saved++
    }

    summary[banco.nombre] = saved

    // Actualizar ultimo_sync
    await supabase
      .from('bancos')
      .update({ ultimo_sync: new Date().toISOString() })
      .eq('id', banco.id)
  }

  return new Response(JSON.stringify({ summary }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

- [ ] **Step 14.3: Configurar cron de Supabase para ingest-emails**

En Supabase Dashboard → Edge Functions → ingest-emails → Schedule:

```
Cron expression: 0 12 * * *
(7:30am Colombia = 12:30pm UTC)
```

O via CLI:
```bash
# En supabase/config.toml agregar:
# [functions.ingest-emails]
# verify_jwt = false
# [functions.ingest-emails.cron]
# schedule = "0 12 * * *"
```

- [ ] **Step 14.4: Commit**

```bash
git add supabase/functions/ingest-emails/
git commit -m "feat: add ingest-emails Edge Function handler with cron schedule"
```

---

### Task 15: Parsers de banco

**Files:**
- Create: `supabase/functions/ingest-emails/parsers/bancolombia.ts`
- Create: `supabase/functions/ingest-emails/parsers/nequi.ts`
- Create: `supabase/functions/ingest-emails/parsers/rappicard.ts`
- Create: `supabase/functions/ingest-emails/parsers/occidente.ts`
- Create: `supabase/functions/ingest-emails/parsers/lulobank.ts`
- Create: `supabase/functions/ingest-emails/parsers/nu.ts`
- Create: `supabase/functions/ingest-emails/parsers/hapi.ts`
- Create: `supabase/functions/ingest-emails/parsers/generic.ts`

- [ ] **Step 15.1: Parser Bancolombia (migrado de Claude Cowork)**

```typescript
// supabase/functions/ingest-emails/parsers/bancolombia.ts
import type { BankParser, ParsedTransaction } from './types.ts'

function parseMonto(raw: string): number {
  const match = raw.match(/\$\s?([\d.,]+)/)
  if (!match) return 0
  let s = match[1]
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    const parts = s.split('.')
    if (parts.length === 2 && parts[1].length === 2) {
      // decimal
    } else {
      s = s.replace(/\./g, '')
    }
  }
  return parseFloat(s) || 0
}

function parseFechaHora(snippet: string): { fecha: string; hora: string } {
  const match = snippet.match(/el (\d{2})\/(\d{2})\/(\d{2,4}) a las (\d{2}:\d{2})/)
  if (!match) return { fecha: new Date().toISOString().slice(0, 10), hora: '00:00' }
  const [, d, m, y, hora] = match
  const year = y.length === 2 ? `20${y}` : y
  return { fecha: `${year}-${m}-${d}`, hora }
}

export class BancolombiaParser implements BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null {
    const { fecha, hora } = parseFechaHora(snippet)
    const monto = parseMonto(snippet)
    if (!monto) return null

    // Compra
    const compra = snippet.match(/Compraste \$[\d.,]+ en (.+?) con tu T\.Deb/i)
    if (compra) {
      const cuenta = snippet.match(/T\.Deb \*(\d+)/)?.[1]
      return { id: messageId, fecha, hora, tipo: 'Compra', flujo: 'out', monto,
        descripcion: compra[1].trim().toUpperCase(), cuenta: cuenta ? `*${cuenta}` : null, raw: snippet }
    }

    // Transferencia recibida
    if (/recibiste una transferencia de .+ por \$/i.test(snippet)) {
      const nombre = snippet.match(/transferencia de (.+?) por \$/i)?.[1]
      return { id: messageId, fecha, hora, tipo: 'Transferencia recibida', flujo: 'in', monto,
        descripcion: (nombre ?? 'TRANSFERENCIA').toUpperCase(), cuenta: null, raw: snippet }
    }

    // Ingreso/nomina
    if (/Recibiste un pago|de Nomina/i.test(snippet)) {
      const nombre = snippet.match(/de (.+?) por \$/i)?.[1]
      return { id: messageId, fecha, hora, tipo: 'Ingreso', flujo: 'in', monto,
        descripcion: (nombre ?? 'INGRESO').toUpperCase(), cuenta: null, raw: snippet }
    }

    // Pago QR
    const qr = snippet.match(/pagaste \$[\d.,]+ por codigo QR.+?a la llave (.+?)(?:\.|$)/i)
    if (qr) {
      return { id: messageId, fecha, hora, tipo: 'Pago QR', flujo: 'out', monto,
        descripcion: `QR ${qr[1].trim().toUpperCase()}`, cuenta: null, raw: snippet }
    }

    // Transferencia enviada
    if (/transferiste \$|Bre-B/i.test(snippet)) {
      const dest = snippet.match(/a (.+?)(?:\s+desde|$)/i)?.[1]
      return { id: messageId, fecha, hora, tipo: 'Transferencia', flujo: 'out', monto,
        descripcion: (dest ?? 'TRANSFERENCIA').toUpperCase(), cuenta: null, raw: snippet }
    }

    // Pago
    const pago = snippet.match(/Pagaste \$[\d.,]+ a (.+?) desde tu producto/i)
    if (pago) {
      return { id: messageId, fecha, hora, tipo: 'Pago', flujo: 'out', monto,
        descripcion: pago[1].trim().toUpperCase(), cuenta: null, raw: snippet }
    }

    return null
  }
}
```

- [ ] **Step 15.2: Parser Nequi**

```typescript
// supabase/functions/ingest-emails/parsers/nequi.ts
import type { BankParser, ParsedTransaction } from './types.ts'

function parseMonto(snippet: string): number {
  const match = snippet.match(/\$\s?([\d.,]+)/)
  if (!match) return 0
  return parseFloat(match[1].replace(/\./g, '').replace(',', '.')) || 0
}

export class NequiParser implements BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null {
    const monto = parseMonto(snippet)
    if (!monto) return null
    const fecha = new Date().toISOString().slice(0, 10)
    const hora = '00:00'

    if (/enviaste|transferiste/i.test(snippet)) {
      const dest = snippet.match(/a (.+?)(?:\s+\$|\.|$)/i)?.[1]
      return { id: messageId, fecha, hora, tipo: 'Transferencia', flujo: 'out', monto,
        descripcion: (dest ?? 'NEQUI').toUpperCase(), cuenta: null, raw: snippet }
    }
    if (/recibiste/i.test(snippet)) {
      const origen = snippet.match(/de (.+?)(?:\s+\$|\.|$)/i)?.[1]
      return { id: messageId, fecha, hora, tipo: 'Transferencia recibida', flujo: 'in', monto,
        descripcion: (origen ?? 'NEQUI').toUpperCase(), cuenta: null, raw: snippet }
    }
    if (/pagaste/i.test(snippet)) {
      const comercio = snippet.match(/a (.+?)(?:\s+\$|\.|$)/i)?.[1]
      return { id: messageId, fecha, hora, tipo: 'Pago', flujo: 'out', monto,
        descripcion: (comercio ?? 'PAGO NEQUI').toUpperCase(), cuenta: null, raw: snippet }
    }
    return null
  }
}
```

- [ ] **Step 15.3: Parser RappiCard**

```typescript
// supabase/functions/ingest-emails/parsers/rappicard.ts
import type { BankParser, ParsedTransaction } from './types.ts'

export class RappiCardParser implements BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null {
    const montoMatch = snippet.match(/\$\s?([\d.,]+)/)
    if (!montoMatch) return null
    const monto = parseFloat(montoMatch[1].replace(/\./g, '').replace(',', '.')) || 0
    if (!monto) return null
    const fecha = new Date().toISOString().slice(0, 10)
    const hora = '00:00'

    if (/compra|compras/i.test(snippet)) {
      const comercio = snippet.match(/en (.+?)(?:\s+por|\s+\$|\.|$)/i)?.[1]
      return { id: messageId, fecha, hora, tipo: 'Compra TC', flujo: 'out', monto,
        descripcion: (comercio ?? 'RAPPICARD').toUpperCase(), cuenta: null, raw: snippet }
    }
    if (/pago/i.test(snippet)) {
      return { id: messageId, fecha, hora, tipo: 'Pago TC', flujo: 'in', monto,
        descripcion: 'PAGO RAPPICARD', cuenta: null, raw: snippet }
    }
    return null
  }
}
```

- [ ] **Step 15.4: Parsers Occidente, Lulobank, NU, Hapi (genericos)**

```typescript
// supabase/functions/ingest-emails/parsers/occidente.ts
import type { BankParser, ParsedTransaction } from './types.ts'
export class OccidenteParser implements BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null {
    const m = snippet.match(/\$\s?([\d.,]+)/)
    if (!m) return null
    const monto = parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || 0
    if (!monto) return null
    const flujo: 'in' | 'out' = /credito|abono|consignacion/i.test(snippet) ? 'in' : 'out'
    const tipo = flujo === 'in' ? 'Ingreso' : 'Compra'
    const desc = snippet.slice(0, 60).toUpperCase()
    return { id: messageId, fecha: new Date().toISOString().slice(0,10), hora: '00:00',
      tipo, flujo, monto, descripcion: desc, cuenta: null, raw: snippet }
  }
}
```

```typescript
// supabase/functions/ingest-emails/parsers/lulobank.ts
import type { BankParser, ParsedTransaction } from './types.ts'
export class LulobankParser implements BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null {
    const m = snippet.match(/\$\s?([\d.,]+)/)
    if (!m) return null
    const monto = parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || 0
    if (!monto) return null
    const flujo: 'in' | 'out' = /recibiste|abono/i.test(snippet) ? 'in' : 'out'
    return { id: messageId, fecha: new Date().toISOString().slice(0,10), hora: '00:00',
      tipo: flujo === 'in' ? 'Ingreso' : 'Pago', flujo, monto,
      descripcion: snippet.slice(0, 60).toUpperCase(), cuenta: null, raw: snippet }
  }
}
```

```typescript
// supabase/functions/ingest-emails/parsers/nu.ts
import type { BankParser, ParsedTransaction } from './types.ts'
export class NuParser implements BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null {
    const m = snippet.match(/\$\s?([\d.,]+)/)
    if (!m) return null
    const monto = parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || 0
    if (!monto) return null
    const flujo: 'in' | 'out' = /recibiste|pago recibido/i.test(snippet) ? 'in' : 'out'
    return { id: messageId, fecha: new Date().toISOString().slice(0,10), hora: '00:00',
      tipo: flujo === 'in' ? 'Ingreso' : 'Compra', flujo, monto,
      descripcion: snippet.slice(0, 60).toUpperCase(), cuenta: null, raw: snippet }
  }
}
```

```typescript
// supabase/functions/ingest-emails/parsers/hapi.ts
import type { BankParser, ParsedTransaction } from './types.ts'
export class HapiParser implements BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null {
    // Parser inicial — se refinara con emails reales de Hapi
    const m = snippet.match(/\$\s?([\d.,]+)/)
    if (!m) return null
    const monto = parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || 0
    if (!monto) return null
    const flujo: 'in' | 'out' = /recibido|ingreso/i.test(snippet) ? 'in' : 'out'
    return { id: messageId, fecha: new Date().toISOString().slice(0,10), hora: '00:00',
      tipo: flujo === 'in' ? 'Ingreso' : 'Pago', flujo, monto,
      descripcion: snippet.slice(0, 60).toUpperCase(), cuenta: null, raw: snippet }
  }
}
```

```typescript
// supabase/functions/ingest-emails/parsers/generic.ts
import type { BankParser, ParsedTransaction } from './types.ts'
export class GenericParser implements BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null {
    const m = snippet.match(/\$\s?([\d.,]+)/)
    if (!m) return null
    const monto = parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || 0
    if (!monto) return null
    const flujo: 'in' | 'out' = /recibiste|ingreso|credito|abono/i.test(snippet) ? 'in' : 'out'
    return { id: messageId, fecha: new Date().toISOString().slice(0,10), hora: '00:00',
      tipo: flujo === 'in' ? 'Ingreso' : 'Gasto', flujo, monto,
      descripcion: snippet.slice(0, 80).toUpperCase(), cuenta: null, raw: snippet }
  }
}
```

- [ ] **Step 15.5: Deploy de ingest-emails**

```bash
supabase functions deploy ingest-emails --no-verify-jwt
```

Salida esperada:
```
Deploying Function ingest-emails...
Done. Function ingest-emails deployed.
```

- [ ] **Step 15.6: Probar ingest-emails manualmente**

```bash
curl -X POST https://hgvgjwvwiycuxcebqfvx.supabase.co/functions/v1/ingest-emails \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Respuesta esperada:
```json
{"summary": {"Bancolombia": 3}}
```

Si el gmail_token no esta seteado, la respuesta sera `{"summary": {}}` — esto es correcto hasta que el usuario conecte Gmail en el paso siguiente.

- [ ] **Step 15.7: Commit**

```bash
git add supabase/functions/ingest-emails/
git commit -m "feat: add ingest-emails parsers for 7 banks (Bancolombia migrated + 6 new)"
```

---

### Task 16: Config — Gestion de Bancos UI

**Files:**
- Create: `components/config/banco-item.tsx`
- Create: `components/config/banco-form.tsx`
- Create: `app/(dashboard)/config/bancos/page.tsx`
- Create: `app/(dashboard)/config/bancos/nuevo/page.tsx`

- [ ] **Step 16.1: Crear BancoItem con toggle**

```typescript
// components/config/banco-item.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import type { Banco } from '@/lib/types/database'

interface BancoItemProps {
  banco: Banco
}

export function BancoItem({ banco }: BancoItemProps) {
  const supabase = getSupabaseBrowserClient()
  const router = useRouter()
  const [activo, setActivo] = useState(banco.activo)

  async function toggleActivo(value: boolean) {
    setActivo(value)
    await supabase.from('bancos').update({ activo: value }).eq('id', banco.id)
    router.refresh()
  }

  const lastSync = banco.ultimo_sync
    ? `Sync: ${new Date(banco.ultimo_sync).toLocaleDateString('es-CO')}`
    : 'Sin sincronizar'

  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-4">
      <span className="text-2xl">{banco.icono}</span>
      <div className="flex-1">
        <p className="font-medium text-sm">{banco.nombre}</p>
        <p className="text-xs text-muted-foreground">{activo ? lastSync : 'Inactivo'}</p>
      </div>
      <Switch checked={activo} onCheckedChange={toggleActivo} />
    </div>
  )
}
```

- [ ] **Step 16.2: Crear pagina lista de bancos**

```typescript
// app/(dashboard)/config/bancos/page.tsx
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { BancoItem } from '@/components/config/banco-item'
import { Button } from '@/components/ui/button'

export default async function BancosPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bancos } = await supabase
    .from('bancos')
    .select('*')
    .eq('user_id', user.id)
    .order('nombre')

  const { data: profile } = await supabase
    .from('profiles').select('gmail_token').eq('user_id', user.id).single()

  const gmailConectado = !!profile?.gmail_token

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-4">
        <h1 className="text-xl font-bold">Bancos conectados</h1>
        <Link href="/config/bancos/nuevo">
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </Link>
      </div>

      {!gmailConectado && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
          <p className="text-sm font-medium text-yellow-600">Gmail no conectado</p>
          <p className="text-xs text-muted-foreground mt-1">Conecta tu Gmail para habilitar la ingesta automatica</p>
          <Link href="/api/auth/gmail" className="text-xs text-primary font-medium mt-2 block">
            Conectar Gmail
          </Link>
        </div>
      )}

      <div className="space-y-2">
        {bancos?.map(banco => <BancoItem key={banco.id} banco={banco} />)}
        {!bancos?.length && (
          <p className="text-muted-foreground text-sm text-center py-8">
            No tienes bancos configurados. Agrega uno para empezar.
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 16.3: Crear formulario agregar banco**

```typescript
// app/(dashboard)/config/bancos/nuevo/page.tsx
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const BANCOS_PRESET = [
  { nombre: 'Bancolombia', icono: '🏦', query: 'from:(notificacionesbancolombia.com OR bancolombia.com.co)', parser_type: 'bancolombia' },
  { nombre: 'Nequi',       icono: '💜', query: 'from:nequi.com.co',          parser_type: 'nequi' },
  { nombre: 'RappiCard',   icono: '🧡', query: 'from:rappi.com',              parser_type: 'rappicard' },
  { nombre: 'Banco de Occidente', icono: '🏛️', query: 'from:bancodeoccidente.com.co', parser_type: 'occidente' },
  { nombre: 'Lulobank',    icono: '🟢', query: 'from:lulobank.com',           parser_type: 'lulobank' },
  { nombre: 'NU',          icono: '🟣', query: 'from:nu.com.co',              parser_type: 'nu' },
  { nombre: 'Hapi',        icono: '🔵', query: 'from:hapi.com.co',            parser_type: 'hapi' },
]

async function addBanco(formData: FormData) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('bancos').insert({
    user_id: user.id,
    nombre: String(formData.get('nombre')),
    icono: String(formData.get('icono') || '🏦'),
    gmail_query: String(formData.get('gmail_query')),
    parser_type: String(formData.get('parser_type') || 'generic'),
    activo: false,
  })
  redirect('/config/bancos')
}

export default async function NuevoBancoPage() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4 pt-4">Agregar banco</h1>

      <div className="mb-6">
        <p className="text-sm font-medium mb-3">Bancos preconfigurados</p>
        <div className="grid grid-cols-2 gap-2">
          {BANCOS_PRESET.map(b => (
            <form key={b.nombre} action={async () => {
              'use server'
              const supabase = await getSupabaseServerClient()
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return
              await supabase.from('bancos').insert({
                user_id: user.id, nombre: b.nombre, icono: b.icono,
                gmail_query: b.query, parser_type: b.parser_type, activo: false,
              })
              redirect('/config/bancos')
            }}>
              <button type="submit" className="w-full flex items-center gap-2 bg-card border border-border rounded-xl p-3 hover:bg-muted/50">
                <span className="text-xl">{b.icono}</span>
                <span className="text-sm font-medium">{b.nombre}</span>
              </button>
            </form>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-sm font-medium mb-3">Banco personalizado</p>
        <form action={addBanco} className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1 col-span-1">
              <Label className="text-xs">Icono</Label>
              <Input name="icono" defaultValue="🏦" maxLength={2} />
            </div>
            <div className="space-y-1 col-span-3">
              <Label className="text-xs">Nombre</Label>
              <Input name="nombre" placeholder="Mi banco" required />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Gmail query</Label>
            <Input name="gmail_query" placeholder="from:mibank.com has:$" required />
          </div>
          <Select name="parser_type">
            <SelectTrigger><SelectValue placeholder="Parser" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="generic">Generico (extrae monto automaticamente)</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" className="w-full">Guardar banco</Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 16.4: Verificar gestion de bancos**

```bash
npm run dev
```

1. Ir a `/config/bancos` — debe mostrar aviso "Gmail no conectado"
2. Ir a `/config/bancos/nuevo` — verificar que los bancos preconfigurados aparecen
3. Agregar "Nequi" desde los presets — verificar que aparece en la lista
4. Activar/desactivar el toggle del banco — verificar que cambia en DB

- [ ] **Step 16.5: Commit**

```bash
git add -A
git commit -m "feat: add Bancos UI — list, toggle, add preset and custom banks"
```

---

### Task 17: Gmail OAuth — Conexion de cuenta

**Files:**
- Create: `app/api/auth/gmail/route.ts`
- Create: `app/api/auth/gmail/callback/route.ts`

- [ ] **Step 17.1: Configurar Google OAuth en Supabase**

En Supabase Dashboard → Authentication → Providers → Google:
1. Activar Google provider
2. Agregar Client ID y Client Secret de Google Cloud Console
3. En Google Cloud Console → APIs & Services → Credentials:
   - Crear OAuth 2.0 Client ID
   - Authorized redirect URI: `https://hgvgjwvwiycuxcebqfvx.supabase.co/auth/v1/callback`
   - Scopes requeridos: `email`, `profile`, `https://www.googleapis.com/auth/gmail.readonly`

- [ ] **Step 17.2: Crear ruta de inicio de OAuth Gmail**

```typescript
// app/api/auth/gmail/route.ts
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'email profile https://www.googleapis.com/auth/gmail.readonly',
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect('/config/bancos?error=oauth_failed')
  }

  return NextResponse.redirect(data.url)
}
```

- [ ] **Step 17.3: Crear callback de Gmail OAuth**

```typescript
// app/api/auth/gmail/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/config/bancos?error=no_code`)
  }

  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/config/bancos?error=session_failed`)
  }

  // Guardar el access_token de Gmail en el perfil
  const gmailToken = data.session.provider_token
  if (gmailToken) {
    await supabase
      .from('profiles')
      .update({ gmail_token: gmailToken })
      .eq('user_id', data.session.user.id)
  }

  return NextResponse.redirect(`${origin}/config/bancos?connected=gmail`)
}
```

- [ ] **Step 17.4: Agregar variable de entorno**

```bash
# .env.local
NEXT_PUBLIC_APP_URL=http://localhost:3000
# En produccion: NEXT_PUBLIC_APP_URL=https://tu-app.vercel.app
```

- [ ] **Step 17.5: Verificar flujo OAuth**

```bash
npm run dev
```

1. Ir a `/config/bancos` — hacer clic en "Conectar Gmail"
2. Debe redirigir a Google OAuth consent screen
3. Aprobar permisos — debe redirigir de vuelta a `/config/bancos?connected=gmail`
4. Verificar en Supabase Dashboard → Table Editor → profiles que `gmail_token` ya no es null

- [ ] **Step 17.6: Commit**

```bash
git add -A
git commit -m "feat: add Gmail OAuth connection flow for email ingestion"
```

---

### Task 18: Importacion CSV

**Files:**
- Create: `app/(dashboard)/config/importar/page.tsx`
- Create: `app/api/ingest/route.ts`

- [ ] **Step 18.1: Crear pagina de importacion CSV**

```typescript
// app/(dashboard)/config/importar/page.tsx
'use client'
import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ParsedRow {
  fecha: string
  descripcion: string
  monto: number
  flujo: 'in' | 'out'
}

function parseCSV(text: string, colFecha: number, colDesc: number, colMonto: number, colFlujo: number): ParsedRow[] {
  const lines = text.trim().split('\n').slice(1) // skip header
  return lines.map(line => {
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim())
    const monto = Math.abs(parseFloat(cols[colMonto]?.replace(/\./g, '').replace(',', '.') || '0'))
    const flujoRaw = cols[colFlujo]?.toLowerCase() ?? ''
    const flujo: 'in' | 'out' = flujoRaw.includes('cred') || flujoRaw.includes('ingreso') ? 'in' : 'out'
    return {
      fecha: cols[colFecha] ?? new Date().toISOString().slice(0, 10),
      descripcion: cols[colDesc]?.toUpperCase() ?? 'SIN DESCRIPCION',
      monto,
      flujo,
    }
  }).filter(r => r.monto > 0)
}

export default function ImportarPage() {
  const supabase = getSupabaseBrowserClient()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [cols, setCols] = useState({ fecha: 0, desc: 1, monto: 2, flujo: 3 })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const text = await f.text()
    setPreview(parseCSV(text, cols.fecha, cols.desc, cols.monto, cols.flujo).slice(0, 5))
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    const text = await file.text()
    const rows = parseCSV(text, cols.fecha, cols.desc, cols.monto, cols.flujo)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let imported = 0
    for (const row of rows) {
      const id = `csv-${row.fecha}-${row.descripcion.slice(0,10)}-${row.monto}`.replace(/\s/g, '-')
      const { error } = await supabase.from('movimientos').insert({
        id,
        user_id: user.id,
        banco_id: null,
        fecha: row.fecha,
        hora: '00:00',
        tipo: row.flujo === 'in' ? 'Ingreso' : 'Gasto',
        flujo: row.flujo,
        monto: row.monto,
        descripcion: row.descripcion,
        origen: 'csv',
      })
      if (!error) imported++
    }

    setLoading(false)
    setResult(`${imported} movimientos importados de ${rows.length} filas`)
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold pt-4">Importar CSV</h1>

      <div className="space-y-2">
        <Label>Archivo CSV</Label>
        <Input type="file" accept=".csv" onChange={handleFileChange} />
      </div>

      {file && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {(['fecha', 'desc', 'monto', 'flujo'] as const).map(col => (
              <div key={col} className="space-y-1">
                <Label className="text-xs capitalize">Columna {col}</Label>
                <Input
                  type="number"
                  min="0"
                  value={cols[col]}
                  onChange={e => setCols(c => ({ ...c, [col]: parseInt(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </div>

          {preview.length > 0 && (
            <div className="bg-muted rounded-xl p-3 space-y-1">
              <p className="text-xs font-medium mb-2">Vista previa (primeras 5 filas):</p>
              {preview.map((r, i) => (
                <div key={i} className="text-xs flex justify-between">
                  <span className="text-muted-foreground">{r.fecha} · {r.descripcion.slice(0,25)}</span>
                  <span className={r.flujo === 'in' ? 'text-green-500' : 'text-red-500'}>
                    {r.flujo === 'in' ? '+' : '-'}${r.monto.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleImport} disabled={loading} className="w-full">
            {loading ? 'Importando...' : `Importar ${file.name}`}
          </Button>
        </>
      )}

      {result && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
          <p className="text-sm text-green-600">{result}</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 18.2: Crear proxy API para trigger manual de ingest**

```typescript
// app/api/ingest/route.ts
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest-emails`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: user.id }),
    }
  )

  const data = await res.json()
  return NextResponse.json(data)
}
```

- [ ] **Step 18.3: Agregar boton Sync manual en BancosPage**

Modificar `app/(dashboard)/config/bancos/page.tsx` para agregar:

```typescript
// Agregar dentro de BancosPage, despues del aviso de Gmail
<form action={async () => {
  'use server'
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ingest`, { method: 'POST' })
  revalidatePath('/config/bancos')
}}>
  <Button type="submit" variant="outline" size="sm" className="w-full">
    Sincronizar ahora
  </Button>
</form>
```

- [ ] **Step 18.4: Verificar importacion CSV**

```bash
npm run dev
```

1. Conseguir un extracto CSV de Bancolombia (cualquier banco)
2. Ir a `/config/importar`
3. Subir el CSV y ajustar los numeros de columna
4. Verificar la vista previa (5 filas)
5. Hacer clic en "Importar" y verificar el mensaje de resultado
6. Ir a `/movimientos` y verificar que los movimientos aparecen con origen "CSV"

- [ ] **Step 18.5: Commit — fin de Fase 2**

```bash
git add -A
git commit -m "feat: add CSV import, Sync manual trigger — Fase 2 complete"
```

---

### Task 19: Deploy en Vercel + variables de produccion

**Files:**
- Create: `.env.production` (solo referencia — las vars se configuran en Vercel Dashboard)
- Create: `.gitignore` (actualizar)

- [ ] **Step 19.1: Crear repo en GitHub**

```bash
# En GitHub.com crear repo privado "persofinancia"
git remote add origin https://github.com/tu-usuario/persofinancia.git
git push -u origin main
```

- [ ] **Step 19.2: Conectar Vercel al repo**

1. Ir a `vercel.com` → Add New Project
2. Importar el repo `persofinancia` de GitHub
3. Framework Preset: **Next.js** (detectado automaticamente)
4. No cambiar Build & Output Settings

- [ ] **Step 19.3: Configurar variables de entorno en Vercel**

En Vercel Dashboard → Settings → Environment Variables, agregar:

```
NEXT_PUBLIC_SUPABASE_URL        = https://hgvgjwvwiycuxcebqfvx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = <anon_key>
NEXT_PUBLIC_APP_URL             = https://tu-app.vercel.app
SUPABASE_SERVICE_ROLE_KEY       = <service_role_key>  (solo server-side, no NEXT_PUBLIC_)
```

- [ ] **Step 19.4: Hacer deploy**

```bash
# Cada push a main hace deploy automatico
git push origin main
```

Salida esperada en Vercel Dashboard:
```
Build successful
Deployed to https://persofinancia.vercel.app
```

- [ ] **Step 19.5: Verificar en produccion**

1. Abrir `https://tu-app.vercel.app` en el celular
2. Verificar que la pantalla de login carga
3. Autenticarse con magic link
4. Verificar que el BottomNav aparece y los 5 tabs funcionan
5. En Chrome Android: verificar que aparece "Agregar a pantalla de inicio"

- [ ] **Step 19.6: Commit**

```bash
git add .gitignore
git commit -m "chore: configure production deployment on Vercel"
```

---

### Task 20: Migracion de datos de bancolombia_movimientos

**Files:**
- `supabase/migrations/20260601000002_migrate_bancolombia.sql` (ya creado en Task 3)

- [ ] **Step 20.1: Registrar usuario de produccion**

Antes de migrar, necesitas el UUID de tu usuario registrado:

```sql
-- Ejecutar en Supabase Dashboard -> SQL Editor
SELECT id, email FROM auth.users WHERE email = 'kmivelez@gmail.com';
```

Guardar el UUID resultado — lo usaremos como JUAN_USER_ID.

- [ ] **Step 20.2: Ejecutar migracion de Bancolombia**

```bash
# Reemplazar <JUAN_USER_ID> con el UUID real obtenido en el paso anterior
supabase db execute --file supabase/migrations/20260601000002_migrate_bancolombia.sql \
  --variable JUAN_USER_ID=<uuid-del-usuario>
```

O ejecutar directamente en Supabase Dashboard → SQL Editor:

```sql
-- Reemplazar <JUAN_USER_ID> con tu UUID
DO $$
DECLARE
  JUAN_USER_ID UUID := '<uuid-del-usuario>';
  BANCO_ID UUID := 'bc000000-0000-0000-0000-bancolombia01';
BEGIN
  -- Crear banco Bancolombia
  INSERT INTO public.bancos (id, user_id, nombre, icono, gmail_query, parser_type, activo)
  VALUES (BANCO_ID, JUAN_USER_ID, 'Bancolombia', '🏦',
    'from:(notificacionesbancolombia.com OR bancolombia.com.co)', 'bancolombia', true)
  ON CONFLICT DO NOTHING;

  -- Migrar movimientos
  INSERT INTO public.movimientos
    (id, user_id, banco_id, fecha, hora, tipo, flujo, monto, descripcion, categoria, origen, cuenta, raw)
  SELECT
    id, JUAN_USER_ID, BANCO_ID, fecha,
    COALESCE(hora, '00:00'), tipo, flujo, monto, descripcion, categoria, 'email', cuenta, raw
  FROM public.bancolombia_movimientos
  ON CONFLICT (id) DO NOTHING;
END $$;
```

- [ ] **Step 20.3: Verificar migracion**

```sql
-- Verificar conteos
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE flujo='in') AS ingresos,
  COUNT(*) FILTER (WHERE flujo='out') AS egresos,
  MIN(fecha) AS primer_fecha,
  MAX(fecha) AS ultima_fecha
FROM public.movimientos
WHERE user_id = '<uuid-del-usuario>';
```

Salida esperada (basada en los datos existentes):
```
total  | ingresos | egresos | primer_fecha | ultima_fecha
-------+----------+---------+--------------+-------------
 ~300  |    ~60   |  ~240   | 2025-05-01   | 2026-05-31
```

- [ ] **Step 20.4: Verificar en la app**

1. Abrir `https://tu-app.vercel.app/movimientos`
2. Verificar que los movimientos de Bancolombia aparecen correctamente
3. Verificar que el Inicio muestra KPIs del mes actual con datos reales
4. Verificar que los filtros Ingresos/Gastos funcionan

- [ ] **Step 20.5: Crear categorias por defecto para el usuario**

```sql
-- Ejecutar en Supabase SQL Editor con tu UUID
INSERT INTO public.categorias (user_id, nombre, grupo, subgrupo, icono, color)
VALUES
  ('<uuid>', 'Mercado/Hogar',       'Variable',  'Alimentacion',  '🛒', '#22c55e'),
  ('<uuid>', 'Domicilios/Comida',   'Variable',  'Alimentacion',  '🍕', '#f97316'),
  ('<uuid>', 'Transporte/Gasolina', 'Variable',  'Movilidad',     '🚗', '#3b82f6'),
  ('<uuid>', 'Compras/Retail',      'Variable',  'Compras',       '🛍️', '#a855f7'),
  ('<uuid>', 'Salud/Farmacia',      'Variable',  'Salud',         '💊', '#ec4899'),
  ('<uuid>', 'Suscripciones/Tech',  'Fijo',      'Servicios',     '📱', '#06b6d4'),
  ('<uuid>', 'Pagos/Servicios',     'Fijo',      'Servicios',     '💳', '#64748b'),
  ('<uuid>', 'Transferencias',      'Variable',  'Movimientos',   '↔️', '#94a3b8'),
  ('<uuid>', 'Pagos QR',            'Variable',  'Pagos',         '📲', '#fbbf24'),
  ('<uuid>', 'Deuda',               'Fijo',      'Deuda',         '🏦', '#ef4444'),
  ('<uuid>', 'Ingreso',             'Ingreso',   'Ingreso',       '💰', '#4ade80'),
  ('<uuid>', 'Otros',               'Variable',  'Otros',         '📌', '#475569')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 20.6: Commit final**

```bash
git add -A
git commit -m "chore: production setup complete — data migrated, categories seeded"
```

---

## Resumen de tareas

| # | Tarea | Fase | Commit |
|---|-------|------|--------|
| 1 | Scaffolding Next.js 14 | 1 | `chore: scaffold Next.js 14` |
| 2 | Clientes Supabase + tipos TS | 1 | `feat: add Supabase clients, types, utils` |
| 3 | Migraciones de BD | 1 | `feat: add database migrations` |
| 4 | Auth magic link | 1 | `feat: add magic link auth` |
| 5 | Tema Dark/Light/System | 1 | `feat: add dark/light/system theme` |
| 6 | Layout + BottomNav | 1 | `feat: add BottomNav layout` |
| 7 | Inicio con KPIs | 1 | `feat: add Inicio page with KPIs` |
| 8 | Movimientos lista | 1 | `feat: add Movimientos list` |
| 9 | Movimientos CRUD | 1 | `feat: add Movimientos CRUD` |
| 10 | Config Categorias | 1 | `feat: add Categorias CRUD` |
| 11 | Config Reglas | 1 | `feat: add Reglas CRUD` |
| 12 | Config home + PWA | 1 | `feat: add Config home, PWA manifest` |
| 13 | Edge Fn classify-tx | 2 | `feat: add classify-tx Edge Function` |
| 14 | Edge Fn ingest-emails | 2 | `feat: add ingest-emails handler` |
| 15 | Parsers 7 bancos | 2 | `feat: add 7 bank parsers` |
| 16 | Config Bancos UI | 2 | `feat: add Bancos UI` |
| 17 | Gmail OAuth | 2 | `feat: add Gmail OAuth` |
| 18 | CSV Import | 2 | `feat: add CSV import` |
| 19 | Deploy Vercel | 2 | `chore: configure Vercel deployment` |
| 20 | Migracion datos | 2 | `chore: production data migration` |

---

## Verificacion de cobertura del spec

- [x] Auth multi-usuario con magic link (Tasks 3, 4)
- [x] RLS en todas las tablas (Task 3)
- [x] Tabla unificada `movimientos` con `banco_id` (Task 3)
- [x] Bottom Navigation 5 tabs mobile-first (Task 6)
- [x] Tema Dark/Light/System (Task 5)
- [x] PWA installable (Task 12)
- [x] Dashboard con KPIs (Task 7)
- [x] Movimientos CRUD manual (Task 9)
- [x] Edit categoria + drawer (Task 9)
- [x] Categorias CRUD (Task 10)
- [x] Reglas de categorizacion (Task 11)
- [x] classify-tx: reglas + Claude fallback (Task 13)
- [x] ingest-emails Edge Function cron (Task 14)
- [x] Parser Bancolombia migrado (Task 15)
- [x] Parsers Nequi, RappiCard, Occidente, Lulobank, NU, Hapi (Task 15)
- [x] Gestion de bancos UI (Task 16)
- [x] Agregar banco custom (Task 16)
- [x] Gmail OAuth connection (Task 17)
- [x] Importacion CSV (Task 18)
- [x] Deploy Vercel (Task 19)
- [x] Migracion datos de bancolombia_movimientos (Task 20)
- [x] Categorias por defecto seeded (Task 20)
- [ ] Chat IA — Fase 5 (placeholder en Task 6)
- [ ] Analitica completa — Fase 3 (placeholder en Task 6)
- [ ] Alertas proactivas — Fase 5
- [ ] Reglas sugeridas por IA + loop de aprendizaje — Fase 4

---

## Criterios de aceptacion

### Fase 1
- [ ] Magic link llega al email y redirige a la app autenticado
- [ ] Usuario ve sus movimientos migrados de `bancolombia_movimientos`
- [ ] Puede crear un movimiento manual desde `/movimientos/nuevo`
- [ ] Puede editar la categoria de un movimiento via drawer
- [ ] Puede cambiar tema Dark/Light/System desde Config
- [ ] App instalable como PWA en Android (banner "Agregar a pantalla de inicio")
- [ ] API key de Supabase y secrets de Claude NO aparecen en el bundle del frontend
- [ ] RLS activo: usuario A no puede acceder a datos de usuario B

### Fase 2
- [ ] Edge Function `ingest-emails` procesa emails de Bancolombia correctamente
- [ ] Idempotencia: correr ingest dos veces no duplica movimientos
- [ ] Parser Nequi clasifica al menos transferencias y pagos
- [ ] Usuario puede activar/desactivar bancos desde Config
- [ ] Usuario puede agregar banco preconfigurado (Nequi, RappiCard, etc.)
- [ ] Sync manual desde Config funciona y actualiza `ultimo_sync`
- [ ] Gmail OAuth conecta la cuenta y guarda token
- [ ] CSV import carga movimientos con origen "csv" y los muestra en la lista
