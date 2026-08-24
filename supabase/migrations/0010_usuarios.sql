-- ============================================================
-- BnaSalud · Usuarios del sistema (migración 0010)
-- Cuentas con rol para acceder a los módulos de la plataforma:
--   superusuario  → administración global
--   medico        → módulo de consultas (Doctores)
--   jefe_farmacia → encargado del stock de farmacia
--   farmaceutico  → módulo de despacho (Farmacia)
--   enfermero     → apoyo asistencial
--   paciente      → portal del paciente
-- Cada cuenta se vincula a `personal` (staff) o a
-- `historias_clinicas` (pacientes). Ejecutar en el SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('superusuario','medico','jefe_farmacia','farmaceutico','enfermero','paciente')),
  personal_id INTEGER REFERENCES public.personal(id),
  paciente_id UUID REFERENCES public.historias_clinicas(id),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT usuarios_vinculo_check CHECK (personal_id IS NOT NULL OR paciente_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON public.usuarios (rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_personal ON public.usuarios (personal_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_paciente ON public.usuarios (paciente_id);
