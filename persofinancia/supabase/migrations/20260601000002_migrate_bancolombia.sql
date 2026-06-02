-- persofinancia/supabase/migrations/20260601000002_migrate_bancolombia.sql
-- INSTRUCCIONES:
-- 1. Ejecutar DESPUÉS de que el usuario principal esté registrado en la nueva app
-- 2. Obtener el UUID del usuario: SELECT id FROM auth.users WHERE email = 'kmivelez@gmail.com';
-- 3. Reemplazar <JUAN_USER_ID> con el UUID real antes de ejecutar

-- Este script usa una variable de entorno de PostgreSQL.
-- Ejecutar así en psql: psql ... -v JUAN_USER_ID="'uuid-aqui'"
-- O reemplazar :JUAN_USER_ID directamente con el UUID entre comillas simples.

DO $$
DECLARE
  v_user_id UUID;
  v_banco_id UUID := 'bc000000-0000-0000-0000-bancolombia01';
BEGIN
  -- Obtener el usuario principal
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'kmivelez@gmail.com' LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario kmivelez@gmail.com no encontrado. Regístrate primero en la app.';
  END IF;

  RAISE NOTICE 'Migrando datos para usuario: %', v_user_id;

  -- Pre-flight: validate flujo values
  IF EXISTS (SELECT 1 FROM public.bancolombia_movimientos WHERE flujo NOT IN ('in','out')) THEN
    RAISE EXCEPTION 'bancolombia_movimientos tiene valores de flujo inesperados: %',
      (SELECT string_agg(DISTINCT flujo, ', ') FROM public.bancolombia_movimientos WHERE flujo NOT IN ('in','out'));
  END IF;

  -- 1. Insertar banco Bancolombia
  INSERT INTO public.bancos (id, user_id, nombre, icono, gmail_query, parser_type, activo)
  VALUES (
    v_banco_id,
    v_user_id,
    'Bancolombia',
    '🏦',
    'from:(notificacionesbancolombia.com OR bancolombia.com.co)',
    'bancolombia',
    true
  ) ON CONFLICT (id) DO NOTHING;

  -- 2. Migrar movimientos existentes
  INSERT INTO public.movimientos (id, user_id, banco_id, fecha, hora, tipo, flujo, monto, descripcion, categoria, origen, cuenta, raw)
  SELECT
    id,
    v_user_id,
    v_banco_id,
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

  -- 3. Resultado
  RAISE NOTICE 'Migracion completa. Total movimientos del usuario en nueva tabla: %',
    (SELECT COUNT(*) FROM public.movimientos WHERE user_id = v_user_id);
END $$;

-- Verificar resultado:
-- SELECT COUNT(*) total, SUM(monto) FILTER (WHERE flujo='out') egresos, SUM(monto) FILTER (WHERE flujo='in') ingresos
-- FROM public.movimientos WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kmivelez@gmail.com');
