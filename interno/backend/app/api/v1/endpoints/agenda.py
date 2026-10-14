"""Endpoints de agenda de remisión: especialistas, disponibilidad y citas."""
import random
import string
from datetime import date, datetime, time, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.cola import (
    ColaAtencion,
    ColaAtencionHistorial,
    EstadoAtencionEnum,
)
from app.schemas.agenda import (
    CitaCreadaResponse,
    CitaCrearRequest,
    DiaDisponibilidad,
    DisponibilidadResponse,
    EspecialistaItem,
    ReprogramarTodasRequest,
    ReprogramarTodasResponse,
)

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
            "  AND ( (LOWER(p.cargo) = 'medico' AND p.especialidad IS NOT NULL) "
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


def _slots_de_turno(turno_id: int, hora_inicio: time, hora_fin: time) -> List[dict]:
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
            "SELECT a.dia_semana, t.id AS turno_id, t.hora_inicio, t.hora_fin "
            "FROM agenda_medicos a "
            "JOIN turnos t ON t.id = a.turno_id "
            "WHERE a.medico_id = :mid AND a.activo = TRUE"
        ),
        {"mid": medico_id},
    )
    agenda: dict = {}
    for f in r.mappings():
        agenda.setdefault(f["dia_semana"], []).extend(
            _slots_de_turno(f["turno_id"], f["hora_inicio"], f["hora_fin"])
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


def _dias_disponibles(
    agenda: dict,
    ocupadas_por_fecha: dict,
    desde: date,
    hasta: date,
) -> List[DiaDisponibilidad]:
    dias: List[DiaDisponibilidad] = []
    cur = desde
    while cur <= hasta:
        turnos = agenda.get(cur.weekday(), [])
        libres = []
        for turno in turnos:
            hh = str(turno["hora_inicio"])[:5]
            if hh not in ocupadas_por_fecha.get(cur, set()):
                libres.append(
                    {
                        "turno_id": turno["turno_id"],
                        "hora_inicio": hh,
                        "hora_fin": str(turno["hora_fin"])[:5],
                    }
                )
        dias.append(
            DiaDisponibilidad(
                fecha=cur.isoformat(),
                disponible=bool(libres),
                motivo="" if libres else ("turnos agotados" if turnos else "no labora"),
                turnos_libres=libres,
            )
        )
        cur += timedelta(days=1)
    return dias


@router.get("/especialistas", response_model=List[EspecialistaItem])
async def listar_especialistas(
    db: AsyncSession = Depends(get_db),
) -> List[EspecialistaItem]:
    """Lista los especialistas disponibles para remisión (carga real del CITAB)."""
    r = await db.execute(
        text(
            "SELECT p.id, p.nombre, p.apellido, COALESCE(p.especialidad,'') AS especialidad, "
            "       EXISTS(SELECT 1 FROM usuarios u "
            "              WHERE u.personal_id = p.id AND u.rol = 'medico_emergencia') AS emergencia "
            "FROM personal p "
            "WHERE (LOWER(p.cargo) = 'medico' AND p.especialidad IS NOT NULL) "
            "   OR EXISTS(SELECT 1 FROM usuarios u "
            "              WHERE u.personal_id = p.id AND u.rol = 'medico_emergencia') "
            "ORDER BY p.especialidad NULLS LAST, p.nombre"
        )
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

    dias = _dias_disponibles(agenda, ocupadas, desde, hasta)
    return DisponibilidadResponse(
        medico_id=medico_id,
        nivel=nivel,
        fecha_desde=desde.isoformat(),
        fecha_hasta=hasta.isoformat(),
        dias=dias,
    )


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
    return _dias_disponibles(agenda, {fec: ocupadas}, fec, fec)


def _generar_codigo(year: int) -> str:
    sufijo = "".join(random.choices(string.hexdigits.upper(), k=4))
    return f"CITAB-{year}-{sufijo}"


@router.post("/citas", response_model=CitaCreadaResponse, status_code=status.HTTP_201_CREATED)
async def crear_cita(
    payload: CitaCrearRequest,
    db: AsyncSession = Depends(get_db),
) -> CitaCreadaResponse:
    """Crea una cita de remisión validando la ventana según nivel de prioridad."""
    if payload.nivel not in NIVELES:
        raise HTTPException(status_code=400, detail="nivel inválido: debe ser azul, verde o amarillo.")

    try:
        fec = datetime.strptime(payload.fecha, "%Y-%m-%d").date()
        hora = datetime.strptime(payload.hora_inicio, "%H:%M").time()
    except ValueError:
        raise HTTPException(status_code=400, detail="fecha/hora inválidas.")

    esp = await _especialista(db, payload.medico_id)

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
    turno = next((t for t in turnos if str(t["hora_inicio"])[:5] == payload.hora_inicio), None)
    if not turno:
        raise HTTPException(
            status_code=400,
            detail=f"El especialista no atiende ese día/hora ({payload.fecha} {payload.hora_inicio}).",
        )
    ocupadas = await _horas_ocupadas(db, payload.medico_id, fec)
    if payload.hora_inicio in ocupadas:
        raise HTTPException(status_code=409, detail=f"Esa hora ({payload.hora_inicio}) ya está ocupada.")

    codigo = _generar_codigo(fec.year)
    while True:
        existe = (
            await db.execute(text("SELECT 1 FROM citas WHERE codigo_confirmacion = :c"), {"c": codigo})
        ).first()
        if not existe:
            break
        codigo = _generar_codigo(fec.year)

    paciente_id = payload.paciente_id or None
    r = await db.execute(
        text(
            "INSERT INTO citas "
            "(id, paciente_id, centro_salud, especialidad, medico_id, fecha_cita, hora_inicio, "
            " motivo, origen, estado, codigo_confirmacion, created_at) "
            "VALUES (gen_random_uuid(), :pid, 'CITAB', :esp, :mid, :fec, :hora, :mot, :origen, "
            " 'pendiente', :cod, now()) "
            "RETURNING id, codigo_confirmacion"
        ),
        {
            "pid": paciente_id,
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
        hora_inicio=payload.hora_inicio,
        estado="pendiente",
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
