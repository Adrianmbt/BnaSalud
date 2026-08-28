-- ============================================================
-- BnaSalud · Migración 0022
-- Horario extendido para Dr. Carlos Jose Ortiz Pérez (Ginecología)
-- Clínica de los Trabajadores (CITAB) - clinica_id = 2
-- Lunes a Viernes: 13:00 - 21:00
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Turno vespertino extendido (13:00 - 21:00)
INSERT INTO public.turnos (nombre, hora_inicio, hora_fin) VALUES
  ('Tarde Extendida', '13:00:00', '21:00:00')
ON CONFLICT (nombre) DO UPDATE SET
  hora_inicio = EXCLUDED.hora_inicio,
  hora_fin = EXCLUDED.hora_fin;

-- 2. Limpiar asignaciones previas del Dr. Carlos Ortiz en el CITAB
DELETE FROM public.personal_turnos
WHERE clinica_id = 2
  AND personal_id = (SELECT id FROM public.personal WHERE cedula = '24829475');

-- 3. Asignar el horario de Lunes a Viernes (13:00 - 21:00)
--    fecha_asignacion distinta por día para respetar el índice único
--    (personal_id, clinica_id, turno_id, fecha_asignacion).
INSERT INTO public.personal_turnos (personal_id, clinica_id, turno_id, fecha_asignacion, observaciones)
SELECT p.id, 2, t.id, CURRENT_DATE + o.dia_offset, o.dia
FROM (VALUES
  (0, 'Lunes',     '24829475'),
  (1, 'Martes',    '24829475'),
  (2, 'Miércoles', '24829475'),
  (3, 'Jueves',    '24829475'),
  (4, 'Viernes',   '24829475')
) AS o(dia_offset, dia, cedula)
JOIN public.personal p ON p.cedula = o.cedula
JOIN public.turnos t ON t.nombre = 'Tarde Extendida'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RESUMEN DE CARGA
-- ============================================================
SELECT
  p.nombre || ' ' || p.apellido AS medico,
  t.nombre AS turno,
  t.hora_inicio,
  t.hora_fin,
  count(pt.id) AS dias_asignados
FROM public.personal p
JOIN public.personal_turnos pt ON pt.personal_id = p.id
JOIN public.turnos t ON t.id = pt.turno_id
WHERE p.cedula = '24829475'
GROUP BY p.id, t.id;