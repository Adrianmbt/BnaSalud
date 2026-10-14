-- 016_horarios_centros.sql
-- Agenda de los médicos de prueba de cada centro (personal 41, 44, 47, 50,
-- 53, 56). Estos médicos no tenían ninguna fila en agenda_medicos, así que con
-- el horario real activado (agenda.py sin MODO_PRUEBAS) no se podía agendarles
-- ninguna cita. Solo se agrega lo que falta: no toca los médicos 2-9 ni los
-- 20 reales (17-36), que ya tienen horario de 015_medicos_reales.sql.
--
-- dia_semana: 0=lunes ... 6=domingo.
-- Los horarios salen de los turnos del catálogo (2=Mañana 07-13, 3=Tarde 13-19),
-- que _slots_de_turno expande en franjas de 30 min.
--
-- CMUJER (44) queda domingo 18:00-21:00 como pediu el caso de prueba.

-- 1) Turno de noche 18-21 para el horario de CMUJER.
INSERT INTO turnos (nombre, hora_inicio, hora_fin)
SELECT 'Noche', TIME '18:00', TIME '21:00'
WHERE NOT EXISTS (SELECT 1 FROM turnos WHERE nombre = 'Noche');

-- 2) Agenda de los médicos de centro, solo donde falte ese día.
INSERT INTO agenda_medicos (medico_id, dia_semana, turno_id, activo)
SELECT d.medico_id, d.dia, t.id, TRUE
FROM (VALUES
  -- Doctor CITAB (41): L-V 07-13, mas el miércoles 13-19
  (41, 0, 'Mañana'), (41, 1, 'Mañana'), (41, 2, 'Mañana'), (41, 3, 'Mañana'),
  (41, 4, 'Mañana'), (41, 2, 'Tarde'),
  -- Doctora CMUJER (44): domingo 18-21
  (44, 6, 'Noche'),
  -- Doctora CNINOS (47): L-V 07-13
  (47, 0, 'Mañana'), (47, 1, 'Mañana'), (47, 2, 'Mañana'), (47, 3, 'Mañana'),
  (47, 4, 'Mañana'),
  -- Doctor CAPJPF (50): mar-vier 13-19
  (50, 1, 'Tarde'), (50, 2, 'Tarde'), (50, 3, 'Tarde'), (50, 4, 'Tarde'),
  -- Doctora CAMAYOR (53): L-V 07-13
  (53, 0, 'Mañana'), (53, 1, 'Mañana'), (53, 2, 'Mañana'), (53, 3, 'Mañana'),
  (53, 4, 'Mañana'),
  -- Doctor OMARUJA (56): martes y sábado 13-19
  (56, 1, 'Tarde'), (56, 5, 'Tarde')
) AS d(medico_id, dia, turno_nombre)
JOIN turnos t ON t.nombre = d.turno_nombre
WHERE NOT EXISTS (
  SELECT 1 FROM agenda_medicos a
  WHERE a.medico_id = d.medico_id AND a.dia_semana = d.dia
);

-- 3) Comprobación: cada médico de centro debe tener al menos un día con
--    horario. Debe devolver 6 filas.
SELECT p.id, p.nombre || ' ' || p.apellido AS medico,
       count(a.dia_semana) AS dias_con_horario
FROM personal p
LEFT JOIN agenda_medicos a ON a.medico_id = p.id AND a.activo
WHERE p.id IN (41, 44, 47, 50, 53, 56)
GROUP BY p.id, p.nombre, p.apellido
ORDER BY p.id;