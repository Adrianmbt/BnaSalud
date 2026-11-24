-- ============================================================
-- BnaSalud · Catálogo maestro de insumos y medicamentos (0030)
--
-- 1) `catalogo_insumos`: un solo catálogo para que el Director arme las
--    órdenes de entrega con un buscador en lugar de texto libre.
-- 2) `ordenes_entrega_items` referencia el catálogo (`insumo_id`) y guarda
--    lote y vencimiento. Se conservan `tipo`, `item_key`, `nombre`, `unidad`
--    y `cantidad` porque el sistema interno (CITAB) los usa al traer las
--    órdenes pendientes: la sincronización sigue funcionando sin cambios.
-- 3) `inventario_centro`: saldo por centro e insumo, con UNIQUE por par.
-- 4) `recibir_orden_entrega()`: recepción atómica. Valida el estado con
--    FOR UPDATE (un doble clic no carga dos veces), suma a
--    `inventario_centro` y a `almacen_stock` (espejo que ya lee el panel y
--    escribe el sistema interno) y deja el movimiento ENTRADA.
--
-- `cantidad` es la cantidad enviada: se mantiene ese nombre para no romper
-- la sincronización; `cantidad_enviada` sería una segunda fuente de verdad.
--
-- Idempotente: puede re-ejecutarse sin efecto secundario.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

BEGIN;

-- 1) Catálogo maestro
CREATE TABLE IF NOT EXISTS public.catalogo_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Medicamento'
    CHECK (categoria IN ('Medicamento', 'Insumo Médico', 'Material Quirúrgico', 'Otro')),
  presentacion TEXT,
  unidad_medida TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La búsqueda del autocompletado es ILIKE '%texto%'; un índice B-tree no
-- ayuda. shortcut: sin pg_trgm la búsqueda escanea el catálogo (cientos de
-- filas); si crece a miles, activar pg_trgm y un índice GIN.
CREATE INDEX IF NOT EXISTS catalogo_insumos_categoria_idx
  ON public.catalogo_insumos (categoria, activo);

-- 2) Detalle de la orden con referencia al catálogo
ALTER TABLE public.ordenes_entrega_items
  ADD COLUMN IF NOT EXISTS insumo_id UUID
    REFERENCES public.catalogo_insumos(id) ON DELETE SET NULL;
ALTER TABLE public.ordenes_entrega_items
  ADD COLUMN IF NOT EXISTS lote TEXT;
ALTER TABLE public.ordenes_entrega_items
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

CREATE UNIQUE INDEX IF NOT EXISTS ordenes_entrega_items_orden_insumo_uq
  ON public.ordenes_entrega_items (orden_id, insumo_id)
  WHERE insumo_id IS NOT NULL;

-- 3) Stock por centro e insumo
CREATE TABLE IF NOT EXISTS public.inventario_centro (
  centro_salud_id INTEGER NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  -- RESTRICT: un insumo con existencias no se borra; se desactiva (activo=false).
  insumo_id UUID NOT NULL REFERENCES public.catalogo_insumos(id) ON DELETE RESTRICT,
  cantidad_actual INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_actual >= 0),
  stock_minimo INTEGER NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (centro_salud_id, insumo_id)
);

CREATE INDEX IF NOT EXISTS inventario_centro_centro_idx
  ON public.inventario_centro (centro_salud_id);

-- 4) Recepción atómica de una orden
CREATE OR REPLACE FUNCTION public.recibir_orden_entrega(
  p_orden_id UUID,
  p_usuario TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_centro INTEGER;
  v_estado TEXT;
  v_numero TEXT;
  v_item RECORD;
  v_total INTEGER := 0;
BEGIN
  SELECT centro_id, estado, numero
    INTO v_centro, v_estado, v_numero
    FROM public.ordenes_entrega
   WHERE id = p_orden_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de entrega no encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_estado <> 'pendiente_recepcion' THEN
    RAISE EXCEPTION 'La orden ya fue procesada.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ordenes_entrega
     SET estado = 'recibida',
         recibida_por = p_usuario,
         recibida_en = now()
   WHERE id = p_orden_id;

  FOR v_item IN
    SELECT insumo_id, tipo, item_key, nombre, unidad, cantidad
      FROM public.ordenes_entrega_items
     WHERE orden_id = p_orden_id
  LOOP
    IF v_item.insumo_id IS NOT NULL THEN
      INSERT INTO public.inventario_centro (centro_salud_id, insumo_id, cantidad_actual)
      VALUES (v_centro, v_item.insumo_id, v_item.cantidad)
      ON CONFLICT (centro_salud_id, insumo_id) DO UPDATE
        SET cantidad_actual = public.inventario_centro.cantidad_actual + EXCLUDED.cantidad_actual,
            actualizado_en = now();
    END IF;

    -- Espejo que ya lee el panel y que el sistema interno vuelve a subir
    -- con sus propias cantidades (upsert absoluto, sin doble conteo).
    INSERT INTO public.almacen_stock
      (clinica_id, item_key, tipo, nombre, unidad, cantidad, actualizado_en)
    VALUES
      (v_centro, v_item.item_key, v_item.tipo, v_item.nombre, v_item.unidad,
       v_item.cantidad, now())
    ON CONFLICT (clinica_id, item_key) DO UPDATE
      SET cantidad = public.almacen_stock.cantidad + EXCLUDED.cantidad,
          actualizado_en = now();

    INSERT INTO public.almacen_movimientos
      (clinica_id, tipo, item_key, nombre, cantidad, referencia, creado_por)
    VALUES
      (v_centro, 'ENTRADA', v_item.item_key, v_item.nombre, v_item.cantidad,
       'Orden ' || COALESCE(v_numero, LEFT(p_orden_id::TEXT, 8)), p_usuario);

    v_total := v_total + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'orden_id', p_orden_id,
    'estado', 'recibida',
    'centro_id', v_centro,
    'items', v_total
  );
END;
$$;

-- Solo el backend (clave service_role) puede confirmar recepciones.
REVOKE ALL ON FUNCTION public.recibir_orden_entrega(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recibir_orden_entrega(UUID, TEXT) TO service_role;

COMMIT;
