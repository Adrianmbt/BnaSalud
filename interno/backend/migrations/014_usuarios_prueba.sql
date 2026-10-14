-- Usuarios de prueba para cada centro de salud
-- Contraseña: test123 (hash bcrypt)
-- Formato: recepcionista, medico, jefe_farmacia por centro

-- 1. CREAR PERSONAL DE PRUEBA POR CENTRO
-- =========================================

-- CITAB (id=13)
INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Recepcionista', 'CITAB', 'Recepcionista', NULL, 13)
ON CONFLICT DO NOTHING RETURNING id;

INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Doctor', 'CITAB', 'Medico', 'Medicina General', 13)
ON CONFLICT DO NOTHING RETURNING id;

INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Farmacia', 'CITAB', 'Jefe de Farmacia', NULL, 13)
ON CONFLICT DO NOTHING RETURNING id;

-- CMUJER (id=14)
INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Recepcionista', 'CMUJER', 'Recepcionista', NULL, 14)
ON CONFLICT DO NOTHING RETURNING id;

INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Doctora', 'CMUJER', 'Medico', 'Ginecologia', 14)
ON CONFLICT DO NOTHING RETURNING id;

INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Farmacia', 'CMUJER', 'Jefe de Farmacia', NULL, 14)
ON CONFLICT DO NOTHING RETURNING id;

-- CNINOS (id=15)
INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Recepcionista', 'CNINOS', 'Recepcionista', NULL, 15)
ON CONFLICT DO NOTHING RETURNING id;

INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Doctora', 'CNINOS', 'Medico', 'Pediatria', 15)
ON CONFLICT DO NOTHING RETURNING id;

INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Farmacia', 'CNINOS', 'Jefe de Farmacia', NULL, 15)
ON CONFLICT DO NOTHING RETURNING id;

-- CAPJPF (id=16)
INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Recepcionista', 'CAPJPF', 'Recepcionista', NULL, 16)
ON CONFLICT DO NOTHING RETURNING id;

INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Doctor', 'CAPJPF', 'Medico', 'Medicina General', 16)
ON CONFLICT DO NOTHING RETURNING id;

INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Farmacia', 'CAPJPF', 'Jefe de Farmacia', NULL, 16)
ON CONFLICT DO NOTHING RETURNING id;

-- CAMAYOR (id=17)
INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Recepcionista', 'CAMAYOR', 'Recepcionista', NULL, 17)
ON CONFLICT DO NOTHING RETURNING id;

INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Doctora', 'CAMAYOR', 'Medico', 'Gerontologia', 17)
ON CONFLICT DO NOTHING RETURNING id;

INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Farmacia', 'CAMAYOR', 'Jefe de Farmacia', NULL, 17)
ON CONFLICT DO NOTHING RETURNING id;

-- OMARUJA (id=18)
INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Recepcionista', 'OMARUJA', 'Recepcionista', NULL, 18)
ON CONFLICT DO NOTHING RETURNING id;

INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Doctor', 'OMARUJA', 'Medico', 'Oncologia', 18)
ON CONFLICT DO NOTHING RETURNING id;

INSERT INTO personal (nombre, apellido, cargo, especialidad, clinica_id)
VALUES ('Farmacia', 'OMARUJA', 'Jefe de Farmacia', NULL, 18)
ON CONFLICT DO NOTHING RETURNING id;
