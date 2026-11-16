-- ============================================================
-- BnaSalud · Roles globales y panel institucional (migración 0024)
-- Habilita las cuentas globales del portal público:
--   admin_sistemas → encargado de informática y sistemas (oswaldo, adrianbello)
--   director       → director(a) del Instituto de Salud (director)
--
-- Se copian las cuentas del sistema interno con sus hashes bcrypt, tal como
-- están en el volcado local. No se guardan contraseñas en texto plano.
-- Idempotente: puede re-ejecutarse sin efecto secundario.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

BEGIN;

-- 1. Ampliar el catálogo de roles. Se conservan los roles internos que
--    ya existen en la base para no romper filas históricas.
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN (
    'superusuario',
    'medico',
    'jefe_farmacia',
    'farmaceutico',
    'enfermero',
    'paciente',
    'recepcionista',
    'medico_emergencia',
    'historias_medicas',
    'admin_sistemas',
    'director'
  ));

-- 2. Los roles globales no dependen de una ficha asistencial ni de una
--    historia clínica. El resto sigue exigiendo vínculo, como antes.
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_vinculo_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_vinculo_check
  CHECK (
    personal_id IS NOT NULL
    OR paciente_id IS NOT NULL
    OR rol IN ('admin_sistemas', 'director')
  );

-- 3. Fichas de personal para mostrar nombre y cargo en el panel.
--    Los IDs 998/999 son los mismos que usa el sistema interno.
INSERT INTO public.personal (id, cedula, nombre, apellido, cargo, status, estado)
VALUES
  (999, 'V-00000001', 'Oswaldo', 'García', 'Encargado de Informática y Sistemas', 'DISPONIBLE', 'ACTIVO'),
  (998, 'V-00000002', 'Adolfo', 'Farías', 'Presidente del Instituto de Salud', 'DISPONIBLE', 'ACTIVO')
ON CONFLICT (id) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      apellido = EXCLUDED.apellido,
      cargo = EXCLUDED.cargo,
      estado = 'ACTIVO';

-- 4. Cuentas globales. La contraseña se conserva si la cuenta ya existía
--    (no se sobrescribe un cambio hecho por el usuario).
INSERT INTO public.usuarios (username, password_hash, rol, personal_id, activo)
VALUES
  (
    'oswaldo',
    '$2b$12$N9BjKVvAriIFOzfFYvwvyOQZHwzfFDRWA053oRvV9gioSrC/U7Pkq',
    'admin_sistemas',
    999,
    TRUE
  ),
  (
    'director',
    '$2b$12$3A/8fnibG9u0Hi1PET/LwuwCXgr/VQsmby.KCByxVYValykFOCZ9i',
    'director',
    998,
    TRUE
  ),
  (
    'adrianbello',
    '$2b$12$AVeSrtoQ9i5uGl2bXcZPiO0aIbICDothPOV5qfYKToSCB2RSokSRC',
    'admin_sistemas',
    NULL,
    TRUE
  )
ON CONFLICT (username) DO UPDATE
  SET rol = EXCLUDED.rol,
      personal_id = EXCLUDED.personal_id,
      activo = TRUE;

COMMIT;

-- Verificación rápida (opcional):
--   SELECT username, rol, personal_id, activo FROM public.usuarios
--   WHERE rol IN ('admin_sistemas', 'director');
