-- ─── Migración: WhatsApp — Tabla de mensajes y teléfonos ───

-- Tabla de registro de mensajes de WhatsApp
CREATE TABLE IF NOT EXISTS mensajes_whatsapp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destinatario_cedula VARCHAR(20),
    destinatario_nombre TEXT,
    destinatario_telefono VARCHAR(20),
    mensaje TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    evolution_message_id VARCHAR(100),
    error_detalle TEXT,
    enviado_en TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_mensajes_whatsapp_cedula
    ON mensajes_whatsapp (destinatario_cedula);
CREATE INDEX IF NOT EXISTS idx_mensajes_whatsapp_estado
    ON mensajes_whatsapp (estado);
CREATE INDEX IF NOT EXISTS idx_mensajes_whatsapp_created
    ON mensajes_whatsapp (created_at DESC);

-- Agregar campo de teléfono a empleados (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'empleados' AND column_name = 'telefono'
    ) THEN
        ALTER TABLE empleados ADD COLUMN telefono VARCHAR(20);
    END IF;
END $$;

-- Agregar campo de teléfono a beneficiarios (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'beneficiarios' AND column_name = 'telefono'
    ) THEN
        ALTER TABLE beneficiarios ADD COLUMN telefono VARCHAR(20);
    END IF;
END $$;
