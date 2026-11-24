-- ============================================================
-- BnaSalud · Almacén: órdenes de entrega e inventario (0029)
--
-- El Director/Administración General despacha medicamentos e insumos desde
-- el portal web hacia un centro de salud. La orden viaja en estado
-- 'pendiente_recepcion' y el Jefe de Almacén la recibe en el sistema
-- interno, que suma las cantidades a `almacen_stock` y empuja el resultado
-- de vuelta a esta base (Supabase).
--
-- `almacen_stock` es la vista consolidada que alimenta el panel
-- "Stock e inventario" del Director: el sistema interno la actualiza con
-- cada recepción o consumo.
-- Idempotente: puede re-ejecutarse sin efecto secundario.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

BEGIN;

-- 1) El rol Jefe de Almacén existe en el catálogo para no romper filas
--    históricas ni la sincronización, pero el portal web lo rechaza en el
--    login: es una cuenta exclusiva del sistema interno.
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN (
    'superusuario', 'medico', 'jefe_farmacia', 'farmaceutico', 'enfermero',
    'paciente', 'recepcionista', 'medico_emergencia', 'historias_medicas',
    'admin_sistemas', 'director', 'jefe_almacen'
  ));

-- 2) Órdenes de entrega
CREATE SEQUENCE IF NOT EXISTS public.ordenes_entrega_numero_seq;

CREATE TABLE IF NOT EXISTS public.ordenes_entrega (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE DEFAULT (
    'OE-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(nextval('public.ordenes_entrega_numero_seq')::text, 4, '0')
  ),
  centro_id INTEGER NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  estado TEXT NOT NULL DEFAULT 'pendiente_recepcion'
    CHECK (estado IN ('pendiente_recepcion', 'recibida', 'cancelada')),
  observacion TEXT,
  creado_por TEXT,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  recibida_por TEXT,
  recibida_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ordenes_entrega_centro_estado_idx
  ON public.ordenes_entrega (centro_id, estado);

CREATE TABLE IF NOT EXISTS public.ordenes_entrega_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL REFERENCES public.ordenes_entrega(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'medicamento'
    CHECK (tipo IN ('medicamento', 'insumo')),
  item_key TEXT NOT NULL,
  nombre TEXT NOT NULL,
  unidad TEXT,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0)
);

CREATE INDEX IF NOT EXISTS ordenes_entrega_items_orden_idx
  ON public.ordenes_entrega_items (orden_id);

-- 3) Existencias por centro (una fila por producto)
CREATE TABLE IF NOT EXISTS public.almacen_stock (
  clinica_id INTEGER NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'medicamento'
    CHECK (tipo IN ('medicamento', 'insumo')),
  nombre TEXT NOT NULL,
  unidad TEXT,
  cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (clinica_id, item_key)
);

-- 4) Movimientos reportados por el sistema interno (entradas y consumos)
CREATE TABLE IF NOT EXISTS public.almacen_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_id UUID UNIQUE,
  clinica_id INTEGER NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
  item_key TEXT NOT NULL,
  nombre TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  referencia TEXT,
  creado_por TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS almacen_movimientos_centro_idx
  ON public.almacen_movimientos (clinica_id, creado_en DESC);

COMMIT;
