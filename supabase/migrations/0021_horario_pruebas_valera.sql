-- ============================================================
-- BnaSalud · Migración 0021
-- Horario nocturno de PRUEBAS para Dr. Antonio Valera (Cardiología)
-- Clínica de los Trabajadores (CITAB) - clinica_id = 2
-- Lunes a Domingo: 19:00 - 22:00
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- Nota: además amplía la ventana de slots del CITAB a 22:00.
-- ============================================================

-- 1. Turno nocturno (19:00 - 22:00)
INSERT INTO public.turnos (nombre, hora_inicio, hora_fin) VALUES
  ('Noche Pruebas', '19:00:00', '22:00:00')
ON CONFLICT (nombre) DO UPDATE SET
  hora_inicio = EXCLUDED.hora_inicio,
  hora_fin = EXCLUDED.hora_fin;

-- 2. Limpiar asignaciones previas del Dr. Valera en el CITAB
DELETE FROM public.personal_turnos
WHERE clinica_id = 2
  AND personal_id = (SELECT id FROM public.personal WHERE cedula = '11111111');

-- 3. Asignar el horario de Lunes a Domingo (19:00 - 22:00)
--    fecha_asignacion distinta por día para respetar el índice único
--    (personal_id, clinica_id, turno_id, fecha_asignacion).
INSERT INTO public.personal_turnos (personal_id, clinica_id, turno_id, fecha_asignacion, observaciones)
SELECT p.id, 2, t.id, CURRENT_DATE + o.dia_offset, o.dia
FROM (VALUES
  (0, 'Lunes',   '11111111'),
  (1, 'Martes',  '11111111'),
  (2, 'Miércoles','11111111'),
  (3, 'Jueves',  '11111111'),
  (4, 'Viernes', '11111111'),
  (5, 'Sábado',  '11111111'),
  (6, 'Domingo', '11111111')
) AS o(dia_offset, dia, cedula)
JOIN public.personal p ON p.cedula = o.cedula
JOIN public.turnos t ON t.nombre = 'Noche Pruebas'
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
WHERE p.cedula = '11111111'
GROUP BY p.id, t.id;