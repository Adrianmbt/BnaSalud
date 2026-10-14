-- 015_medicos_reales.sql
-- Normaliza nombres/apellidos de los especialistas e instala su
-- agenda real según docs/DATA DR.csv. Solo toca personal ids 17-36
-- (los 20 médicos reales) y sus filas en agenda_medicos.
-- No borra usuarios, test users/personal (2-9, 40-57) ni datos de
-- empleados/beneficiarios.
--
-- dia_semana: 0=lunes, 1=martes, 2=miércoles, 3=jueves, 4=viernes.
-- turno_id: 2=Mañana (07-13), 3=Tarde (13-19).

-- 1) Nombres/apellidos según el CSV
UPDATE personal SET nombre='Rosmary Del Carmen' WHERE id=17;
UPDATE personal SET nombre='Yira Del Valle' WHERE id=18;
UPDATE personal SET nombre='Migdelia José' WHERE id=22;
UPDATE personal SET nombre='Carlos José' WHERE id=23;
UPDATE personal SET nombre='José Arcenio' WHERE id=24;
UPDATE personal SET apellido='Marín Báez' WHERE id=25;
UPDATE personal SET nombre='Andrés Emilio' WHERE id=28;
UPDATE personal SET nombre='Lucía Del Valle' WHERE id=31;
UPDATE personal SET nombre='Arcenio José' WHERE id=32;
UPDATE personal SET nombre='Andreína' WHERE id=34;
UPDATE personal SET nombre='Eneida Del Carmen' WHERE id=36;

-- 2) Agenda: se reemplaza el horario genérico por el real del CSV.
DELETE FROM agenda_medicos WHERE medico_id BETWEEN 17 AND 36;

INSERT INTO agenda_medicos (medico_id, dia_semana, turno_id, activo) VALUES
-- Rosmary Sánchez: Jueves 7-1
(17, 3, 2, TRUE),
-- Yira Sandoval: Lunes 7-1, Miércoles 1-7
(18, 0, 2, TRUE), (18, 2, 3, TRUE),
-- Carlos Stanley: Martes 1-7, Jueves 1-7
(19, 1, 3, TRUE), (19, 3, 3, TRUE),
-- Jeferson Salazar: Lunes 1-7, Miércoles 1-7
(20, 0, 3, TRUE), (20, 2, 3, TRUE),
-- Edmily Gómez: Martes 7-1, Viernes 7-1
(21, 1, 2, TRUE), (21, 4, 2, TRUE),
-- Migdelia Arenas: Miércoles 7-1, Jueves 7-1
(22, 2, 2, TRUE), (22, 3, 2, TRUE),
-- Carlos Ortiz: Lunes 7-1, Miércoles 1-7
(23, 0, 2, TRUE), (23, 2, 3, TRUE),
-- José Rivero: Lunes 1-7, Jueves 1-7
(24, 0, 3, TRUE), (24, 3, 3, TRUE),
-- Maira Marín: Martes 1-7, Miércoles 1-7
(25, 1, 3, TRUE), (25, 2, 3, TRUE),
-- Adriana Ramírez: Lunes 7-1, Viernes 7-1
(26, 0, 2, TRUE), (26, 4, 2, TRUE),
-- Chessaysna Silva: Lunes 11:00 (turno Mañana)
(27, 0, 2, TRUE),
-- Andrés Laya: Miércoles 1-7, Jueves 7-1
(28, 2, 3, TRUE), (28, 3, 2, TRUE),
-- Oriana Hernández: Martes 1-7, Miércoles 7-1
(29, 1, 3, TRUE), (29, 2, 2, TRUE),
-- Xiomara Méndez: Lunes 1-7, Jueves 1-7
(30, 0, 3, TRUE), (30, 3, 3, TRUE),
-- Lucía Obando: Martes 1-7, Viernes 1-7
(31, 1, 3, TRUE), (31, 4, 3, TRUE),
-- Arcenio Rivero: Martes 1-7, Jueves 1-7
(32, 1, 3, TRUE), (32, 3, 3, TRUE),
-- Jhonier Cardona: Jueves 7-1, Viernes 7-1
(33, 3, 2, TRUE), (33, 4, 2, TRUE),
-- Andreína Itriago: Jueves 7-1, Viernes 7-1
(34, 3, 2, TRUE), (34, 4, 2, TRUE),
-- Ruth López: Miércoles 1-7, Jueves 1-7
(35, 2, 3, TRUE), (35, 3, 3, TRUE),
-- Eneida Tiapa: Martes 1-7, Viernes 1-7
(36, 1, 3, TRUE), (36, 4, 3, TRUE);