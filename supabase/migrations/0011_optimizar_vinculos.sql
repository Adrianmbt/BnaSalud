-- ============================================================
-- BnaSalud · Optimización de vínculos e índices (migración 0011)
-- Objetivo: consolidar la integridad referencial que la semilla y
-- el backend asumen (cargos, clínicas, especialidades, medicamentos)
-- de forma 100% idempotente y segura sobre datos existentes.
--
--   • Dedupe de stock_clinica + UNIQUE (clinica_id, medicamento_id)
--     para permitir upserts ON CONFLICT desde la semilla.
--   • FKs faltantes (NOT VALID para no bloquear si hay huérfanos).
--   • Índices de las consultas más frecuentes del backend.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. STOCK_CLINICA: eliminar duplicados y asegurar UNIQUE por clínica+medicamento
DELETE FROM public.stock_clinica a
USING public.stock_clinica b
WHERE a.clinica_id = b.clinica_id
  AND a.medicamento_id = b.medicamento_id
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS stock_clinica_clinica_medicamento_uq
  ON public.stock_clinica (clinica_id, medicamento_id);
CREATE INDEX IF NOT EXISTS idx_stock_clinica_medicamento
  ON public.stock_clinica (medicamento_id);
CREATE INDEX IF NOT EXISTS idx_stock_clinica_clinica
  ON public.stock_clinica (clinica_id);

-- 2. CARGOS: descripción del cargo para RRHH
ALTER TABLE public.cargos ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- 3. FKs faltantes (idempotente: se verifican por nombre de constraint)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personal_cargo_id_fkey') THEN
    ALTER TABLE public.personal
      ADD CONSTRAINT personal_cargo_id_fkey FOREIGN KEY (cargo_id)
      REFERENCES public.cargos (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personal_clinica_id_fkey') THEN
    ALTER TABLE public.personal
      ADD CONSTRAINT personal_clinica_id_fkey FOREIGN KEY (clinica_id)
      REFERENCES public.clinicas (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citas_centro_id_fkey') THEN
    ALTER TABLE public.citas
      ADD CONSTRAINT citas_centro_id_fkey FOREIGN KEY (centro_id)
      REFERENCES public.clinicas (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citas_especialidad_id_fkey') THEN
    ALTER TABLE public.citas
      ADD CONSTRAINT citas_especialidad_id_fkey FOREIGN KEY (especialidad_id)
      REFERENCES public.especialidades (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recetas_medico_id_fkey') THEN
    ALTER TABLE public.recetas
      ADD CONSTRAINT recetas_medico_id_fkey FOREIGN KEY (medico_id)
      REFERENCES public.personal (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recetas_clinica_id_fkey') THEN
    ALTER TABLE public.recetas
      ADD CONSTRAINT recetas_clinica_id_fkey FOREIGN KEY (clinica_id)
      REFERENCES public.clinicas (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'receta_detalles_medicamento_id_fkey') THEN
    ALTER TABLE public.receta_detalles
      ADD CONSTRAINT receta_detalles_medicamento_id_fkey FOREIGN KEY (medicamento_id)
      REFERENCES public.inventario_medicamentos (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'receta_detalles_receta_id_fkey') THEN
    ALTER TABLE public.receta_detalles
      ADD CONSTRAINT receta_detalles_receta_id_fkey FOREIGN KEY (receta_id)
      REFERENCES public.recetas (id) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consultas_medico_id_fkey') THEN
    ALTER TABLE public.consultas
      ADD CONSTRAINT consultas_medico_id_fkey FOREIGN KEY (medico_id)
      REFERENCES public.personal (id) NOT VALID;
  END IF;
END $$;

-- 4. Índices de las consultas más frecuentes del backend
CREATE INDEX IF NOT EXISTS idx_personal_clinica ON public.personal (clinica_id);
CREATE INDEX IF NOT EXISTS idx_personal_status ON public.personal (status);
CREATE INDEX IF NOT EXISTS idx_personal_cargo_id ON public.personal (cargo_id);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON public.citas (estado);
CREATE INDEX IF NOT EXISTS idx_recetas_estado ON public.recetas (estado);
CREATE INDEX IF NOT EXISTS idx_recetas_clinica ON public.recetas (clinica_id);
CREATE INDEX IF NOT EXISTS idx_recetas_medico ON public.recetas (medico_id);
CREATE INDEX IF NOT EXISTS idx_receta_detalles_medicamento ON public.receta_detalles (medicamento_id);
CREATE INDEX IF NOT EXISTS idx_consultas_medico ON public.consultas (medico_id);

-- 5. UNIQUE en catálogos para permitir upserts ON CONFLICT (semilla)
CREATE UNIQUE INDEX IF NOT EXISTS cargos_nombre_uq ON public.cargos (nombre);
CREATE UNIQUE INDEX IF NOT EXISTS turnos_nombre_uq ON public.turnos (nombre);
CREATE UNIQUE INDEX IF NOT EXISTS clinicas_codigo_uq ON public.clinicas (codigo);
