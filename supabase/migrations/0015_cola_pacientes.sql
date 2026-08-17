-- Cola de pacientes: check-in y asignación a médicos (Fase 2)
CREATE TABLE IF NOT EXISTS public.cola_pacientes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token VARCHAR(12) NOT NULL UNIQUE,
  paciente_id UUID REFERENCES public.historias_clinicas(id) ON DELETE SET NULL,
  paciente_cedula VARCHAR(20) NOT NULL,
  paciente_nombre VARCHAR(200) NOT NULL,
  clinica_id INTEGER REFERENCES public.clinicas(id) ON DELETE SET NULL,
  especialidad VARCHAR(100),
  motivo VARCHAR(100),
  prioridad SMALLINT NOT NULL DEFAULT 3,
  estado VARCHAR(20) NOT NULL DEFAULT 'EN_ESPERA',
  medico_id INTEGER REFERENCES public.personal(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  iniciado_en TIMESTAMPTZ,
  atendido_en TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS cola_pacientes_estado_idx ON public.cola_pacientes (estado);
CREATE INDEX IF NOT EXISTS cola_pacientes_clinica_idx ON public.cola_pacientes (clinica_id, estado);
