-- ============================================================
-- BnaSalud · Rol jefe de farmacia (migración 0019)
-- El encargado/jefe de farmacia administra el stock (inventario,
-- alertas y reposiciones). El farmacéutico atiende el despacho.
-- Idempotente: puede re-ejecutarse sin efecto secundario.
-- ============================================================

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('superusuario','medico','jefe_farmacia','farmaceutico','enfermero','paciente'));
