import asyncio
from pathlib import Path
from datetime import date, datetime, timedelta, time as dt_time

path = Path(r"C:\Users\adria\OneDrive\Imágenes\BnaSalud\interno\backend\app\api\v1\endpoints\agenda.py")
content = path.read_text(encoding="utf-8")

start_marker = "LIMITE_CITAS_POR_TURNO = 10"
end_marker = '@router.get("/especialistas"'
start = content.index(start_marker)
end = content.index(end_marker)

new_block = '''

LIMITE_CITAS_POR_TURNO = 10


async def _contar_ocupadas_por_turno(db: AsyncSession, medico_id: int, fecha: date) -> dict:
    """Devuelve un dict {HH:MM: count} con las citas ya registradas (no canceladas) del médico en la fecha."""
    r = await db.execute(
        text(
            "SELECT to_char(hora_inicio, 'HH24:MI') AS h, count(*) AS n "
            "FROM citas "
            "WHERE medico_id = :mid AND fecha_cita = :fec AND estado <> 'cancelada' "
            "GROUP BY to_char(hora_inicio, 'HH24:MI')"
        ),
        {"mid": medico_id, "fec": fecha},
    )
    conteo: dict = {}
    for f in r.mappings():
        conteo[f["h"]] = conteo.get(f["h"], 0) + f["n"]
    return conteo


async def _dias_disponibles(
    db: AsyncSession,
    medico_id: int,
    agenda: dict,
    ocupadas_por_fecha: dict,
    desde: date,
    hasta: date,
    ausentes: set | None = None,
    limite_citas: int = LIMITE_CITAS_POR_TURNO,
) -> List[DiaDisponibilidad]:
    dias: List[DiaDisponibilidad] = []
    ausentes = ausentes or set()
    cur = desde
    while cur <= hasta:
        if cur in ausentes:
            dias.append(
                DiaDisponibilidad(
                    fecha=cur.isoformat(),
                    disponible=False,
                    motivo="médico ausente",
                    turnos_libres=[],
                    cupos_libres=0,
                )
            )
            cur += timedelta(days=1)
            continue
        turnos = agenda.get(cur.weekday(), [])
        if not turnos:
            dias.append(
                DiaDisponibilidad(
                    fecha=cur.isoformat(),
                    disponible=False,
                    motivo="no labora",
                    turnos_libres=[],
                    cupos_libres=0,
                )
            )
            cur += timedelta(days=1)
            continue

        ocupadas_hhmm = ocupadas_por_fecha.get(cur, set())
        turnos_libres = []
        cupos_totales = 0
        for turno in turnos:
            tid = turno["turno_id"]
            hh_in = _hhmm(turno["hora_inicio"])
            hh_out = _hhmm(turno["hora_fin"])
            inicio = datetime.combine(date.min, dt_time.fromisoformat(hh_in))
            fin = datetime.combine(date.min, dt_time.fromisoformat(hh_out))
            paso = timedelta(minutes=30)
            slots: list = []
            cur_dt = inicio
            while cur_dt + paso <= fin:
                slots.append(cur_dt.strftime("%H:%M"))
                cur_dt += paso
            libres = [s for s in slots if s not in ocupadas_hhmm]
            slots_totales = len(slots)
            citas_ocupadas = slots_totales - len(libres)
            cupos_libres_turno = max(0, limite_citas - citas_ocupadas)
            if libres:
                turnos_libres.append(
                    TurnoLibre(
                        turno_id=tid,
                        turno_nombre=turno.get("turno_nombre") or "",
                        hora_inicio=hh_in,
                        hora_fin=hh_out,
                    )
                )
                cupos_totales += cupos_libres_turno

        hay_algun_libre = bool(turnos_libres)
        dias.append(
            DiaDisponibilidad(
                fecha=cur.isoformat(),
                disponible=hay_algun_libre,
                motivo="" if hay_algun_libre else "turnos agotados",
                turnos_libres=turnos_libres,
                cupos_libres=cupos_totales if hay_algun_libre else 0,
            )
        )
        cur += timedelta(days=1)
    return dias


'''

path.write_text(content[:start] + new_block + content[end:], encoding="utf-8")
print("Bloque reemplazado OK")