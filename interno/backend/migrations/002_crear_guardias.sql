-- Migration: Crear tabla guardias para gestion de turnos de emergencia
-- Fecha: 2026-09-11

CREATE TABLE IF NOT EXISTS guardias (
    id              SERIAL PRIMARY KEY,
    medico_id       INTEGER NOT NULL REFERENCES personal(id),
    clinica_id      INTEGER NOT NULL REFERENCES clinicas(id),
    turno_id        INTEGER NOT NULL REFERENCES turnos(id),
    fecha           DATE NOT NULL,
    hora_inicio     TIMESTAMPTZ NOT NULL DEFAULT now(),
    hora_fin        TIMESTAMPTZ,
    estado          TEXT NOT NULL DEFAULT 'ACTIVA'
                    CHECK (estado IN ('ACTIVA', 'FINALIZADA', 'REEMPLAZADA')),
    registrado_por  INTEGER REFERENCES personal(id),
    observaciones   TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Indices para busquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_guardias_activas
    ON guardias (medico_id, clinica_id, estado)
    WHERE estado = 'ACTIVA';

CREATE INDEX IF NOT EXISTS idx_guardias_fecha
    ON guardias (fecha, clinica_id);

-- Datos semilla: guardia de ejemplo para pruebas
INSERT INTO guardias (medico_id, clinica_id, turno_id, fecha, estado)
VALUES (2, 2, 1, CURRENT_DATE, 'ACTIVA')
ON CONFLICT DO NOTHING;

