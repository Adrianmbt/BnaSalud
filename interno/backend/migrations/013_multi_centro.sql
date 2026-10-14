-- ============================================================
-- Migración 013: Sistema Multi-Centro BnaSalud
-- Fecha: 2026-09-20
-- Descripción: Tabla de relación empleado-clinica, columnas de
--              tema visual en clinicas, stock por centro, y
--              clinica_id en consultas/usuarios.
-- ============================================================

-- 1. Tabla de relación empleados ↔ centros (many-to-many)
CREATE TABLE IF NOT EXISTS empleado_clinica (
    empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
    clinica_id  INTEGER NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    es_principal BOOLEAN NOT NULL DEFAULT true,
    activo      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (empleado_id, clinica_id)
);
CREATE INDEX IF NOT EXISTS idx_empleado_clinica_clinica ON empleado_clinica(clinica_id);

-- 2. Columnas de identidad visual en clinicas
ALTER TABLE clinicas ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE clinicas ADD COLUMN IF NOT EXISTS color_primary   TEXT DEFAULT '#3B98D4';
ALTER TABLE clinicas ADD COLUMN IF NOT EXISTS color_secondary  TEXT DEFAULT '#1A4B7C';
ALTER TABLE clinicas ADD COLUMN IF NOT EXISTS color_accent     TEXT DEFAULT '#38B000';
ALTER TABLE clinicas ADD COLUMN IF NOT EXISTS color_bg         TEXT DEFAULT '#FFFFFF';
ALTER TABLE clinicas ADD COLUMN IF NOT EXISTS color_surface    TEXT DEFAULT '#F8FAFC';
ALTER TABLE clinicas ADD COLUMN IF NOT EXISTS font_heading     TEXT DEFAULT 'Sora';
ALTER TABLE clinicas ADD COLUMN IF NOT EXISTS font_body        TEXT DEFAULT 'Manrope';

-- 3. clinica_id en usuarios (para usuarios locales)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS clinica_id INTEGER REFERENCES clinicas(id);

-- 4. Stock por centro (inventario descentralizado)
CREATE TABLE IF NOT EXISTS stock_por_centro (
    insumo_id    INTEGER NOT NULL REFERENCES insumos_catalogo(id) ON DELETE CASCADE,
    clinica_id   INTEGER NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    stock_actual INTEGER NOT NULL DEFAULT 0,
    stock_minimo INTEGER NOT NULL DEFAULT 10,
    activo       BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (insumo_id, clinica_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_por_centro_clinica ON stock_por_centro(clinica_id);

-- 5. clinica_id en movimientos_inventario
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS clinica_id INTEGER REFERENCES clinicas(id);

-- 6. clinica_id en consultas (para ver historial por centro)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'consultas') THEN
        ALTER TABLE consultas ADD COLUMN IF NOT EXISTS clinica_id INTEGER REFERENCES clinicas(id);
    END IF;
END $$;

-- 7. Datos iniciales de temas por centro
UPDATE clinicas SET
    color_primary   = '#3B98D4',
    color_secondary  = '#1A4B7C',
    color_accent     = '#38B000',
    color_bg         = '#FFFFFF',
    color_surface    = '#F8FAFC',
    font_heading     = 'Sora',
    font_body        = 'Manrope'
WHERE codigo = 'CITAB';

UPDATE clinicas SET
    color_primary   = '#E91E8C',
    color_secondary  = '#8B1A5C',
    color_accent     = '#FF6B9D',
    color_bg         = '#FFF5F9',
    color_surface    = '#FDF2F8',
    font_heading     = 'Manrope',
    font_body        = 'Manrope'
WHERE codigo = 'CMUJER';

UPDATE clinicas SET
    color_primary   = '#F59E0B',
    color_secondary  = '#B45309',
    color_accent     = '#FCD34D',
    color_bg         = '#FFFBEB',
    color_surface    = '#FEF3C7',
    font_heading     = 'Sora',
    font_body        = 'Manrope'
WHERE codigo = 'CNINOS';

UPDATE clinicas SET
    color_primary   = '#10B981',
    color_secondary  = '#065F46',
    color_accent     = '#34D399',
    color_bg         = '#ECFDF5',
    color_surface    = '#D1FAE5',
    font_heading     = 'Fraunces',
    font_body        = 'Manrope'
WHERE codigo = 'CAPJPF';

UPDATE clinicas SET
    color_primary   = '#8B5CF6',
    color_secondary  = '#5B21B6',
    color_accent     = '#C4B5FD',
    color_bg         = '#F5F3FF',
    color_surface    = '#EDE9FE',
    font_heading     = 'Sora',
    font_body        = 'Manrope'
WHERE codigo = 'CAMAYOR';

UPDATE clinicas SET
    color_primary   = '#EF4444',
    color_secondary  = '#991B1B',
    color_accent     = '#FCA5A5',
    color_bg         = '#FEF2F2',
    color_surface    = '#FEE2E2',
    font_heading     = 'Sora',
    font_body        = 'Manrope'
WHERE codigo = 'OMARUJA';
