-- persofinancia/supabase/migrations/20260601000003_seed_categories.sql
-- INSTRUCCIONES: Ejecutar DESPUÉS de que el usuario esté registrado
-- Inserta las 12 categorias por defecto para kmivelez@gmail.com

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'kmivelez@gmail.com' LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario kmivelez@gmail.com no encontrado. Regístrate primero.';
  END IF;

  -- Insert default categories (skip if already exist)
  INSERT INTO public.categorias (user_id, nombre, grupo, subgrupo, icono, color)
  VALUES
    (v_user_id, 'Mercado/Hogar',       'Variable', 'Alimentacion',  '🛒', '#22c55e'),
    (v_user_id, 'Domicilios/Comida',   'Variable', 'Alimentacion',  '🍕', '#f97316'),
    (v_user_id, 'Transporte/Gasolina', 'Variable', 'Movilidad',     '🚗', '#3b82f6'),
    (v_user_id, 'Compras/Retail',      'Variable', 'Compras',       '🛍️', '#a855f7'),
    (v_user_id, 'Salud/Farmacia',      'Variable', 'Salud',         '💊', '#ec4899'),
    (v_user_id, 'Suscripciones/Tech',  'Fijo',     'Servicios',     '📱', '#06b6d4'),
    (v_user_id, 'Pagos/Servicios',     'Fijo',     'Servicios',     '💳', '#64748b'),
    (v_user_id, 'Transferencias',      'Variable', 'Movimientos',   '↔',  '#94a3b8'),
    (v_user_id, 'Pagos QR',            'Variable', 'Pagos',         '📲', '#fbbf24'),
    (v_user_id, 'Deuda',               'Fijo',     'Deuda',         '🏦', '#ef4444'),
    (v_user_id, 'Ingreso',             'Ingreso',  'Ingreso',       '💰', '#4ade80'),
    (v_user_id, 'Otros',               'Variable', 'Otros',         '📌', '#475569')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Categorias sembradas para usuario: %', v_user_id;
  RAISE NOTICE 'Total categorias: %', (SELECT COUNT(*) FROM public.categorias WHERE user_id = v_user_id);
END $$;
