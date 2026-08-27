-- ============================================================
-- BnaSalud · Carga de Médicos y Horarios - CITAB
-- Clínica de los Trabajadores (CITAB) - clinica_id = 2
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ============================================================
-- 1. NUEVAS ESPECIALIDADES
-- ============================================================
SELECT setval('public.especialidades_id_seq', (SELECT COALESCE(MAX(id), 0) FROM public.especialidades));

INSERT INTO public.especialidades (nombre, descripcion, icono) VALUES
  ('Medicina Interna', 'Diagnóstico y tratamiento de enfermedades del adulto.', 'medical_services'),
  ('Epidemiología', 'Vigilancia epidemiológica y salud pública.', 'health_and_safety'),
  ('Oftalmología', 'Diagnóstico y tratamiento de enfermedades oculares.', 'visibility'),
  ('Cirugía de Mano', 'Cirugía reconstructiva y de la mano.', 'front_hand'),
  ('Cirugía General', 'Procedimientos quirúrgicos generales.', 'surgery'),
  ('Gastroenterología', 'Enfermedades del sistema digestivo.', 'digest'),
  ('Ecografía', 'Estudios de imagen por ultrasonido.', 'ultrasound'),
  ('Fisiatría', 'Medicina física y rehabilitación.', 'accessible'),
  ('Terapia de Conducta', 'Terapia psicológica de conducta.', 'psychology_alt'),
  ('Traumatología', 'Lesiones del sistema musculoesquelético.', 'bone'),
  ('Nefrología', 'Enfermedades renales y dialización.', 'water_drop')
ON CONFLICT (nombre) DO NOTHING;

-- ============================================================
-- 2. NUEVOS TURNOS
-- ============================================================
INSERT INTO public.turnos (nombre, hora_inicio, hora_fin) VALUES
  ('Medianoche', '11:00:00', '11:00:00')
ON CONFLICT (nombre) DO NOTHING;

-- ============================================================
-- 3. ÍNDICE ÚNICO para personal_turnos (evitar duplicados)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS personal_turnos_unique
  ON public.personal_turnos (personal_id, clinica_id, turno_id, fecha_asignacion);

-- ============================================================
-- 4. MÉDICOS - Personal en CITAB (clinica_id = 2)
-- ============================================================
INSERT INTO public.personal
  (cedula, nombre, apellido, especialidad, telefono, email, cargo, cargo_id, clinica_id, status, estado)
VALUES
  ('10220380', 'Rosmary del Carmen', 'Sánchez Hernández', 'Medicina Interna', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('15533733', 'Yira del Valle', 'Sandoval Castro', 'Medicina Interna', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('17536936', 'Carlos Eduardo', 'Stanley Medina', 'Medicina Interna', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('17730683', 'Jeferson Jair', 'Salazar Pérez', 'Epidemiología', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('19190300', 'Edmily Eddimar', 'Gómez Ruiz', 'Oftalmología', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('19275238', 'Migdelia Jose', 'Arenas Barrios', 'Oftalmología', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('24829475', 'Carlos Jose', 'Ortiz Pérez', 'Ginecología', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('8266233', 'Jose Arcenio', 'Rivero Brito', 'Ginecología', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('13368680', 'Maira Josefina', 'Marin Báez', 'Pediatría', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('16853320', 'Adriana Cecilia', 'Ramírez Farías', 'Pediatría', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('13316181', 'Chessaysna Ioanna', 'Silva Rodríguez', 'Cirugía de Mano', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('19709911', 'Andres Emilio', 'Laya Hernández', 'Cirugía General', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('19672782', 'Oriana', 'Hernández', 'Cirugía General', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('4361569', 'Xiomara', 'Méndez Márquez', 'Gastroenterología', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('22705329', 'Lucia del Valle', 'Obando Urbáez', 'Ecografía', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('8265857', 'Arcenio Jose', 'Rivero Brito', 'Fisiatría', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('20358120', 'Jhonier', 'Cardona Grajales', 'Terapia de Conducta', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('20874654', 'Andreina', 'Itriago', 'Traumatología', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('20873953', 'Ruth Sarai', 'López Moy', 'Traumatología', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('11423291', 'Eneida del Carmen', 'Tiapa Pérez', 'Nefrología', NULL, NULL,
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'DISPONIBLE', 'ACTIVO')
ON CONFLICT (cedula)
DO UPDATE SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido,
              especialidad = EXCLUDED.especialidad, clinica_id = EXCLUDED.clinica_id,
              cargo = EXCLUDED.cargo, cargo_id = EXCLUDED.cargo_id,
              status = EXCLUDED.status, estado = EXCLUDED.estado;

-- ============================================================
-- 5. ASIGNACIÓN DE TURNOS POR MÉDICO
--    turno_id: 2 = Mañana (7AM-1PM), 3 = Tarde (1PM-7PM)
-- ============================================================
INSERT INTO public.personal_turnos (personal_id, clinica_id, turno_id, fecha_asignacion, observaciones)
SELECT p.id, 2, t.id, CURRENT_DATE, o.dias
FROM (VALUES
  ('10220380', 2, 'Jueves'),
  ('15533733', 2, 'Lunes'),
  ('15533733', 3, 'Miércoles'),
  ('17536936', 3, 'Martes'),
  ('17536936', 3, 'Jueves'),
  ('17730683', 3, 'Lunes'),
  ('17730683', 3, 'Miércoles'),
  ('19190300', 2, 'Martes'),
  ('19190300', 2, 'Viernes'),
  ('19275238', 2, 'Miércoles'),
  ('19275238', 2, 'Jueves'),
  ('24829475', 2, 'Lunes'),
  ('24829475', 3, 'Miércoles'),
  ('8266233', 3, 'Lunes'),
  ('8266233', 3, 'Jueves'),
  ('13368680', 3, 'Martes'),
  ('13368680', 3, 'Miércoles'),
  ('16853320', 2, 'Lunes'),
  ('16853320', 2, 'Viernes'),
  ('13316181', 2, 'Lunes'),
  ('19709911', 3, 'Miércoles'),
  ('19709911', 2, 'Jueves'),
  ('19672782', 3, 'Martes'),
  ('19672782', 2, 'Miércoles'),
  ('4361569', 3, 'Lunes'),
  ('4361569', 3, 'Jueves'),
  ('22705329', 3, 'Martes'),
  ('22705329', 3, 'Viernes'),
  ('8265857', 3, 'Martes'),
  ('8265857', 3, 'Jueves'),
  ('20358120', 2, 'Jueves'),
  ('20358120', 2, 'Viernes'),
  ('20874654', 2, 'Jueves'),
  ('20874654', 2, 'Viernes'),
  ('20873953', 3, 'Miércoles'),
  ('20873953', 3, 'Jueves'),
  ('11423291', 3, 'Martes'),
  ('11423291', 3, 'Viernes')
) AS o(cedula, turno_id, dias)
JOIN public.personal p ON p.cedula = o.cedula
JOIN public.turnos t ON t.id = o.turno_id
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. CUENTAS DE USUARIO (login al sistema)
--    Contraseña por defecto: BnaSalud2026!
-- ============================================================
INSERT INTO public.usuarios (username, password_hash, rol, personal_id, activo)
SELECT
  v.username,
  '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO',
  'medico',
  p.id,
  TRUE
FROM (VALUES
  ('rosmaryhernandez',  '10220380'),
  ('yirasandoval',      '15533733'),
  ('carlosstanley',     '17536936'),
  ('jefersonsalazar',   '17730683'),
  ('edmilygomez',       '19190300'),
  ('migdeliaarenas',    '19275238'),
  ('carlosortiz',       '24829475'),
  ('joserivero',        '8266233'),
  ('mairamarin',        '13368680'),
  ('adrianaramirez',    '16853320'),
  ('chessaysnasilva',   '13316181'),
  ('andreslaya',        '19709911'),
  ('orianahernandez',   '19672782'),
  ('xiomaramendez',     '4361569'),
  ('luciaobando',       '22705329'),
  ('arcenorivero',      '8265857'),
  ('jhoniercardona',    '20358120'),
  ('andreinaitriago',   '20874654'),
  ('ruthlopez',         '20873953'),
  ('eneidatiapa',       '11423291')
) AS v(username, cedula)
JOIN public.personal p ON p.cedula = v.cedula
ON CONFLICT (username) DO UPDATE SET
  rol = EXCLUDED.rol, personal_id = EXCLUDED.personal_id, activo = EXCLUDED.activo;

-- ============================================================
-- RESUMEN DE CARGA
-- ============================================================
SELECT 'Médicos cargados en CITAB:' AS info, count(*) AS total
FROM public.personal
WHERE clinica_id = 2 AND cargo = 'Médico'
UNION ALL
SELECT 'Turnos asignados:', count(*)
FROM public.personal_turnos
WHERE clinica_id = 2
UNION ALL
SELECT 'Especialidades totales:', count(*)
FROM public.especialidades;
