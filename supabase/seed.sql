-- ============================================================
-- BnaSalud · Semilla de datos completa y vinculada (seed.sql)
-- ------------------------------------------------------------------
-- Requisitos: aplicar previamente las migraciones 0001 → 0011
--   (incluye: cargos, clínicas, usuarios, índices de vínculos).
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
--
-- 100% idempotente: puede re-ejecutarse (upserts por clave natural).
-- Contraseña por defecto de todos los usuarios: BnaSalud2026!
--   (hash bcrypt generado con cost 12; cambiar en producción).
-- ============================================================

-- ============================================================
-- 1. CARGOS (RRHH)
-- ============================================================
INSERT INTO public.cargos (id, nombre, departamento, descripcion) VALUES
  (1, 'Superusuario', 'Administración', 'Administración global del sistema'),
  (2, 'Médico', 'Asistencial', 'Atención y consultas médicas'),
  (3, 'Farmacéutico', 'Farmacia', 'Despacho y control de inventario'),
  (4, 'Enfermero', 'Asistencial', 'Apoyo asistencial y triaje')
ON CONFLICT (nombre) DO UPDATE SET departamento = EXCLUDED.departamento, descripcion = EXCLUDED.descripcion;

-- ============================================================
-- 2. CLÍNICAS / CENTROS DE SALUD (5 centros de la red municipal)
-- ============================================================
INSERT INTO public.clinicas (id, nombre, codigo, parroquia, direccion, activo) VALUES
  (1, 'Clínica del Niño', 'CLN-NINO', 'El Carmen', 'Barcelona, Anzoátegui', TRUE),
  (2, 'Clínica de los Trabajadores (CITAB)', 'CLN-CITAB', 'El Carmen', 'Barcelona, Anzoátegui', TRUE),
  (3, 'Clínica de la Mujer', 'CLN-MUJER', 'San Cristóbal', 'Barcelona, Anzoátegui', TRUE),
  (4, 'Centro Oncológico Municipal', 'CLN-ONCO', 'El Carmen', 'Barcelona, Anzoátegui', TRUE),
  (5, 'Jornadas de Salud Móviles', 'CLN-JORNADAS', 'General', 'Atención Itinerante - Municipio Simón Bolívar', TRUE)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, parroquia = EXCLUDED.parroquia, direccion = EXCLUDED.direccion, activo = EXCLUDED.activo;

-- ============================================================
-- 3. ESPECIALIDADES
-- ============================================================
INSERT INTO public.especialidades (id, nombre, descripcion, icono) VALUES
  (1, 'Medicina General', 'Medicina de familia y prevención.', 'stethoscope'),
  (2, 'Pediatría', 'Cuidado integral para los más pequeños.', 'child_care'),
  (3, 'Ginecología', 'Atención ginecológica y obstetricia.', 'female'),
  (4, 'Cardiología', 'Diagnóstico y tratamiento cardiovascular.', 'cardiology'),
  (5, 'Odontología', 'Salud bucodental avanzada y estética.', 'dentistry'),
  (6, 'Psicología', 'Atención en salud mental y bienestar.', 'psychology'),
  (7, 'Oncología', 'Diagnóstico y tratamiento del cáncer.', 'radiology')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, icono = EXCLUDED.icono;

-- ============================================================
-- 4. TURNOS (RRHH)
-- ============================================================
INSERT INTO public.turnos (id, nombre, hora_inicio, hora_fin) VALUES
  (1, 'Guardia 24h', '00:00:00', '23:59:00'),
  (2, 'Mañana', '07:00:00', '13:00:00'),
  (3, 'Tarde', '13:00:00', '19:00:00')
ON CONFLICT (nombre) DO UPDATE SET hora_inicio = EXCLUDED.hora_inicio, hora_fin = EXCLUDED.hora_fin;

-- ============================================================
-- 5. PERSONAL (RRHH): superusuario, doctores, 1 farmacéutico por
--    centro, enfermeros. cargo_id se resuelve por nombre del cargo.
-- ============================================================
INSERT INTO public.personal
  (cedula, nombre, apellido, especialidad, telefono, email, cargo, cargo_id, clinica_id, status, estado) VALUES
  -- Superusuario
  ('99990010', 'Adrián', 'Bello', 'Administración', '+58 281 000 0001', 'admin@bnasalud.gob.ve',
   'Superusuario', (SELECT id FROM public.cargos WHERE nombre = 'Superusuario'), 2, 'DISPONIBLE', 'ACTIVO'),
  -- Médicos (varios, distribuidos por centro)
  ('11111111', 'Antonio', 'Valera', 'Cardiología', '+58 414 123 4567', 'antonio.valera@bnasalud.gob.ve',
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 2, 'EN_GUARDIA', 'ACTIVO'),
  ('22222222', 'María', 'González', 'Pediatría', '+58 414 222 3344', 'maria.gonzalez@bnasalud.gob.ve',
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 1, 'DISPONIBLE', 'ACTIVO'),
  ('33333333', 'Luisa', 'Pérez', 'Ginecología', '+58 414 555 6677', 'luisa.perez@bnasalud.gob.ve',
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 3, 'DISPONIBLE', 'ACTIVO'),
  ('55555555', 'Pedro', 'Sánchez', 'Medicina General', '+58 414 111 2233', 'pedro.sanchez@bnasalud.gob.ve',
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 4, 'DISPONIBLE', 'ACTIVO'),
  ('66666666', 'Elena', 'Gómez', 'Oncología', '+58 414 444 5566', 'elena.gomez@bnasalud.gob.ve',
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 4, 'DISPONIBLE', 'ACTIVO'),
  ('77777777', 'Ramón', 'Díaz', 'Medicina General', '+58 414 777 8899', 'ramon.diaz@bnasalud.gob.ve',
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 5, 'DISPONIBLE', 'ACTIVO'),
  ('88888888', 'Jorge', 'Blanco', 'Medicina General', '+58 414 333 4455', 'jorge.blanco@bnasalud.gob.ve',
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 1, 'DISPONIBLE', 'ACTIVO'),
  ('88888889', 'Sonia', 'Ramos', 'Pediatría', '+58 414 666 7788', 'sonia.ramos@bnasalud.gob.ve',
   'Médico', (SELECT id FROM public.cargos WHERE nombre = 'Médico'), 5, 'DISPONIBLE', 'ACTIVO'),
  -- Farmacéuticos (1 por centro de salud)
  ('99990001', 'Carlos', 'Pereira', 'Farmacia', '+58 412 200 0001', 'carlos.pereira@bnasalud.gob.ve',
   'Farmacéutico', (SELECT id FROM public.cargos WHERE nombre = 'Farmacéutico'), 1, 'DISPONIBLE', 'ACTIVO'),
  ('99990002', 'María', 'Torres', 'Farmacia', '+58 412 200 0002', 'maria.torres@bnasalud.gob.ve',
   'Farmacéutico', (SELECT id FROM public.cargos WHERE nombre = 'Farmacéutico'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('99990003', 'Luis', 'Hernández', 'Farmacia', '+58 412 200 0003', 'luis.hernandez@bnasalud.gob.ve',
   'Farmacéutico', (SELECT id FROM public.cargos WHERE nombre = 'Farmacéutico'), 3, 'DISPONIBLE', 'ACTIVO'),
  ('99990004', 'Ana', 'Castillo', 'Farmacia', '+58 412 200 0004', 'ana.castillo@bnasalud.gob.ve',
   'Farmacéutico', (SELECT id FROM public.cargos WHERE nombre = 'Farmacéutico'), 4, 'DISPONIBLE', 'ACTIVO'),
  ('99990005', 'Rosa', 'Medina', 'Farmacia', '+58 412 200 0005', 'rosa.medina@bnasalud.gob.ve',
   'Farmacéutico', (SELECT id FROM public.cargos WHERE nombre = 'Farmacéutico'), 5, 'DISPONIBLE', 'ACTIVO'),
  -- Enfermeros
  ('44444444', 'Carlos', 'Ruiz', 'Enfermería', '+58 414 888 9900', 'carlos.ruiz@bnasalud.gob.ve',
   'Enfermero', (SELECT id FROM public.cargos WHERE nombre = 'Enfermero'), 2, 'DISPONIBLE', 'ACTIVO'),
  ('44444445', 'Laura', 'Mendoza', 'Enfermería', '+58 414 999 0011', 'laura.mendoza@bnasalud.gob.ve',
   'Enfermero', (SELECT id FROM public.cargos WHERE nombre = 'Enfermero'), 1, 'DISPONIBLE', 'ACTIVO')
ON CONFLICT (cedula) WHERE cedula IS NOT NULL
DO UPDATE SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido, especialidad = EXCLUDED.especialidad,
              telefono = EXCLUDED.telefono, email = EXCLUDED.email, cargo = EXCLUDED.cargo,
              cargo_id = EXCLUDED.cargo_id, clinica_id = EXCLUDED.clinica_id,
              status = EXCLUDED.status, estado = EXCLUDED.estado;

-- Respaldo: normalizar cargo_id en personal ya existente
UPDATE public.personal p
SET cargo_id = c.id
FROM public.cargos c
WHERE p.cargo_id IS NULL AND lower(p.cargo) = lower(c.nombre);

-- ============================================================
-- 6. PACIENTES (historias_clinicas)
-- ============================================================
INSERT INTO public.historias_clinicas
  (tipo_cedula, cedula, nombre_completo, fecha_nacimiento, telefono, email,
   tipo_sangre, antecedentes_medicos, alergias, numero_historia) VALUES
  ('V', '18234567', 'Carlos Mendoza', '1980-05-12', '04141234567', 'carlos.mendoza@example.com',
   'O+', '["Hipertensión"]'::jsonb, '["Penicilina"]'::jsonb, 'HIS-V18234567'),
  ('V', '12345678', 'María Rodríguez', '1985-03-22', '04141337899', 'maria.rodriguez@example.com',
   'A+', '["Asma"]'::jsonb, '[]'::jsonb, 'HIS-V12345678'),
  ('V', '98765432', 'Juan Pérez', '1990-11-02', '04241411122', 'juan.perez@example.com',
   'B-', '[]'::jsonb, '["Sulfamidas"]'::jsonb, 'HIS-V98765432'),
  ('V', '87654321', 'Ana Rodríguez', '1995-07-15', '04241556677', 'ana.rodriguez@example.com',
   'O-', '["Diabetes gestacional"]'::jsonb, '[]'::jsonb, 'HIS-V87654321'),
  ('V', '76543210', 'Pedro García', '1978-01-30', '04161788990', 'pedro.garcia@example.com',
   'AB+', '["Dislipidemia"]'::jsonb, '[]'::jsonb, 'HIS-V76543210')
ON CONFLICT (cedula) DO UPDATE SET
  tipo_cedula = EXCLUDED.tipo_cedula, nombre_completo = EXCLUDED.nombre_completo,
  fecha_nacimiento = EXCLUDED.fecha_nacimiento, telefono = EXCLUDED.telefono,
  email = EXCLUDED.email, tipo_sangre = EXCLUDED.tipo_sangre,
  antecedentes_medicos = EXCLUDED.antecedentes_medicos, alergias = EXCLUDED.alergias,
  numero_historia = EXCLUDED.numero_historia;

-- ============================================================
-- 7. USUARIOS DEL SISTEMA (migración 0010)
--    Superusuario + médicos + 1 farmacéutico por centro + pacientes.
--    Username por defecto: primera letra del nombre + apellido (min).
-- ============================================================
INSERT INTO public.usuarios (username, password_hash, rol, personal_id, paciente_id, activo) VALUES
  ('abello',  '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'superusuario',
   (SELECT id FROM public.personal WHERE cedula = '99990010'), NULL, TRUE),
  -- Médicos
  ('avalera',  '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'medico',
   (SELECT id FROM public.personal WHERE cedula = '11111111'), NULL, TRUE),
  ('mgonzalez', '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'medico',
   (SELECT id FROM public.personal WHERE cedula = '22222222'), NULL, TRUE),
  ('lperez',   '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'medico',
   (SELECT id FROM public.personal WHERE cedula = '33333333'), NULL, TRUE),
  ('psanchez', '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'medico',
   (SELECT id FROM public.personal WHERE cedula = '55555555'), NULL, TRUE),
  ('egomez',   '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'medico',
   (SELECT id FROM public.personal WHERE cedula = '66666666'), NULL, TRUE),
  ('rdiaz',    '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'medico',
   (SELECT id FROM public.personal WHERE cedula = '77777777'), NULL, TRUE),
  ('jblanco',  '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'medico',
   (SELECT id FROM public.personal WHERE cedula = '88888888'), NULL, TRUE),
  ('sramos',   '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'medico',
   (SELECT id FROM public.personal WHERE cedula = '88888889'), NULL, TRUE),
  -- Farmacéuticos (1 por centro)
  ('cpereira', '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'farmaceutico',
   (SELECT id FROM public.personal WHERE cedula = '99990001'), NULL, TRUE),
  ('mtorres',  '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'farmaceutico',
   (SELECT id FROM public.personal WHERE cedula = '99990002'), NULL, TRUE),
  ('lhernandez','$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'farmaceutico',
   (SELECT id FROM public.personal WHERE cedula = '99990003'), NULL, TRUE),
  ('acastillo','$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'farmaceutico',
   (SELECT id FROM public.personal WHERE cedula = '99990004'), NULL, TRUE),
  ('rmedina',  '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'farmaceutico',
   (SELECT id FROM public.personal WHERE cedula = '99990005'), NULL, TRUE),
  -- Enfermeros
  ('cruiz',    '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'enfermero',
   (SELECT id FROM public.personal WHERE cedula = '44444444'), NULL, TRUE),
  ('lmendoza', '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'enfermero',
   (SELECT id FROM public.personal WHERE cedula = '44444445'), NULL, TRUE),
  -- Pacientes (portal del paciente)
  ('cmendoza', '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'paciente', NULL,
   (SELECT id FROM public.historias_clinicas WHERE cedula = '18234567'), TRUE),
  ('mrodriguez','$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'paciente', NULL,
   (SELECT id FROM public.historias_clinicas WHERE cedula = '12345678'), TRUE),
  ('jperez',   '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'paciente', NULL,
   (SELECT id FROM public.historias_clinicas WHERE cedula = '98765432'), TRUE),
  ('arodriguez','$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'paciente', NULL,
   (SELECT id FROM public.historias_clinicas WHERE cedula = '87654321'), TRUE),
  ('pgarcia',  '$2b$12$oV8tx83yd/n/1LOhB6.7q.t7Oi3Q2Hwtli5B.IplL/hxdlugMfyWO', 'paciente', NULL,
   (SELECT id FROM public.historias_clinicas WHERE cedula = '76543210'), TRUE)
ON CONFLICT (username) DO UPDATE SET
  rol = EXCLUDED.rol, personal_id = EXCLUDED.personal_id,
  paciente_id = EXCLUDED.paciente_id, activo = EXCLUDED.activo;

-- ============================================================
-- 8. MEDICAMENTOS (inventario_medicamentos)
-- ============================================================
INSERT INTO public.inventario_medicamentos
  (nombre, presentacion, concentracion, categoria, stock_actual, stock_minimo, unidad, unidad_medida, activo) VALUES
  ('Amoxicilina 500mg', 'Cápsula', '500 mg', 'Antibiótico', 120, 30, 'unidad', 'unidad', TRUE),
  ('Paracetamol 500mg', 'Tableta', '500 mg', 'Analgésico', 300, 50, 'unidad', 'unidad', TRUE),
  ('Ibuprofeno 400mg', 'Tableta', '400 mg', 'Antiinflamatorio', 200, 40, 'unidad', 'unidad', TRUE),
  ('Enalapril 10mg', 'Tableta', '10 mg', 'Antihipertensivo', 90, 20, 'unidad', 'unidad', TRUE),
  ('Metformina 850mg', 'Tableta', '850 mg', 'Antidiabético', 150, 30, 'unidad', 'unidad', TRUE),
  ('Salbutamol 100mcg', 'Inhalador', '100 mcg', 'Broncodilatador', 40, 10, 'inhalador', 'inhalador', TRUE),
  ('Losartán 50mg', 'Tableta', '50 mg', 'Antihipertensivo', 110, 25, 'unidad', 'unidad', TRUE),
  ('Vitamina C 500mg', 'Tableta', '500 mg', 'Suplemento', 500, 80, 'unidad', 'unidad', TRUE)
ON CONFLICT (nombre) DO UPDATE SET
  presentacion = EXCLUDED.presentacion, concentracion = EXCLUDED.concentracion,
  categoria = EXCLUDED.categoria, stock_actual = EXCLUDED.stock_actual,
  stock_minimo = EXCLUDED.stock_minimo, unidad = EXCLUDED.unidad,
  unidad_medida = EXCLUDED.unidad_medida, activo = EXCLUDED.activo;

-- ============================================================
-- 9. STOCK POR CLÍNICA (stock_clinica)
--    Una fila por (clínica × medicamento). Cantidad derivada del
--    stock global repartido entre los 5 centros.
-- ============================================================
INSERT INTO public.stock_clinica (clinica_id, medicamento_id, cantidad_actual, lote)
SELECT
  cl.id,
  m.id,
  GREATEST(floor(m.stock_actual / 5)::int + ((cl.id * 7 + m.id * 3) % 5), 2) AS cantidad_actual,
  'LOTE-' || cl.codigo || '-' || m.id AS lote
FROM public.clinicas cl
CROSS JOIN public.inventario_medicamentos m
ON CONFLICT (clinica_id, medicamento_id)
DO UPDATE SET cantidad_actual = EXCLUDED.cantidad_actual, lote = EXCLUDED.lote;

-- ============================================================
-- 10. CITAS (vincular paciente y centro)
-- ============================================================
INSERT INTO public.citas
  (paciente_id, centro_id, centro_salud, especialidad, especialidad_id, fecha_cita,
   hora_inicio, motivo, origen, estado, codigo_confirmacion) VALUES
  ((SELECT id FROM public.historias_clinicas WHERE cedula = '18234567'),
   2, 'Clínica de los Trabajadores (CITAB)', 'Cardiología', 4, '2026-08-15', '08:30:00',
   'Control cardiovascular', 'cita_web', 'pendiente', 'CITAB-2026-89A1'),
  ((SELECT id FROM public.historias_clinicas WHERE cedula = '98765432'),
   2, 'Clínica de los Trabajadores (CITAB)', 'Medicina General', 1, '2026-08-16', '10:00:00',
   'Chequeo de rutina', 'cita_web', 'confirmada', 'CITAB-2026-8B2C'),
  ((SELECT id FROM public.historias_clinicas WHERE cedula = '12345678'),
   1, 'Clínica del Niño', 'Pediatría', 2, '2026-08-17', '09:15:00',
   'Control pediátrico', 'cita_web', 'pendiente', 'NINO-2026-3C4D'),
  ((SELECT id FROM public.historias_clinicas WHERE cedula = '87654321'),
   3, 'Clínica de la Mujer', 'Ginecología', 3, '2026-08-19', '11:00:00',
   'Control ginecológico', 'cita_web', 'pendiente', 'MUJER-2026-4D5E')
ON CONFLICT (codigo_confirmacion) DO UPDATE SET
  paciente_id = EXCLUDED.paciente_id, centro_id = EXCLUDED.centro_id,
  centro_salud = EXCLUDED.centro_salud, especialidad = EXCLUDED.especialidad,
  especialidad_id = EXCLUDED.especialidad_id, fecha_cita = EXCLUDED.fecha_cita,
  hora_inicio = EXCLUDED.hora_inicio, motivo = EXCLUDED.motivo,
  origen = EXCLUDED.origen, estado = EXCLUDED.estado;

-- ============================================================
-- 11. CONSULTAS (historial clínico) — vínculo a paciente y médico
-- ============================================================
INSERT INTO public.consultas
  (id, paciente_id, cita_id, medico_id, medico_nombre, especialidad, motivo_consulta,
   examen_fisico, cie10_codigo, cie10_descripcion, tratamiento, recomendaciones,
   recetas, laboratorios, comprobante_ref) VALUES
  ('11111111-2222-3333-4444-555555555555',
   (SELECT id FROM public.historias_clinicas WHERE cedula = '18234567'),
   'CITAB-2026-89A1',
   (SELECT id FROM public.personal WHERE cedula = '11111111'),
   'Dr. Antonio Valera', 'Cardiología', 'Cefalea constante de 3 días',
   'Presión arterial 130/85. Paciente consciente, orientado.',
   'I10', 'Hipertensión esencial (primaria)', 'Enalapril 10mg cada 12 hrs',
   'Reposo por 48 hrs y baja ingesta de sal',
   '[{"nombre": "Enalapril 10mg", "posologia": "1 tableta cada 12 horas por 30 días"}]'::jsonb,
   '[{"parametro": "Hemoglobina", "valor": "14.2 g/dL"}]'::jsonb,
   'ABH-99281'),
  ('22222222-3333-4444-5555-666666666666',
   (SELECT id FROM public.historias_clinicas WHERE cedula = '12345678'),
   'NINO-2026-3C4D',
   (SELECT id FROM public.personal WHERE cedula = '22222222'),
   'Dra. María González', 'Pediatría', 'Control de crecimiento',
   'Peso y talla acordes a la edad. Sin hallazgos.',
   'Z00.1', 'Examen de salud de rutina del niño sano', 'Esquema de vacunación al día',
   'Próxima consulta en 3 meses',
   '[]'::jsonb, '[]'::jsonb, 'ABH-99290')
ON CONFLICT (id) DO UPDATE SET
  paciente_id = EXCLUDED.paciente_id, cita_id = EXCLUDED.cita_id,
  medico_id = EXCLUDED.medico_id, medico_nombre = EXCLUDED.medico_nombre,
  especialidad = EXCLUDED.especialidad, motivo_consulta = EXCLUDED.motivo_consulta,
  examen_fisico = EXCLUDED.examen_fisico, cie10_codigo = EXCLUDED.cie10_codigo,
  cie10_descripcion = EXCLUDED.cie10_descripcion, tratamiento = EXCLUDED.tratamiento,
  recomendaciones = EXCLUDED.recomendaciones, recetas = EXCLUDED.recetas,
  laboratorios = EXCLUDED.laboratorios, comprobante_ref = EXCLUDED.comprobante_ref;

-- ============================================================
-- 12. RECETAS + DETALLES (Farmacia) — vínculo a médico y clínica
-- ============================================================
INSERT INTO public.recetas
  (codigo_receta, paciente_cedula, paciente_nombre, medico, medico_id, clinica_id, estado, fecha_emision) VALUES
  ('RX-2026-0892', 'V-18234567', 'Carlos Mendoza', 'Dr. Antonio Valera',
   (SELECT id FROM public.personal WHERE cedula = '11111111'), 2, 'PENDIENTE', '2026-08-15'),
  ('RX-2026-0893', 'V-98765432', 'Juan Pérez', 'Dra. María González',
   (SELECT id FROM public.personal WHERE cedula = '22222222'), 1, 'DESPACHADA', '2026-08-16')
ON CONFLICT (codigo_receta) DO UPDATE SET
  paciente_cedula = EXCLUDED.paciente_cedula, paciente_nombre = EXCLUDED.paciente_nombre,
  medico = EXCLUDED.medico, medico_id = EXCLUDED.medico_id,
  clinica_id = EXCLUDED.clinica_id, estado = EXCLUDED.estado,
  fecha_emision = EXCLUDED.fecha_emision;

INSERT INTO public.receta_detalles
  (id, receta_id, medicamento_id, cantidad_prescrita, cantidad_despachada, posologia) VALUES
  (901,
   (SELECT id FROM public.recetas WHERE codigo_receta = 'RX-2026-0892'),
   (SELECT id FROM public.inventario_medicamentos WHERE nombre = 'Amoxicilina 500mg'),
   21, 0, '1 cápsula cada 8 horas por 7 días'),
  (902,
   (SELECT id FROM public.recetas WHERE codigo_receta = 'RX-2026-0893'),
   (SELECT id FROM public.inventario_medicamentos WHERE nombre = 'Paracetamol 500mg'),
   20, 20, '1 tableta cada 6 horas por 5 días')
ON CONFLICT (id) DO UPDATE SET
  receta_id = EXCLUDED.receta_id, medicamento_id = EXCLUDED.medicamento_id,
  cantidad_prescrita = EXCLUDED.cantidad_prescrita,
  cantidad_despachada = EXCLUDED.cantidad_despachada, posologia = EXCLUDED.posologia;

-- ============================================================
-- 13. ÓRDENES DE ESTUDIOS (migración 0009) — vínculo a paciente/consulta/médico
-- ============================================================
INSERT INTO public.ordenes_estudios
  (id, paciente_id, consulta_id, cita_id, origen, estado, medico_id, medico_nombre,
   especialidad, prioridad, estudios, comprobante_orden) VALUES
  ('33333333-4444-5555-6666-777777777777',
   (SELECT id FROM public.historias_clinicas WHERE cedula = '18234567'),
   '11111111-2222-3333-4444-555555555555', 'CITAB-2026-89A1', 'consulta', 'solicitada',
   (SELECT id FROM public.personal WHERE cedula = '11111111'),
   'Dr. Antonio Valera', 'Cardiología', 'normal',
   '[{"tipo": "laboratorio", "nombre": "Perfil lipídico", "estado": "solicitada"}]'::jsonb,
   'OE-2026-0001')
ON CONFLICT (id) DO UPDATE SET
  paciente_id = EXCLUDED.paciente_id, consulta_id = EXCLUDED.consulta_id,
  cita_id = EXCLUDED.cita_id, origen = EXCLUDED.origen, estado = EXCLUDED.estado,
  medico_id = EXCLUDED.medico_id, medico_nombre = EXCLUDED.medico_nombre,
  especialidad = EXCLUDED.especialidad, prioridad = EXCLUDED.prioridad,
  estudios = EXCLUDED.estudios, comprobante_orden = EXCLUDED.comprobante_orden;

-- ============================================================
-- 14. DESPACHO REGISTRADO (Farmacia) — trazabilidad del despacho
-- ============================================================
INSERT INTO public.despacho_registros (id, receta_id, observaciones, fecha_despacho) VALUES
  (1,
   (SELECT id FROM public.recetas WHERE codigo_receta = 'RX-2026-0893'),
   'Despacho completo de paracetamol (20 unidades)',
   '2026-08-16 12:10:00')
ON CONFLICT (id) DO UPDATE SET
  receta_id = EXCLUDED.receta_id, observaciones = EXCLUDED.observaciones,
  fecha_despacho = EXCLUDED.fecha_despacho;

-- ============================================================
-- RESUMEN
-- ============================================================
SELECT 'cargos' AS tabla, count(*) AS filas FROM public.cargos
UNION ALL SELECT 'clinicas', count(*) FROM public.clinicas
UNION ALL SELECT 'especialidades', count(*) FROM public.especialidades
UNION ALL SELECT 'turnos', count(*) FROM public.turnos
UNION ALL SELECT 'personal', count(*) FROM public.personal
UNION ALL SELECT 'historias_clinicas', count(*) FROM public.historias_clinicas
UNION ALL SELECT 'usuarios', count(*) FROM public.usuarios
UNION ALL SELECT 'inventario_medicamentos', count(*) FROM public.inventario_medicamentos
UNION ALL SELECT 'stock_clinica', count(*) FROM public.stock_clinica
UNION ALL SELECT 'citas', count(*) FROM public.citas
UNION ALL SELECT 'consultas', count(*) FROM public.consultas
UNION ALL SELECT 'recetas', count(*) FROM public.recetas
UNION ALL SELECT 'receta_detalles', count(*) FROM public.receta_detalles
UNION ALL SELECT 'ordenes_estudios', count(*) FROM public.ordenes_estudios
UNION ALL SELECT 'despacho_registros', count(*) FROM public.despacho_registros
ORDER BY tabla;
