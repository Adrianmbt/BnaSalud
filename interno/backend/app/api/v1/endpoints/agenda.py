"""Endpoints de agenda de remisión: especialistas, disponibilidad y citas."""
import logging
import random
import re
import string
from datetime import date, datetime, time, timedelta
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.services.sincronizacion_portal import notificar_confirmacion_supabase
from app.services.certificaciones_horario import (
    asegurar_tabla,
    semana_certificada,
    semanas_certificadas,
)
from app.models.cola import (
    ColaAtencion,
    ColaAtencionHistorial,
    EstadoAtencionEnum,
)
from app.schemas.agenda import (
    CitaCreadaResponse,
    CitaCrearRequest,
    CupoDiaSemana,
    CupoSemanalResponse,
    DiaDisponibilidad,
    DisponibilidadResponse,
    EspecialistaItem,
    JornadaDisponible,
    JornadasDia,
    ReprogramarTodasRequest,
    ReprogramarTodasResponse,
    ResumenSemanaItem,
    TurnoLibre,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Agenda"])

NIVELES = {"azul", "verde", "amarillo"}
DIAS_VENTANA = {"azul": 0, "verde": 14, "amarillo": 30}
RANGO_VENTANA_DIAS = 60

# Duración de cada cita offered. El médico elige el inicio dentro de su turno
# según cuánto le lleve la consulta; cambiarlo aquí lo cambia en toda la app.
SLOT_MINUTOS = 30


def _nombre_valido(especialidad: str) -> str:
    return (especialidad or "").strip()


async def _especialista(db: AsyncSession, medico_id: int) -> dict:
    """Devuelve el especialista si existe en personal (médico con especialidad o emergencia)."""
    r = await db.execute(
        text(
            "SELECT p.id, p.nombre, p.apellido, p.especialidad, "
            "       EXISTS(SELECT 1 FROM usuarios u "
            "              WHERE u.personal_id = p.id AND u.rol = 'medico_emergencia') AS emergencia "
            "FROM personal p "
            "WHERE p.id = :mid "
            "  AND ( (LOWER(COALESCE(p.cargo, '')) IN ('medico', 'médico') "
            "         AND p.especialidad IS NOT NULL) "
            "         OR EXISTS(SELECT 1 FROM usuarios u "
            "                   WHERE u.personal_id = p.id AND u.rol = 'medico_emergencia') )"
        ),
        {"mid": medico_id},
    )
    fila = r.mappings().first()
    if not fila:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe un especialista con id {medico_id}.",
        )
    return {
        "id": fila["id"],
        "nombre": f"{fila['nombre']} {fila['apellido']}".strip(),
        "especialidad": fila["especialidad"] or "",
        "emergencia": bool(fila["emergencia"]),
    }


def _hhmm(hora) -> str:
    return str(hora)[:5]


def _slots_de_turno(
    turno_id: int, turno_nombre: str, hora_inicio: time, hora_fin: time
) -> List[dict]:
    """Divide un turno en slots de SLOT_MINUTOS que caben dentro del rango.

    Un turno vacío (hora_inicio == hora_fin) no genera slots: se trata como
    una hora puntual.
    """
    inicio = datetime.combine(date.min, hora_inicio)
    fin = datetime.combine(date.min, hora_fin)
    if fin <= inicio:
        fin = inicio + timedelta(minutes=SLOT_MINUTOS)

    slots = []
    paso = timedelta(minutes=SLOT_MINUTOS)
    cur = inicio
    while cur + paso <= fin:
        slots.append(
            {
                "turno_id": turno_id,
                "turno_nombre": turno_nombre,
                "hora_inicio": cur.time(),
                "hora_fin": (cur + paso).time(),
            }
        )
        cur += paso
    return slots


async def _turnos_agenda(db: AsyncSession, medico_id: int) -> dict:
    """Mapa dia_semana -> lista de slots (turno_id, hora_inicio, hora_fin) activos.

    Cada fila de agenda_medicos aporta un turno del catálogo (p. ej. Mañana
    07:00-13:00); se expande en slots de SLOT_MINUTOS para que el médico elija
    la hora concreta según lo que dure la consulta.
    """
    r = await db.execute(
        text(
            "SELECT a.dia_semana, t.id AS turno_id, t.nombre AS turno_nombre, "
            "       t.hora_inicio, t.hora_fin "
            "FROM agenda_medicos a "
            "JOIN turnos t ON t.id = a.turno_id "
            "WHERE a.medico_id = :mid AND a.activo = TRUE"
        ),
        {"mid": medico_id},
    )
    agenda: dict = {}
    for f in r.mappings():
        agenda.setdefault(f["dia_semana"], []).extend(
            _slots_de_turno(
                f["turno_id"], f["turno_nombre"] or "", f["hora_inicio"], f["hora_fin"]
            )
        )
    return agenda


async def _horas_ocupadas(db: AsyncSession, medico_id: int, fecha: date) -> set:
    """Conjunto de horas ya ocupadas (citas no canceladas) para un médico en una fecha."""
    r = await db.execute(
        text(
            "SELECT to_char(hora_inicio, 'HH24:MI') AS h "
            "FROM citas "
            "WHERE medico_id = :mid AND fecha_cita = :fec "
            "  AND estado <> 'cancelada'"
        ),
        {"mid": medico_id, "fec": fecha},
    )
    return {f["h"] for f in r.mappings()}


async def _fechas_ausente(
    db: AsyncSession, medico_id: int, desde: date, hasta: date
) -> set:
    """Fechas del rango en las que el médico tiene una ausencia activa."""
    if hasta < desde:
        return set()
    r = await db.execute(
        text(
            "SELECT fecha_desde, fecha_hasta FROM ausencias_medicos "
            "WHERE medico_id = :mid AND estado = 'activa' "
            "  AND fecha_desde <= :hasta AND fecha_hasta >= :desde"
        ),
        {"mid": medico_id, "desde": desde, "hasta": hasta},
    )
    ausentes = set()
    for f in r.mappings():
        cur = max(f["fecha_desde"], desde)
        fin = min(f["fecha_hasta"], hasta)
        while cur <= fin:
            ausentes.add(cur)
            cur += timedelta(days=1)
    return ausentes


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
        grupos: dict = {}
        for slot in turnos:
            grupos.setdefault(slot["turno_id"], []).append(slot)

        turnos_libres = []
        cupos_totales = 0
        for tid, slots in grupos.items():
            slots.sort(key=lambda s: s["hora_inicio"])
            libres = [s for s in slots if _hhmm(s["hora_inicio"]) not in ocupadas_hhmm]
            citas_ocupadas = len(slots) - len(libres)
            cupos_libres_turno = max(0, limite_citas - citas_ocupadas)
            if libres:
                nombre_turno = slots[0].get("turno_nombre") or (
                    "Mañana" if slots[0]["hora_inicio"].hour < 13 else "Tarde"
                )
                turnos_libres.append(
                    TurnoLibre(
                        turno_id=tid,
                        turno_nombre=nombre_turno,
                        hora_inicio=_hhmm(slots[0]["hora_inicio"]),
                        hora_fin=_hhmm(slots[-1]["hora_fin"]),
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


@router.get("/especialistas", response_model=List[EspecialistaItem])
async def listar_especialistas(
    centro_id: Optional[int] = Query(
        None, description="Centro de salud: devuelve solo la cartera de ese centro."
    ),
    db: AsyncSession = Depends(get_db),
) -> List[EspecialistaItem]:
    """Lista los especialistas para agendar (carga real del centro).

    Con `centro_id` devuelve solo los médicos de ese centro (`personal.clinica_id`),
    que es la cartera que puede agendar su recepción. Sin el parámetro mantiene el
    listado completo (otros módulos lo consumen así).

    Antes se exigía `cargo` exactamente 'Medico'/'Médico' y especialidad escrita:
    una ficha recién creada sin especialidad desaparecía del selector.

    Los médicos de emergencia no entran aquí: se listan aparte, en el panel de
    guardias (`GET /personal?rol=medico_emergencia` y `GET /guardias/activas`).
    El `cargo` no sirve para separarlos porque el formulario de usuarios guarda
    'Médico' también para el rol `medico_emergencia`; el separador es el rol.
    Quien hace guardias **y** pasa consulta conserva los dos roles
    (`medico` + `medico_emergencia`) y sigue en la cartera.
    """
    params: dict = {}
    filtro_centro = ""
    if centro_id is not None:
        filtro_centro = " AND p.clinica_id = :centro_id"
        params["centro_id"] = centro_id
    r = await db.execute(
        text(
            "SELECT p.id, p.nombre, p.apellido, COALESCE(p.especialidad,'') AS especialidad, "
            "       EXISTS(SELECT 1 FROM usuarios u "
            "              WHERE u.personal_id = p.id AND u.rol = 'medico_emergencia') AS emergencia "
            "FROM personal p "
            "WHERE ( LOWER(COALESCE(p.cargo, '')) LIKE 'medic%' "
            "     OR LOWER(COALESCE(p.cargo, '')) LIKE 'médic%' "
            "     OR EXISTS(SELECT 1 FROM usuarios u "
            "                WHERE u.personal_id = p.id AND u.rol = 'medico') ) "
            "  AND NOT ( EXISTS(SELECT 1 FROM usuarios u "
            "                    WHERE u.personal_id = p.id AND u.rol = 'medico_emergencia') "
            "            AND NOT EXISTS(SELECT 1 FROM usuarios u "
            "                            WHERE u.personal_id = p.id AND u.rol = 'medico') ) "
            f"{filtro_centro} "
            "ORDER BY p.especialidad NULLS LAST, p.nombre"
        ),
        params,
    )
    return [
        EspecialistaItem(
            id=f["id"],
            nombre=f"{f['nombre']} {f['apellido']}".strip(),
            especialidad=_nombre_valido(f["especialidad"]),
            emergencia=bool(f["emergencia"]),
        )
        for f in r.mappings()
    ]


@router.get("/disponibilidad", response_model=DisponibilidadResponse)
async def disponibilidad(
    medico_id: int,
    nivel: str,  # azul | verde | amarillo
    db: AsyncSession = Depends(get_db),
) -> DisponibilidadResponse:
    """Disponibilidad de un especialista por nivel de prioridad (días verdes/rojos)."""
    if nivel not in NIVELES:
        raise HTTPException(status_code=400, detail="nivel inválido: debe ser azul, verde o amarillo.")

    await _especialista(db, medico_id)

    agenda = await _turnos_agenda(db, medico_id)
    hoy = (await db.execute(text("SELECT CURRENT_DATE AS hoy"))).scalar_one()
    desde = hoy + timedelta(days=DIAS_VENTANA[nivel])
    hasta = desde + timedelta(days=RANGO_VENTANA_DIAS)

    # Cargar horas ocupadas por fecha en el rango (una consulta).
    ocupadas: dict = {}
    r = await db.execute(
        text(
            "SELECT fecha_cita, to_char(hora_inicio, 'HH24:MI') AS h "
            "FROM citas "
            "WHERE medico_id = :mid AND fecha_cita BETWEEN :d AND :h "
            "  AND estado <> 'cancelada'"
        ),
        {"mid": medico_id, "d": desde, "h": hasta},
    )
    for f in r.mappings():
        ocupadas.setdefault(f["fecha_cita"], set()).add(f["h"])

    ausentes = await _fechas_ausente(db, medico_id, desde, hasta)
    dias = await _dias_disponibles(db, medico_id, agenda, ocupadas, desde, hasta, ausentes)
    return DisponibilidadResponse(
        medico_id=medico_id,
        nivel=nivel,
        fecha_desde=desde.isoformat(),
        fecha_hasta=hasta.isoformat(),
        dias=dias,
    )


@router.get("/jornadas", response_model=JornadasDia)
async def jornadas_disponibles(
    medico_id: int,
    fecha: str,
    db: AsyncSession = Depends(get_db),
) -> JornadasDia:
    """Turnos (Mañana/Tarde) de un especialista en una fecha, con cupos libres.

    Es la base de la solicitud de cita por turno: el frontend muestra solo
    Mañana o Tarde y la cita se crea en `hora_asignada`.
    """
    try:
        fec = datetime.strptime(fecha, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="fecha inválida (YYYY-MM-DD).")

    await _especialista(db, medico_id)
    agenda = await _turnos_agenda(db, medico_id)
    ocupadas = await _horas_ocupadas(db, medico_id, fec)
    ausentes = await _fechas_ausente(db, medico_id, fec, fec)
    return _jornadas_de_dia(agenda, fec, ocupadas, fec in ausentes)


@router.get("/turnos", response_model=List[DiaDisponibilidad])
async def turnos_libres(
    medico_id: int,
    fecha: str,
    db: AsyncSession = Depends(get_db),
) -> List[DiaDisponibilidad]:
    """Franjas libres de un especialista en una fecha concreta."""
    try:
        fec = datetime.strptime(fecha, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="fecha inválida (YYYY-MM-DD).")

    await _especialista(db, medico_id)
    agenda = await _turnos_agenda(db, medico_id)
    ocupadas = await _horas_ocupadas(db, medico_id, fec)
    ausentes = await _fechas_ausente(db, medico_id, fec, fec)
    return await _dias_disponibles(db, medico_id, agenda, {fec: ocupadas}, fec, fec, ausentes)


@router.get("/disponibilidad/calendario")
async def calendario_disponibilidad(
    medico_id: int,
    desde: str = "",
    dias: int = 30,
    db: AsyncSession = Depends(get_db),
):
    """Calendario de un especialista según su horario, con los turnos libres por día.

    Lo usa la bandeja de solicitudes para verificar el médico antes de asignar
    o reprogramar una cita, sin depender del nivel de prioridad.
    """
    if dias < 1 or dias > 60:
        raise HTTPException(status_code=400, detail="dias debe estar entre 1 y 60.")

    esp = await _especialista(db, medico_id)
    hoy = (await db.execute(text("SELECT CURRENT_DATE AS hoy"))).scalar_one()
    inicio = hoy
    if desde:
        try:
            inicio = datetime.strptime(desde, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="desde inválida (YYYY-MM-DD).")
        if inicio < hoy:
            inicio = hoy
    fin = inicio + timedelta(days=dias - 1)

    agenda = await _turnos_agenda(db, medico_id)
    ocupadas: dict = {}
    filas = (
        await db.execute(
            text(
                "SELECT fecha_cita, to_char(hora_inicio, 'HH24:MI') AS h "
                "FROM citas WHERE medico_id = :mid AND fecha_cita BETWEEN :d AND :h "
                "  AND estado <> 'cancelada'"
            ),
            {"mid": medico_id, "d": inicio, "h": fin},
        )
    ).mappings()
    for f in filas:
        ocupadas.setdefault(f["fecha_cita"], set()).add(f["h"])

    ausentes = await _fechas_ausente(db, medico_id, inicio, fin)
    return {
        "medico_id": medico_id,
        "medico_nombre": esp["nombre"],
        "especialidad": esp["especialidad"],
        "fecha_desde": inicio.isoformat(),
        "fecha_hasta": fin.isoformat(),
        "dias": await _dias_disponibles(db, medico_id, agenda, ocupadas, inicio, fin, ausentes),
    }


@router.get("/semanas-resumen", response_model=List[ResumenSemanaItem])
async def semanas_resumen(
    medico_id: int,
    cantidad: int = 6,
    db: AsyncSession = Depends(get_db),
) -> List[ResumenSemanaItem]:
    """Devuelve un resumen de las próximas N semanas con los cupos disponibles.

    Permite mostrar en el desplegable de semanas si están en verde (con cupos)
    o en rojo (sin cupos / agotadas).
    """
    await _especialista(db, medico_id)

    if cantidad < 1 or cantidad > 12:
        cantidad = 6

    hoy = (await db.execute(text("SELECT CURRENT_DATE AS hoy"))).scalar_one()
    lunes_base = hoy - timedelta(days=hoy.weekday())
    fin_total = lunes_base + timedelta(weeks=cantidad - 1, days=4)

    agenda = await _turnos_agenda(db, medico_id)

    filas = (
        await db.execute(
            text(
                "SELECT fecha_cita, to_char(hora_inicio, 'HH24:MI') AS h "
                "FROM citas WHERE medico_id = :mid AND fecha_cita BETWEEN :d AND :h "
                "  AND estado NOT IN ('cancelada', 'preasignada')"
            ),
            {"mid": medico_id, "d": lunes_base, "h": fin_total},
        )
    ).mappings()
    ocupadas_por_fecha: dict = {}
    for f in filas:
        ocupadas_por_fecha.setdefault(f["fecha_cita"], set()).add(f["h"])

    ausentes = await _fechas_ausente(db, medico_id, lunes_base, fin_total)

    # Todas las semanas certificadas por RRHH en el rango, en una sola consulta.
    certificadas = await semanas_certificadas(db, medico_id, lunes_base, fin_total)

    DIAS_LABORABLES = {0, 1, 2, 3, 4}
    resumen: List[ResumenSemanaItem] = []
    MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

    MAX_CUPOS_TURNO = 10

    for offset in range(cantidad):
        inicio_sem = lunes_base + timedelta(weeks=offset)
        fin_sem = inicio_sem + timedelta(days=4)

        cupos_sem_total = 0
        tiene_horario_cargado = False

        cur = inicio_sem
        while cur <= fin_sem:
            if cur.weekday() in DIAS_LABORABLES and cur not in ausentes:
                turnos_dia = agenda.get(cur.weekday(), [])
                if turnos_dia:
                    tiene_horario_cargado = True
                ocupadas_hhmm = ocupadas_por_fecha.get(cur, set())
                grupos: dict = {}
                for slot in turnos_dia:
                    grupos.setdefault(slot["turno_id"], []).append(slot)

                for _, slots in grupos.items():
                    libres = [s for s in slots if _hhmm(s["hora_inicio"]) not in ocupadas_hhmm]
                    citas_ocupadas = len(slots) - len(libres)
                    cupos_libres_turno = max(0, MAX_CUPOS_TURNO - citas_ocupadas)
                    cupos_sem_total += min(cupos_libres_turno, len(libres))
            cur += timedelta(days=1)

        # Si aún no tiene horario cargado para esta semana futura, calcular cupos preasignables
        if not tiene_horario_cargado and offset > 0:
            citas_preasig_res = await db.execute(
                text(
                    "SELECT count(*) FROM citas "
                    "WHERE medico_id = :mid AND estado = 'preasignada' "
                    "  AND fecha_cita BETWEEN :d AND :h"
                ),
                {"mid": medico_id, "d": inicio_sem, "h": fin_sem},
            )
            citas_preasig = citas_preasig_res.scalar() or 0
            # Bolsa proyectada para preasignación semanal: hasta 20 pacientes preasignables
            cupos_sem_total = max(0, 20 - citas_preasig)

        # Una semana sin certificar no se muestra como abierta: recepción
        # solo puede preasignar en ella hasta que RRHH certifique.
        certificada = inicio_sem in certificadas
        if not certificada:
            cupos_sem_total = 0

        d_str = f"{inicio_sem.day:02d} {MESES[inicio_sem.month - 1]}"
        h_str = f"{fin_sem.day:02d} {MESES[fin_sem.month - 1]}"
        if offset == 0:
            etiqueta = f"Esta semana ({d_str} al {h_str})"
        elif offset == 1:
            etiqueta = f"Semana próxima ({d_str} al {h_str})"
        else:
            etiqueta = f"Semana {d_str} al {h_str}"

        resumen.append(
            ResumenSemanaItem(
                offset=offset,
                semana_desde=inicio_sem.isoformat(),
                semana_hasta=fin_sem.isoformat(),
                etiqueta=etiqueta,
                cupos_libres=cupos_sem_total,
                tiene_cupos=cupos_sem_total > 0,
                certificada=certificada,
            )
        )

    return resumen


@router.get("/cupos-semanal", response_model=CupoSemanalResponse)
async def cupos_semanal(
    medico_id: int,
    semana_desde: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Cupos disponibles por día de la semana para un médico.

    Solo días laborables (lunes a viernes) y solo si RRHH certificó la semana.
    Máximo 10 cupos por turno, sin tope semanal extra. Se calcula desde
    `agenda_medicos` (turnos configurados) menos citas ya registradas
    (no canceladas).

    El médico carga su horario el domingo para la semana siguiente.
    Se muestra solo los días que tiene cargados.

    Se usa para que el portal web y la recepción vean los mismos cupos
    y no se solapen asignaciones.
    """
    esp = await _especialista(db, medico_id)

    hoy = (await db.execute(text("SELECT CURRENT_DATE AS hoy"))).scalar_one()
    if semana_desde:
        try:
            inicio_semana = datetime.strptime(semana_desde, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=400, detail="semana_desde inválida (YYYY-MM-DD)."
            )
    else:
        # Lunes de la semana actual
        inicio_semana = hoy - timedelta(days=hoy.weekday())
    fin_semana = inicio_semana + timedelta(days=4)  # Lunes a viernes

    # Recepción solo ve la semana abierta si RRHH la certificó.
    certificada = await semana_certificada(db, medico_id, inicio_semana)

    agenda = await _turnos_agenda(db, medico_id)

    # Ocupadas de toda la semana (lunes a viernes)
    filas = (
        await db.execute(
            text(
                "SELECT fecha_cita, to_char(hora_inicio, 'HH24:MI') AS h, count(*) AS n "
                "FROM citas WHERE medico_id = :mid AND fecha_cita BETWEEN :d AND :h "
                "  AND estado NOT IN ('cancelada', 'preasignada') "
                "GROUP BY fecha_cita, to_char(hora_inicio, 'HH24:MI')"
            ),
            {"mid": medico_id, "d": inicio_semana, "h": fin_semana},
        )
    ).mappings()
    ocupadas_por_fecha: dict = {}
    for f in filas:
        ocupadas_por_fecha.setdefault(f["fecha_cita"], set()).add(f["h"])

    ausentes = await _fechas_ausente(db, medico_id, inicio_semana, fin_semana)

    DIAS_NOMBRE = [
        "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo",
    ]

    DIAS_LABORABLES = {0, 1, 2, 3, 4}  # Lunes a viernes

    dias: List[CupoDiaSemana] = []
    MAX_CUPOS_TURNO = 10  # Máximo 10 cupos por turno
    cur = inicio_semana
    while cur <= fin_semana:
        # Solo días laborables (lunes a viernes)
        if cur.weekday() not in DIAS_LABORABLES:
            cur += timedelta(days=1)
            continue

        turnos_del_dia = agenda.get(cur.weekday(), [])
        turnos_libres_dia: List[JornadaDisponible] = []
        cupos_dia = 0

        if certificada and cur not in ausentes and turnos_del_dia:
            ocupadas_hhmm = ocupadas_por_fecha.get(cur, set())
            grupos: dict = {}
            for slot in turnos_del_dia:
                grupos.setdefault(slot["turno_id"], []).append(slot)

            for turno_id, slots in grupos.items():
                slots.sort(key=lambda s: s["hora_inicio"])
                libres = [s for s in slots if _hhmm(s["hora_inicio"]) not in ocupadas_hhmm]
                citas_ocupadas = len(slots) - len(libres)
                cupos_libres_turno = max(0, MAX_CUPOS_TURNO - citas_ocupadas)
                libres_disponibles = libres[:cupos_libres_turno]
                if cupos_libres_turno > 0 and libres_disponibles:
                    nombre_turno = slots[0].get("turno_nombre") or (
                        "Mañana" if slots[0]["hora_inicio"].hour < 13 else "Tarde"
                    )
                    turnos_libres_dia.append(
                        JornadaDisponible(
                            turno_id=turno_id,
                            nombre=nombre_turno,
                            hora_inicio=_hhmm(slots[0]["hora_inicio"]),
                            hora_fin=_hhmm(slots[-1]["hora_fin"]),
                            capacidad=MAX_CUPOS_TURNO,
                            cupos_libres=len(libres_disponibles),
                            disponible=True,
                            hora_asignada=_hhmm(libres_disponibles[0]["hora_inicio"]),
                        )
                    )
                    cupos_dia += len(libres_disponibles)
            turnos_libres_dia.sort(key=lambda t: t.hora_inicio)

        dias.append(
            CupoDiaSemana(
                dia_semana=cur.weekday(),
                nombre=DIAS_NOMBRE[cur.weekday()],
                fecha=cur.isoformat(),
                turnos=turnos_libres_dia,
                cupos_libres=cupos_dia,
            )
        )
        cur += timedelta(days=1)

    cupos_libres_totales = sum(d.cupos_libres for d in dias)

    return CupoSemanalResponse(
        medico_id=medico_id,
        medico_nombre=esp["nombre"],
        especialidad=esp["especialidad"],
        semana_desde=inicio_semana.isoformat(),
        semana_hasta=fin_semana.isoformat(),
        certificada=certificada,
        dias=dias,
        cupos_libres_totales=cupos_libres_totales,
    )


@router.get("/semanas-certificadas")
async def semanas_certificadas_centro(
    clinica_id: Optional[int] = None,
    semanas_adelante: int = 8,
    db: AsyncSession = Depends(get_db),
):
    """Semanas del centro para citas programadas.

    Incluye las semanas certificadas por RRHH y también las próximas aunque
    todavía no estén certificadas: recepción necesita ver los pacientes que ya
    van registrados en ellas. Cada semana trae el conteo de citas activas
    (trabajadores, beneficiarios y público general) para el control rápido.
    """
    await asegurar_tabla(db)
    cid = clinica_id if clinica_id is not None else settings.id_centro

    certificadas = (
        await db.execute(
            text(
                "SELECT acs.semana_desde, "
                "       count(DISTINCT acs.medico_id) AS medicos_certificados "
                "FROM agenda_certificaciones_semana acs "
                "JOIN personal p ON p.id = acs.medico_id "
                "WHERE p.clinica_id = :cid "
                "GROUP BY acs.semana_desde"
            ),
            {"cid": cid},
        )
    ).mappings().all()
    mapa = {f["semana_desde"]: int(f["medicos_certificados"] or 0) for f in certificadas}

    lunes_actual = (
        await db.execute(
            text(
                "SELECT (CURRENT_DATE "
                "        - ((EXTRACT(DOW FROM CURRENT_DATE)::int + 6) % 7))::date AS lunes"
            )
        )
    ).scalar_one()

    adelante = max(1, min(semanas_adelante, 16))
    inicio = min([lunes_actual] + list(mapa))
    fin = max([lunes_actual + timedelta(weeks=adelante)] + list(mapa))

    # Citas activas de cada semana, clasificadas como en la nómina: un
    # beneficiario que también es trabajador activo cuenta como trabajador.
    filtro_centro = " AND c.centro_id = :cid" if cid is not None else ""
    filas = (
        await db.execute(
            text(
                "SELECT (c.fecha_cita "
                "        - ((EXTRACT(DOW FROM c.fecha_cita)::int + 6) % 7))::date AS lunes, "
                "       count(*) AS total, "
                "       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM empleados e "
                "                                     WHERE e.cedula = h.cedula)) AS trabajadores, "
                "       count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM empleados e "
                "                                          WHERE e.cedula = h.cedula) "
                "                         AND EXISTS (SELECT 1 FROM beneficiarios b "
                "                                     WHERE b.cedula = h.cedula)) AS beneficiarios, "
                "       count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM empleados e "
                "                                          WHERE e.cedula = h.cedula) "
                "                         AND NOT EXISTS (SELECT 1 FROM beneficiarios b "
                "                                             WHERE b.cedula = h.cedula)) AS publico_general "
                "FROM citas c "
                "LEFT JOIN historias_clinicas h ON h.id = c.paciente_id "
                "WHERE c.fecha_cita BETWEEN :desde AND :hasta "
                "  AND c.estado IN ('pendiente', 'preasignada', 'confirmada')"
                f"{filtro_centro} "
                "GROUP BY 1"
            ),
            {"desde": inicio, "hasta": fin + timedelta(days=4), "cid": cid},
        )
    ).mappings().all()
    conteos = {f["lunes"]: f for f in filas}

    ultima_certificada = max(mapa) if mapa else None
    semanas = []
    lunes = inicio
    while lunes <= fin:
        c = conteos.get(lunes)
        semanas.append(
            {
                "semana_desde": lunes.isoformat(),
                "semana_hasta": (lunes + timedelta(days=4)).isoformat(),
                "certificada": lunes in mapa,
                "medicos_certificados": mapa.get(lunes, 0),
                "es_ultima": ultima_certificada is not None and lunes == ultima_certificada,
                "es_actual": lunes == lunes_actual,
                "total_citas": int(c["total"] or 0) if c else 0,
                "trabajadores": int(c["trabajadores"] or 0) if c else 0,
                "beneficiarios": int(c["beneficiarios"] or 0) if c else 0,
                "publico_general": int(c["publico_general"] or 0) if c else 0,
            }
        )
        lunes += timedelta(weeks=1)

    return {
        "clinica_id": cid,
        "semana_actual": next((s for s in semanas if s["es_actual"]), None),
        "ultima_semana": (
            next((s for s in semanas if s["es_ultima"]), None) if ultima_certificada else None
        ),
        "semanas": semanas,
    }


def _jornadas_de_dia(
    agenda: dict, fecha: date, ocupadas: set, ausente: bool = False
) -> JornadasDia:
    """Agrupa las franjas del día por turno (Mañana, Tarde, ...).

    Devuelve un solo ítem por turno con su capacidad, cupos libres y la
    primera hora libre para asignar la cita. La solicitud de cita se hace por
    turno, no por cada media hora del día.
    """
    if ausente:
        return JornadasDia(
            fecha=fecha.isoformat(), disponible=False, motivo="médico ausente"
        )

    grupos: dict = {}
    for slot in agenda.get(fecha.weekday(), []):
        grupos.setdefault(slot["turno_id"], []).append(slot)

    turnos: List[JornadaDisponible] = []
    for turno_id, slots in grupos.items():
        slots.sort(key=lambda s: s["hora_inicio"])
        libres = [s for s in slots if _hhmm(s["hora_inicio"]) not in ocupadas]
        nombre_turno = slots[0].get("turno_nombre") or (
            "Mañana" if slots[0]["hora_inicio"].hour < 13 else "Tarde"
        )
        turnos.append(
            JornadaDisponible(
                turno_id=turno_id,
                nombre=nombre_turno,
                hora_inicio=_hhmm(slots[0]["hora_inicio"]),
                hora_fin=_hhmm(slots[-1]["hora_fin"]),
                capacidad=len(slots),
                cupos_libres=len(libres),
                disponible=bool(libres),
                hora_asignada=_hhmm(libres[0]["hora_inicio"]) if libres else None,
            )
        )
    turnos.sort(key=lambda t: t.hora_inicio)

    return JornadasDia(
        fecha=fecha.isoformat(),
        disponible=any(t.disponible for t in turnos),
        motivo="" if turnos else "no labora",
        turnos=turnos,
    )


def _generar_codigo(year: int) -> str:
    sufijo = "".join(random.choices(string.hexdigits.upper(), k=4))
    return f"CITAB-{year}-{sufijo}"


@router.post("/citas", response_model=CitaCreadaResponse, status_code=status.HTTP_201_CREATED)
async def crear_cita(
    payload: CitaCrearRequest,
    db: AsyncSession = Depends(get_db),
) -> CitaCreadaResponse:
    """Crea una cita de remisión o confirma una solicitud del portal web."""
    if payload.nivel not in NIVELES:
        raise HTTPException(status_code=400, detail="nivel inválido: debe ser azul, verde o amarillo.")

    try:
        fec = datetime.strptime(payload.fecha, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="fecha inválida (YYYY-MM-DD).")

    # Determinar la hora y estado de la cita:
    hora = None
    turno_rango = None
    es_preasignada = bool(payload.preasignada)

    if es_preasignada:
        hora = time(8, 0)
    elif payload.hora_inicio:
        try:
            hora = datetime.strptime(payload.hora_inicio, "%H:%M").time()
        except ValueError:
            raise HTTPException(status_code=400, detail="hora_inicio inválida (HH:MM).")
    elif payload.turno_id is not None:
        # Buscar el turno en la agenda del médico para ese día de la semana.
        agenda = await _turnos_agenda(db, payload.medico_id)
        turnos_dia = agenda.get(fec.weekday(), [])
        turno_encontrado = next(
            (t for t in turnos_dia if t["turno_id"] == payload.turno_id), None
        )
        if not turno_encontrado:
            raise HTTPException(
                status_code=400,
                detail=f"El turno {payload.turno_id} no está activo para el médico el {payload.fecha}.",
            )
        turno_rango = turno_encontrado
        try:
            hora = datetime.strptime(str(turno_encontrado["hora_inicio"]), "%H:%M:%S").time()
        except ValueError:
            hora = datetime.strptime(str(turno_encontrado["hora_inicio"]), "%H:%M").time()
    else:
        raise HTTPException(
            status_code=400,
            detail="Es obligatorio indicar hora_inicio o turno_id.",
        )

    esp = await _especialista(db, payload.medico_id)

    ausentes = await _fechas_ausente(db, payload.medico_id, fec, fec)
    if fec in ausentes:
        raise HTTPException(
            status_code=409,
            detail=f"El especialista está ausente el {payload.fecha}.",
        )

    # Bloqueo a nivel de transacción sobre el turno/médico/fecha para evitar
    # doble-reserva entre peticiones concurrentes (web y recepción).
    hora_lock = str(hora)[:5] if hora else payload.hora_inicio or ""
    await db.execute(
        text(
            "SELECT pg_advisory_xact_lock(hashtextextended("
            "  :mid || '|' || :fec || '|' || :hora, 0))"
        ),
        {
            "mid": str(payload.medico_id),
            "fec": fec.isoformat(),
            "hora": hora_lock,
        },
    )

    # Solicitud del portal web: recepción confirma la cita existente en vez
    # de crear un registro nuevo. Se conserva el centro y el paciente.
    if payload.cita_id:
        existente = (
            await db.execute(
                text(
                    "SELECT id, codigo_confirmacion, estado, medico_id, "
                    "       fecha_cita, hora_inicio, especialidad, "
                    "       paciente_id, centro_id, centro_salud "
                    "FROM citas WHERE id = :id"
                ),
                {"id": payload.cita_id},
            )
        ).mappings().first()
        if not existente:
            raise HTTPException(status_code=404, detail="La solicitud de cita no existe.")
        if existente["estado"] in ("cancelada", "finalizada"):
            raise HTTPException(
                status_code=409,
                detail="No se puede asignar una solicitud cancelada o finalizada.",
            )

        if not es_preasignada:
            agenda = await _turnos_agenda(db, payload.medico_id)
            turnos = agenda.get(fec.weekday(), [])
            turno = next(
                (t for t in turnos if str(t["hora_inicio"])[:5] == str(hora)[:5]),
                None,
            )
            if not turno:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"El especialista no atiende ese día/hora "
                        f"({payload.fecha} {str(hora)[:5]})."
                    ),
                )
            ocupadas = await _horas_ocupadas(db, payload.medico_id, fec)
            misma_cita = (
                existente["medico_id"] == payload.medico_id
                and str(existente["fecha_cita"])[:10] == fec.isoformat()
                and str(existente["hora_inicio"])[:5] == str(hora)[:5]
            )
            if str(hora)[:5] in ocupadas and not misma_cita:
                raise HTTPException(
                    status_code=409,
                    detail=f"Esa hora ({str(hora)[:5]}) ya está ocupada.",
                )

        esp_nombre = (
            payload.especialidad
            or existente["especialidad"]
            or esp["especialidad"]
        )
        estado_nuevo = "preasignada" if es_preasignada else "confirmada"
        r = await db.execute(
            text(
                "UPDATE citas SET "
                "  medico_id = :mid, fecha_cita = :fec, hora_inicio = :hora, "
                "  estado = :est, especialidad = :esp, "
                "  motivo = COALESCE(:mot, motivo) "
                "WHERE id = :id "
                "RETURNING id, codigo_confirmacion, especialidad, paciente_id, centro_id, centro_salud"
            ),
            {
                "mid": payload.medico_id,
                "fec": fec,
                "hora": hora,
                "est": estado_nuevo,
                "esp": esp_nombre,
                "mot": payload.motivo,
                "id": payload.cita_id,
            },
        )
        await db.commit()
        fila = r.mappings().first()

        # Datos del paciente para notificación y WhatsApp Web
        paciente_fila = None
        pid = fila.get("paciente_id") or existente.get("paciente_id")
        if pid:
            paciente_fila = (
                await db.execute(
                    text("SELECT id, cedula, nombre_completo, telefono, email FROM historias_clinicas WHERE id = :pid"),
                    {"pid": pid},
                )
            ).mappings().first()

        # Resolver centro de salud
        centro_nombre = fila.get("centro_salud") or existente.get("centro_salud")
        cid = fila.get("centro_id") or existente.get("centro_id") or settings.id_centro
        if not centro_nombre and cid:
            c_row = (
                await db.execute(
                    text("SELECT nombre FROM clinicas WHERE id = :cid"),
                    {"cid": cid},
                )
            ).mappings().first()
            if c_row:
                centro_nombre = c_row["nombre"]
        if not centro_nombre:
            centro_nombre = "BnaSalud"

        # Nombre del médico asignado
        medico_nombre = esp.get("nombre", "") if isinstance(esp, dict) else getattr(esp, "nombre", "")

        # Registrar notificación en la base de datos para el portal web del paciente
        if pid:
            try:
                asunto = f"Cita confirmada en {centro_nombre}"
                cod_cita = fila["codigo_confirmacion"] or ""
                detalle = (
                    f"Su cita para {esp_nombre} ha sido confirmada para el {fec.strftime('%d/%m/%Y')} "
                    f"a las {payload.hora_inicio} con el Dr(a). {medico_nombre} en {centro_nombre}. "
                    f"Código de confirmación: {cod_cita}."
                )
                destinatario = ""
                if paciente_fila:
                    destinatario = paciente_fila.get("email") or paciente_fila.get("telefono") or ""
                await db.execute(
                    text(
                        "INSERT INTO notificaciones "
                        "  (paciente_id, tipo, canal, asunto, destinatario, estado, detalle, referencia, enviado_en) "
                        "VALUES "
                        "  (:pid, 'recordatorio_cita', 'sistema', :asunto, :dest, 'enviado', :detalle, :ref, NOW())"
                    ),
                    {
                        "pid": pid,
                        "asunto": asunto,
                        "dest": destinatario,
                        "detalle": detalle,
                        "ref": f"cita:{fila['id']}",
                    },
                )
                await db.commit()
            except Exception as e:
                logger.warning(f"No se pudo registrar la notificación en BD: {e}")

        # Mensaje personalizado y enlace de WhatsApp Web
        paciente_nombre = (
            paciente_fila["nombre_completo"]
            if paciente_fila and paciente_fila.get("nombre_completo")
            else "Paciente"
        )
        telefono = paciente_fila.get("telefono") if paciente_fila else None
        wa_telefono = ""
        if telefono:
            digits = re.sub(r"\D", "", str(telefono))
            if digits.startswith("58"):
                wa_telefono = digits
            elif digits.startswith("0"):
                wa_telefono = f"58{digits[1:]}"
            elif len(digits) == 10:
                wa_telefono = f"58{digits}"
            else:
                wa_telefono = digits

        cod_cita = fila["codigo_confirmacion"] or ""
        wa_msg = (
            f"¡Hola {paciente_nombre}! Le saludamos de *{centro_nombre}*.\n\n"
            f"Le informamos que su cita médica ha sido *CONFIRMADA* con éxito:\n\n"
            f"🩺 *Especialidad:* {esp_nombre}\n"
            f"👨‍⚕️ *Médico:* Dr(a). {medico_nombre}\n"
            f"📅 *Fecha:* {fec.strftime('%d/%m/%Y')}\n"
            f"⏰ *Hora:* {str(hora)[:5]}\n"
            f"🔖 *Código de cita:* {cod_cita}\n\n"
            f"Por favor acuda 15 minutos antes con su cédula de identidad. ¡Le esperamos!"
        )
        wa_url = f"https://wa.me/{wa_telefono}?text={quote(wa_msg)}" if wa_telefono else None

        # Notificar al portal web (Supabase) que la cita fue confirmada/asignada
        # para que el paciente vea el estado en su portal y reciba la notificación.
        try:
            await notificar_confirmacion_supabase(
                cita_id=str(fila["id"]),
                paciente_id=pid,
                medico_id=payload.medico_id,
                medico_nombre=medico_nombre,
                fecha_cita=fec.isoformat(),
                hora_inicio=str(hora)[:5],
                centro_nombre=centro_nombre,
                especialidad=esp_nombre,
                codigo_confirmacion=cod_cita,
                destinatario=(
                    (paciente_fila.get("telefono") or paciente_fila.get("email") or "")
                    if paciente_fila
                    else ""
                ),
            )
        except Exception as e:
            logger.warning(f"No se pudo notificar la confirmación al portal web: {e}")

        return CitaCreadaResponse(
            cita_id=str(fila["id"]),
            codigo_confirmacion=fila["codigo_confirmacion"] or "",
            especialidad=fila["especialidad"] or esp_nombre,
            medico_id=payload.medico_id,
            fecha_cita=fec.isoformat(),
            hora_inicio=str(hora)[:5],
            estado="preasignada" if es_preasignada else "confirmada",
            paciente_nombre=paciente_nombre,
            paciente_telefono=telefono,
            medico_nombre=medico_nombre,
            centro_salud=centro_nombre,
            whatsapp_url=wa_url,
            whatsapp_mensaje=wa_msg,
        )

    # Validación de ventana por nivel de prioridad.
    hoy = (await db.execute(text("SELECT CURRENT_DATE AS hoy"))).scalar_one()
    min_fecha = hoy + timedelta(days=DIAS_VENTANA[payload.nivel])
    if fec < min_fecha:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Para prioridad '{payload.nivel}' la fecha mínima es {min_fecha.isoformat()} "
                f"(lleva {DIAS_VENTANA[payload.nivel]} días de antelación)."
            ),
        )

    # Validar que el slot esté disponible (turno activo ese día y sin cita).
    agenda = await _turnos_agenda(db, payload.medico_id)
    turnos = agenda.get(fec.weekday(), [])
    turno = next((t for t in turnos if str(t["hora_inicio"])[:5] == str(hora)[:5]), None)
    if not turno:
        raise HTTPException(
            status_code=400,
            detail=f"El especialista no atiende ese día/hora ({payload.fecha} {str(hora)[:5]}).",
        )
    ocupadas = await _horas_ocupadas(db, payload.medico_id, fec)
    if str(hora)[:5] in ocupadas:
        raise HTTPException(status_code=409, detail=f"Esa hora ({str(hora)[:5]}) ya está ocupada.")

    codigo = _generar_codigo(fec.year)
    while True:
        existe = (
            await db.execute(text("SELECT 1 FROM citas WHERE codigo_confirmacion = :c"), {"c": codigo})
        ).first()
        if not existe:
            break
        codigo = _generar_codigo(fec.year)

    paciente_id = payload.paciente_id or None
    cid = settings.id_centro
    centro_salud = "CITAB"
    if cid:
        c_row = (
            await db.execute(
                text("SELECT nombre FROM clinicas WHERE id = :cid"),
                {"cid": cid},
            )
        ).mappings().first()
        if c_row:
            centro_salud = c_row["nombre"]

    r = await db.execute(
        text(
            "INSERT INTO citas "
            "(id, paciente_id, centro_id, centro_salud, especialidad, medico_id, fecha_cita, hora_inicio, "
            " motivo, origen, estado, codigo_confirmacion, created_at) "
            "VALUES (gen_random_uuid(), :pid, :cid, :centro_salud, :esp, :mid, :fec, :hora, :mot, :origen, "
            " 'pendiente', :cod, now()) "
            "RETURNING id, codigo_confirmacion"
        ),
        {
            "pid": paciente_id,
            "cid": cid,
            "centro_salud": centro_salud,
            "esp": payload.especialidad or esp["especialidad"],
            "mid": payload.medico_id,
            "fec": fec,
            "hora": hora,
            "mot": payload.motivo,
            "origen": payload.origen or "remision",
            "cod": codigo,
        },
    )
    await db.commit()
    fila = r.mappings().first()

    return CitaCreadaResponse(
        cita_id=str(fila["id"]),
        codigo_confirmacion=fila["codigo_confirmacion"],
        especialidad=payload.especialidad or esp["especialidad"],
        medico_id=payload.medico_id,
        fecha_cita=fec.isoformat(),
        hora_inicio=str(hora)[:5],
        estado="pendiente",
        centro_salud=centro_salud,
    )


@router.post(
    "/reprogramar-todas",
    response_model=ReprogramarTodasResponse,
    status_code=status.HTTP_200_OK,
    summary="Reprograma todas las citas restantes del día del especialista",
)
async def reprogramar_todas(
    payload: ReprogramarTodasRequest,
    db: AsyncSession = Depends(get_db),
) -> ReprogramarTodasResponse:
    """Mueve a una nueva fecha/hora TODOS los pacientes restantes de HOY del especialista.

    Cancela los registros de cola_atencion no terminales vinculados al médico y:
    - Si tienen una cita asociada, la actualiza a la nueva fecha/hora.
    - Si no tienen cita, crea una nueva cita para el paciente.
    """
    await _especialista(db, payload.medico_id)

    try:
        fec = date.fromisoformat(payload.fecha)
        hora = time.fromisoformat(payload.hora_inicio)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="fecha u hora inválidas (formato YYYY-MM-DD / HH:MM).",
        )

    ausentes = await _fechas_ausente(db, payload.medico_id, fec, fec)
    if fec in ausentes:
        raise HTTPException(
            status_code=409,
            detail=f"El especialista está ausente el {payload.fecha}.",
        )

    agenda = await _turnos_agenda(db, payload.medico_id)
    turnos = agenda.get(fec.weekday(), [])
    turno = next(
        (t for t in turnos if str(t["hora_inicio"])[:5] == payload.hora_inicio),
        None,
    )
    if not turno:
        raise HTTPException(
            status_code=400,
            detail=(
                f"El especialista no atiende ese día/hora "
                f"({payload.fecha} {payload.hora_inicio})."
            ),
        )

    hoy = (await db.execute(text("SELECT CURRENT_DATE AS hoy"))).scalar_one()

    cola_result = await db.execute(
        select(ColaAtencion).where(
            ColaAtencion.medico_id == payload.medico_id,
            ColaAtencion.atencion_estado.in_([
                EstadoAtencionEnum.EN_ESPERA_CONSULTA,
                EstadoAtencionEnum.EN_CONSULTA,
            ]),
        )
    )
    colas = list(cola_result.scalars().all())
    if not colas:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay pacientes restantes hoy para reprogramar.",
        )

    ids_cola = [c.id for c in colas]
    cita_ids_existentes = [str(c.cita_id) for c in colas if c.cita_id]

    params: dict = {"mid": payload.medico_id, "fec": fec}
    excl = ""
    if cita_ids_existentes:
        excl = " AND id::text <> ALL(:excl)"
        params["excl"] = cita_ids_existentes
    ocup = await db.execute(
        text(
            "SELECT to_char(hora_inicio, 'HH24:MI') AS h FROM citas "
            "WHERE medico_id = :mid AND fecha_cita = :fec AND estado <> 'cancelada'"
            + excl
        ),
        params,
    )
    if payload.hora_inicio in {f["h"] for f in ocup.mappings()}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El turno seleccionado ya está ocupado.",
        )

    ahora_utc = datetime.now(timezone.utc)
    canceladas = 0
    movidas = 0

    for cola in colas:
        estado_previo = cola.atencion_estado.value
        cola.atencion_estado = EstadoAtencionEnum.CANCELADO
        cola.fin_en = ahora_utc
        cola.cancelado_en = ahora_utc
        db.add(
            ColaAtencionHistorial(
                cola_id=cola.id,
                estado_anterior=estado_previo,
                estado_nuevo=EstadoAtencionEnum.CANCELADO.value,
                cambiado_por=payload.medico_id,
                observacion="Cita postpuesta",
                creado_en=ahora_utc,
            )
        )
        canceladas += 1

        if cola.cita_id is not None:
            existe_cita = (
                await db.execute(
                    text("SELECT id FROM citas WHERE id = :cid AND estado <> 'cancelada'"),
                    {"cid": cola.cita_id},
                )
            ).first()
            if existe_cita:
                await db.execute(
                    text(
                        "UPDATE citas SET fecha_cita = :fec, hora_inicio = :hora, "
                        "cola_id = NULL WHERE id = :cid"
                    ),
                    {"fec": fec, "hora": hora, "cid": cola.cita_id},
                )
                movidas += 1
                continue

        codigo = _generar_codigo(fec.year)
        while True:
            existe = (
                await db.execute(text("SELECT 1 FROM citas WHERE codigo_confirmacion = :c"), {"c": codigo})
            ).first()
            if not existe:
                break
            codigo = _generar_codigo(fec.year)

        await db.execute(
            text(
                "INSERT INTO citas "
                "(id, paciente_id, centro_salud, especialidad, medico_id, fecha_cita, hora_inicio, "
                " motivo, origen, estado, codigo_confirmacion, created_at) "
                "VALUES (gen_random_uuid(), :pid, 'CITAB', :esp, :mid, :fec, :hora, :mot, 'reprogramacion', "
                " 'pendiente', :cod, now()) "
                "RETURNING id, codigo_confirmacion"
            ),
            {
                "pid": cola.paciente_id,
                "esp": cola.especialidad or "",
                "mid": payload.medico_id,
                "fec": fec,
                "hora": hora,
                "mot": cola.motivo_consulta or "Reprogramación por postergación",
                "cod": codigo,
            },
        )
        movidas += 1

    try:
        await db.commit()
    except Exception as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al reprogramar las citas: {err}",
        )

    return ReprogramarTodasResponse(
        movidas=movidas,
        canceladas=canceladas,
        fecha=payload.fecha,
        hora_inicio=payload.hora_inicio,
    )
