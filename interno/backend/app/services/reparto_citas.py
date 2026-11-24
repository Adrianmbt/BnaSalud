"""Reglas puras del reparto de citas preasignadas en la agenda del médico.

Sin acceso a base de datos: recibe la agenda (días y turnos), las horas ya
ocupadas del día y devuelve el hueco elegido. Así las reglas de cupo se pueden
probar con datos sintéticos.

Topes que se respetan, en este orden:
1. **Por día**: `MAX_CUPOS_DIA` citas sumando todos los turnos de ese día.
2. **Por turno**: `MAX_CUPOS_DIA` citas dentro del rango del turno.
3. **Por horario**: cada cita ocupa un bloque libre de `SLOT_MINUTOS`.

El tope semanal (`MAX_CUPOS_DIA × días de atención`) lo aplica quien llama
(`_asignar_citas_preasignadas_de_medico` en `admin_sistema.py`).
"""
from datetime import date, datetime, time, timedelta
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

MAX_CUPOS_DIA = 10
SLOT_MINUTOS = 30


def hhmm(hora) -> str:
    """Hora como 'HH:MM' (acepta time, datetime o texto)."""
    return str(hora)[:5]


def slots_del_turno(hora_inicio, hora_fin) -> List[time]:
    """Inicios de los bloques de SLOT_MINUTOS que caben dentro del turno."""
    arranque = datetime.combine(date.min, hora_inicio)
    cierre = datetime.combine(date.min, hora_fin)
    paso = timedelta(minutes=SLOT_MINUTOS)
    if cierre <= arranque:
        # Turno puntual (p. ej. 24 h cargado como inicio == fin): un bloque.
        cierre = arranque + paso
    return [(arranque + paso * i).time() for i in range(int((cierre - arranque) / paso))]


def elegir_hueco(
    inicio_semana: date,
    dias_atendidos: Iterable[int],
    turnos_por_dia: Dict[int, Sequence[dict]],
    hoy: date,
    ocupadas_por_dia: Dict[date, List[str]],
    cupo_dia: int = MAX_CUPOS_DIA,
) -> Optional[Tuple[date, time]]:
    """Primer (fecha, hora) con cupo, o None si la semana ya está llena.

    `turnos_por_dia` mapea `dia_semana` (0=lunes) a filas con `hora_inicio` y
    `hora_fin`; `ocupadas_por_dia` mapea fecha a horas 'HH:MM' ya tomadas por
    citas vigentes. No se modifica nada: al asignar, el llamador debe agregar
    la hora elegida a `ocupadas_por_dia` para que cuente en el siguiente turno.
    """
    for dia_sem in sorted(dias_atendidos):
        cur_dia = inicio_semana + timedelta(days=dia_sem)
        if cur_dia < hoy:
            continue

        ocupadas = ocupadas_por_dia.get(cur_dia) or []
        # Tope por día: los dos turnos del mismo día comparten estos 10 cupos.
        if len(ocupadas) >= cupo_dia:
            continue

        for turno in turnos_por_dia.get(dia_sem) or []:
            h_in = hhmm(turno["hora_inicio"])
            h_out = hhmm(turno["hora_fin"])
            en_turno = [h for h in ocupadas if h_in <= h < h_out]
            if len(en_turno) >= cupo_dia:
                continue
            libres = [
                slot
                for slot in slots_del_turno(turno["hora_inicio"], turno["hora_fin"])
                if hhmm(slot) not in ocupadas
            ]
            if libres:
                return cur_dia, libres[0]

    return None
