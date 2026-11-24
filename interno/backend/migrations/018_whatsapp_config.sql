-- 018_whatsapp_config.sql
-- Configuración de Evolution API por clínica
-- Permite escalar de CITAB (piloto) a múltiples clínicas

-- Tabla de configuración de WhatsApp por clínica
CREATE TABLE IF NOT EXISTS configuracion_whatsapp (
    id SERIAL PRIMARY KEY,
    clinica_id INTEGER NOT NULL UNIQUE REFERENCES clinicas(id) ON DELETE CASCADE,
    instance_name VARCHAR(100) NOT NULL,
    api_url TEXT NOT NULL DEFAULT 'http://localhost:8080',
    api_key TEXT NOT NULL,
    telefono_origen VARCHAR(20) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_por INTEGER REFERENCES personal(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_config_whatsapp_clinica ON configuracion_whatsapp (clinica_id);
CREATE INDEX IF NOT EXISTS idx_config_whatsapp_activo ON configuracion_whatsapp (activo);

-- Insertar configuración por defecto para CITAB (clinica_id = 1)
-- REEMPLAZAR LOS VALORES CON SUS CREDENCIALES REALES
INSERT INTO configuracion_whatsapp 
    (clinica_id, instance_name, api_url, api_key, telefono_origen, activo)
SELECT 
    1, 'bnasalud_citab', 'http://localhost:8080', 'TU-EVOLUTION-API-KEY-AQUI', '584120000000', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM configuracion_whatsapp WHERE clinica_id = 1
);

-- Comprobación: debe devolver 1 fila si está configurado CITAB
SELECT 
    c.id,
    cl.nombre AS clinica,
    c.instance_name,
    c.telefono_origen,
    c.activo
FROM configuracion_whatsapp c
JOIN clinicas cl ON cl.id = c.clinica_id
ORDER BY c.clinica_id;
