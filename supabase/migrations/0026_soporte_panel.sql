-- ============================================================
-- BnaSalud · Panel de soporte (migración 0026)
-- Espejo de SOLO LECTURA del sistema interno (Postgres local de
-- CITAB) más el estado de cada instalación. Lo llena el agente
-- `scripts/sincronizar_interno.py`, que corre en el servidor
-- interno; nunca se escribe desde la web.
--
-- No guarda datos clínicos ni contraseñas: solo nómina, cuentas
-- (sin hash), logs del sistema y el latido de la instalación.
-- Idempotente: puede re-ejecutarse.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

BEGIN;

-- 1. Nómina del sistema interno (tabla `personal` del Postgres local).
CREATE TABLE IF NOT EXISTS public.interno_personal (
  id INTEGER PRIMARY KEY,
  cedula TEXT,
  nombre TEXT,
  apellido TEXT,
  cargo TEXT,
  cargo_id INTEGER,
  clinica_id INTEGER,
  email TEXT,
  especialidad TEXT,
  estado TEXT,
  status TEXT,
  telefono TEXT,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interno_personal_clinica_idx
  ON public.interno_personal (clinica_id);
CREATE INDEX IF NOT EXISTS interno_personal_cedula_idx
  ON public.interno_personal (cedula);

-- 2. Cuentas del sistema interno. Sin password_hash a propósito: el
--    panel solo consulta el directorio, no replica credenciales.
CREATE TABLE IF NOT EXISTS public.interno_usuarios (
  username TEXT PRIMARY KEY,
  rol TEXT NOT NULL,
  personal_id INTEGER,
  clinica_id INTEGER,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interno_usuarios_rol_idx
  ON public.interno_usuarios (rol);

-- 3. Bitácora de acciones del sistema interno (quién hizo qué).
CREATE TABLE IF NOT EXISTS public.interno_bitacora (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instalacion TEXT NOT NULL DEFAULT 'citab',
  origen_id BIGINT NOT NULL,
  usuario_id INTEGER,
  username TEXT,
  rol TEXT,
  accion TEXT NOT NULL,
  entidad TEXT,
  entidad_id TEXT,
  detalle TEXT,
  creado_en TIMESTAMPTZ NOT NULL,
  sincronizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT interno_bitacora_unico UNIQUE (instalacion, origen_id)
);

CREATE INDEX IF NOT EXISTS interno_bitacora_creado_idx
  ON public.interno_bitacora (creado_en DESC);
CREATE INDEX IF NOT EXISTS interno_bitacora_username_idx
  ON public.interno_bitacora (username);

-- 4. Logs del sistema interno (tabla `system_logs` del Postgres local).
--    `origen_id` es el id local; la clave única evita duplicados si el
--    agente se ejecuta dos veces.
CREATE TABLE IF NOT EXISTS public.interno_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instalacion TEXT NOT NULL DEFAULT 'citab',
  origen_id BIGINT NOT NULL,
  nivel TEXT NOT NULL DEFAULT 'INFO',
  mensaje TEXT NOT NULL,
  fuente TEXT,
  detalle TEXT,
  creado_en TIMESTAMPTZ NOT NULL,
  sincronizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT interno_logs_unico UNIQUE (instalacion, origen_id)
);

CREATE INDEX IF NOT EXISTS interno_logs_creado_idx
  ON public.interno_logs (creado_en DESC);
CREATE INDEX IF NOT EXISTS interno_logs_nivel_idx
  ON public.interno_logs (nivel);

-- 5. Latido de cada instalación interna. El panel lo marca como
--    "en línea" si el último ping tiene menos de 15 minutos.
CREATE TABLE IF NOT EXISTS public.estado_instalaciones (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  centro_id INTEGER,
  version TEXT,
  db_ok BOOLEAN NOT NULL DEFAULT FALSE,
  detalle JSONB,
  ultimo_ping TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

-- Verificación rápida (opcional):
--   SELECT id, nombre, ultimo_ping FROM public.estado_instalaciones;
--   SELECT COUNT(*) FROM public.interno_personal;
