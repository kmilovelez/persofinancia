-- persofinancia/supabase/migrations/20260601000001_initial_schema.sql

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
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-crear profile al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
CREATE POLICY "bancos_own" ON public.bancos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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
  color      TEXT NOT NULL DEFAULT '#64748b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categorias_own" ON public.categorias
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- REGLAS_CATEGORIA (must be before movimientos for FK)
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
CREATE POLICY "reglas_own" ON public.reglas_categoria
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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
  confianza_ia      NUMERIC(5,2) DEFAULT NULL CHECK (confianza_ia IS NULL OR (confianza_ia >= 0 AND confianza_ia <= 100)),
  origen            TEXT NOT NULL DEFAULT 'email' CHECK (origen IN ('email','csv','manual')),
  cuenta            TEXT DEFAULT NULL,
  raw               TEXT DEFAULT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_user_fecha ON public.movimientos(user_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_user_flujo ON public.movimientos(user_id, flujo);
CREATE INDEX IF NOT EXISTS idx_movimientos_user_categoria ON public.movimientos(user_id, categoria);
CREATE INDEX IF NOT EXISTS idx_movimientos_user_banco ON public.movimientos(user_id, banco_id);
CREATE INDEX IF NOT EXISTS idx_reglas_user_activa_prioridad ON public.reglas_categoria(user_id, activa, prioridad);

ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movimientos_own" ON public.movimientos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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
CREATE POLICY "alertas_own" ON public.alertas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_alertas_user_leida ON public.alertas(user_id, leida);

-- ──────────────────────────────────────────
-- STORAGE bucket para CSV
-- ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('csv-imports', 'csv-imports', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "csv_own_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'csv-imports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "csv_own_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'csv-imports' AND auth.uid()::text = (storage.foldername(name))[1]);
