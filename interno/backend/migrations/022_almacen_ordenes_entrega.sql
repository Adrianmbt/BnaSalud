-- 022_almacen_ordenes_entrega.sql
-- Rol Jefe de Almacén (uso exclusivo del sistema interno), órdenes de entrega
-- despachadas desde el portal web y el inventario propio de cada centro.
--
-- Flujo: el Director genera una Orden de Entrega en el portal web (Supabase)
-- en estado 'pendiente_recepcion' y el Jefe de Almacén del centro la recibe en
-- el sistema interno, lo que suma las cantidades a `almacen_stock` y deja el
-- movimiento registrado en la cola de sincronización (`almacen_sync_outbox`).
-- Migración manual e idempotente (sin BEGIN/COMMIT para aplicar_sql.py).

-- 1) Habilitar el rol en usuarios
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (
    rol = ANY (ARRAY[
        'recepcionista', 'medico_emergencia', 'medico', 'jefe_farmacia',
        'farmaceutico', 'admin_sistemas', 'director', 'superusuario',
        'enfermero', 'paciente', 'historias_medicas', 'recursos_humanos',
        'jefe_almacen'
    ]::text[])
);

-- 2) Órdenes de entrega recibidas desde el portal web
CREATE TABLE IF NOT EXISTS ordenes_entrega (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    remota_id text UNIQUE,
    numero text,
    centro_id integer NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    estado text NOT NULL DEFAULT 'pendiente_recepcion'
        CHECK (estado IN ('pendiente_recepcion', 'recibida', 'cancelada')),
    observacion text,
    creada_por text,
    creada_en timestamptz,
    recibida_por text,
    recibida_en timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ordenes_entrega_centro_estado
    ON ordenes_entrega (centro_id, estado);

CREATE TABLE IF NOT EXISTS ordenes_entrega_items (
    id serial PRIMARY KEY,
    orden_id uuid NOT NULL REFERENCES ordenes_entrega(id) ON DELETE CASCADE,
    tipo text NOT NULL DEFAULT 'medicamento'
        CHECK (tipo IN ('medicamento', 'insumo')),
    item_key text NOT NULL,
    nombre text NOT NULL,
    unidad text,
    cantidad integer NOT NULL CHECK (cantidad > 0),
    cantidad_recibida integer
);

CREATE INDEX IF NOT EXISTS idx_ordenes_entrega_items_orden
    ON ordenes_entrega_items (orden_id);

-- 3) Inventario propio del centro (una fila por producto)
CREATE TABLE IF NOT EXISTS almacen_stock (
    clinica_id integer NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    item_key text NOT NULL,
    tipo text NOT NULL DEFAULT 'medicamento'
        CHECK (tipo IN ('medicamento', 'insumo')),
    nombre text NOT NULL,
    unidad text,
    cantidad integer NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    stock_minimo integer NOT NULL DEFAULT 5,
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (clinica_id, item_key)
);

-- 4) Movimientos (entradas por recepción y salidas por consumo diario)
CREATE TABLE IF NOT EXISTS almacen_movimientos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clinica_id integer NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    tipo text NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
    item_key text NOT NULL,
    nombre text NOT NULL,
    cantidad integer NOT NULL,
    referencia text,
    usuario text,
    origen text NOT NULL DEFAULT 'interno',
    sincronizado boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_almacen_movimientos_centro
    ON almacen_movimientos (clinica_id, created_at DESC);

-- 5) Cola de sincronización (soporta trabajar sin internet)
CREATE TABLE IF NOT EXISTS almacen_sync_outbox (
    id bigserial PRIMARY KEY,
    entidad text NOT NULL,
    operacion text NOT NULL,
    payload jsonb NOT NULL,
    intentos integer NOT NULL DEFAULT 0,
    ultimo_error text,
    enviado_en timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_almacen_outbox_pendiente
    ON almacen_sync_outbox (enviado_en) WHERE enviado_en IS NULL;
