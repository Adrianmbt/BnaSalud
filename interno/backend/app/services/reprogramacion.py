"""Lógica de reprogramación de citas por ausencia del médico.

No mueve citas al generar el plan: crea propuestas. La cita original solo
cambia cuando recepción confirma y el hueco sigue libre.
"""

import logging
from datetime import date, datetime, time, timedelta
from typing import Dict, Iterable, List, Optional, Set, Tuple
from urllib.parse import quote

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.agenda import (
    _fechas_ausente,
    _horas_ocupadas,
    _turnos_agenda,
)
from app.services.afiliacion import categorias_por_cedula, normalizar_cedula

HORIZONTE_DIAS = 60
MAX_SEMANAS_MISMO_DIA = 9
ESTRATEGIAS = {"mismo_dia_semana", "primer_hueco", "fecha_objetivo"}
ESTADOS_ACTIVOS = ("pendiente", "confirmada")

logger = logging.getLogger(__name__)


def _iso(valor) -> Optional[str]:
    if valor is None:
        return None
    if hasattr(valor, "isoformat"):
        return valor.isoformat()
    return str(valor)


def _hhmm(valor) -> str:
    return str(valor)[:5] if valor is not None else ""


def _parse_fecha(valor: str) -> date:
    return datetime.strptime(valor, "%Y-%m-%d").date()


def _parse_hora(valor: str) -> time:
    return datetime.strptime(valor, "%H:%M").time()


def _minutos(valor: time) -> int:
    return valor.hour * 60 + valor.minute


async def _hoy_ahora(db: AsyncSession) -> Tuple[date, time]:
    fila = (
        await db.execute(
            text("SELECT CURRENT_DATE AS hoy, to_char(CURRENT_TIME::time, 'HH24:MI') AS ahora")
        )
    ).mappings().first()
    return fila["hoy"], _parse_hora(fila["ahora"])


async def listar_citas(
    db: AsyncSession,
    *,
    estado: Optional[str] = None,
    origen: Optional[str] = None,
    especialidad: Optional[str] = None,
    medico_id: Optional[int] = None,
    centro_id: Optional[int] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> dict:
    condiciones: List[str] = []
    params: dict = {}

    if centro_id:
        try:
            from app.services.sincronizacion_portal import sincronizar_solicitudes_supabase
            # Traer todas las citas web pendientes de Supabase (sin filtro remoto por
            # centro, pues el centro remoto puede diferir del de esta sede). El filtro
            # por centro se aplica luego en la consulta SQL local.
            await sincronizar_solicitudes_supabase(db, None)
        except Exception:
            logger.exception("Falló la sincronización de solicitudes web con Supabase")

    if estado:
        condiciones.append("c.estado = :estado")
        params["estado"] = estado
    if origen:
        condiciones.append("c.origen = :origen")
        params["origen"] = origen
    if especialidad:
        # La cita guarda su propia especialidad; si viene vacía se usa la del médico.
        # La BD mezcla variantes con y sin tilde ("Cardiologia"/"Cardiología"), así
        # que la comparación ignora tildes en ambos lados.
        condiciones.append(
            "LOWER(TRIM(TRANSLATE("
            "  COALESCE(NULLIF(c.especialidad, ''), p.especialidad, ''), "
            "  'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouAEIOUuUnN'))) "
            "= LOWER(TRIM(TRANSLATE(:especialidad, 'áéíóúÁÉÍÓÚüÜñÑ', 'aeiouAEIOUuUnN')))"
        )
        params["especialidad"] = especialidad.strip()
    if medico_id:
        condiciones.append("c.medico_id = :medico_id")
        params["medico_id"] = medico_id
    if centro_id:
        condiciones.append("c.centro_id = :centro_id")
        params["centro_id"] = centro_id
    if fecha_desde:
        condiciones.append("c.fecha_cita >= :fecha_desde")
        params["fecha_desde"] = _parse_fecha(fecha_desde)
    if fecha_hasta:
        condiciones.append("c.fecha_cita <= :fecha_hasta")
        params["fecha_hasta"] = _parse_fecha(fecha_hasta)
    if q:
        condiciones.append(
            "(h.nombre_completo ILIKE :q OR h.cedula ILIKE :q OR h.telefono ILIKE :q)"
        )
        params["q"] = f"%{q.strip()}%"

    where = "WHERE " + " AND ".join(condiciones) if condiciones else ""
    offset = (page - 1) * limit

    base = (
        "FROM citas c "
        "LEFT JOIN historias_clinicas h ON h.id = c.paciente_id "
        "LEFT JOIN personal p ON p.id = c.medico_id "
        f"{where}"
    )

    total = (
        await db.execute(text(f"SELECT count(*) AS total {base}"), params)
    ).scalar_one()

    params_pag = {**params, "limit": limit, "offset": offset}
    filas = (
        await db.execute(
            text(
                "SELECT c.id, c.paciente_id, h.nombre_completo AS paciente_nombre, "
                "       h.cedula AS paciente_cedula, h.telefono AS paciente_telefono, "
                "       c.medico_id, p.nombre || ' ' || COALESCE(p.apellido, '') AS medico_nombre, "
                "       c.especialidad, c.centro_id, c.centro_salud, c.fecha_cita, "
                "       c.hora_inicio, c.motivo, c.origen, c.estado, "
                "       c.codigo_confirmacion, c.created_at "
                f"{base} "
                "ORDER BY CASE WHEN c.estado = 'pendiente' THEN 0 ELSE 1 END, c.created_at DESC "
                "LIMIT :limit OFFSET :offset"
            ),
            params_pag,
        )
    ).mappings().all()

    # Prioridad de nómina: trabajador | beneficiario | general según la cédula.
    categorias = await categorias_por_cedula(
        db, [f["paciente_cedula"] for f in filas]
    )

    items = []
    for f in filas:
        item = {
            "id": str(f["id"]),
            "paciente_id": str(f["paciente_id"]) if f["paciente_id"] else None,
            "paciente_nombre": f["paciente_nombre"],
            "paciente_cedula": f["paciente_cedula"],
            "paciente_telefono": f["paciente_telefono"],
            "tipo_afiliacion": categorias.get(
                normalizar_cedula(f["paciente_cedula"]), "general"
            ),
            "medico_id": f["medico_id"],
            "medico_nombre": (f["medico_nombre"] or "").strip() or None,
            "especialidad": f["especialidad"],
            "centro_id": f["centro_id"],
            "centro_salud": f["centro_salud"],
            "fecha_cita": _iso(f["fecha_cita"]),
            "hora_inicio": _hhmm(f["hora_inicio"]),
            "motivo": f["motivo"],
            "origen": f["origen"],
            "estado": f["estado"],
            "codigo_confirmacion": f["codigo_confirmacion"],
            "created_at": _iso(f["created_at"]),
        }

        # Enlace WhatsApp solo para citas ya asignadas (confirmadas) con teléfono.
        if f["estado"] == "confirmada" and f["paciente_telefono"]:
            tel_wa = _telefono_wa(f["paciente_telefono"])
            if tel_wa:
                dia = _iso(f["fecha_cita"])
                try:
                    from datetime import datetime as _dt

                    dia = _dt.strptime(dia, "%Y-%m-%d").strftime("%d/%m/%Y")
                except ValueError:
                    pass
                mensaje = (
                    f"¡Hola {f['paciente_nombre']}! Le saludamos de CITAB. "
                    f"Le informamos que su cita en la especialidad "
                    f'"{(f["especialidad"] or "").strip()}" fue asignada con '
                    f'el Dr(a). {(f["medico_nombre"] or "").strip()} el día {dia} '
                    f'a las {f["hora_inicio"]}.'
                )
                item["mensaje_whatsapp"] = mensaje
                item["link_whatsapp"] = (
                    f"https://wa.me/{tel_wa}?text={quote(mensaje)}"
                )

        items.append(item)

    return {"items": items, "total": total, "page": page, "limit": limit}


async def listar_afectadas(
    db: AsyncSession, medico_id: int, fecha_desde: date, fecha_hasta: date
) -> List[dict]:
    filas = (
        await db.execute(
            text(
                "SELECT c.id, c.fecha_cita, c.hora_inicio, c.paciente_id, "
                "       h.nombre_completo, h.cedula, h.telefono, "
                "       c.especialidad, c.centro_salud "
                "FROM citas c "
                "LEFT JOIN historias_clinicas h ON h.id = c.paciente_id "
                "WHERE c.medico_id = :mid "
                "  AND c.fecha_cita BETWEEN :desde AND :hasta "
                "  AND c.estado IN ('pendiente', 'confirmada') "
                "ORDER BY c.fecha_cita, c.hora_inicio, c.created_at"
            ),
            {
                "mid": medico_id,
                "desde": fecha_desde,
                "hasta": fecha_hasta,
            },
        )
    ).mappings().all()

    return [
        {
            "id": str(f["id"]),
            "fecha_cita": f["fecha_cita"],
            "hora_inicio": _hhmm(f["hora_inicio"]),
            "paciente_id": str(f["paciente_id"]) if f["paciente_id"] else None,
            "paciente_nombre": f["nombre_completo"],
            "paciente_cedula": f["cedula"],
            "paciente_telefono": f["telefono"],
            "especialidad": f["especialidad"],
            "centro_salud": f["centro_salud"],
        }
        for f in filas
    ]


async def _ocupadas_rango(
    db: AsyncSession,
    medico_id: int,
    desde: date,
    hasta: date,
    excluir: Iterable[str],
) -> Dict[date, Set[str]]:
    params: dict = {"mid": medico_id, "desde": desde, "hasta": hasta}
    excl = ""
    excl_ids = [str(x) for x in excluir]
    if excl_ids:
        excl = " AND id::text <> ALL(:excl)"
        params["excl"] = excl_ids

    filas = (
        await db.execute(
            text(
                "SELECT fecha_cita, to_char(hora_inicio, 'HH24:MI') AS h "
                "FROM citas "
                "WHERE medico_id = :mid AND fecha_cita BETWEEN :desde AND :hasta "
                "  AND estado <> 'cancelada'" + excl
            ),
            params,
        )
    ).mappings().all()

    ocupadas: Dict[date, Set[str]] = {}
    for f in filas:
        ocupadas.setdefault(f["fecha_cita"], set()).add(f["h"])
    return ocupadas


def _candidatos(
    estrategia: str,
    desde: date,
    original_fecha: date,
    fecha_objetivo: Optional[date],
) -> Iterable[date]:
    if estrategia == "fecha_objetivo":
        if fecha_objetivo is None:
            raise ValueError("fecha_objetivo es obligatoria para esa estrategia.")
        yield fecha_objetivo
        return

    if estrategia == "primer_hueco":
        for delta in range(HORIZONTE_DIAS + 1):
            yield desde + timedelta(days=delta)
        return

    base = original_fecha + timedelta(days=7)
    while base < desde:
        base += timedelta(days=7)
    for semana in range(MAX_SEMANAS_MISMO_DIA):
        yield base + timedelta(days=7 * semana)


def _buscar_slot(
    *,
    agenda: dict,
    ocupadas: Dict[date, Set[str]],
    ausentes: Set[date],
    estrategia: str,
    desde: date,
    original_fecha: date,
    original_hora: time,
    fecha_objetivo: Optional[date],
    hoy: date,
    ahora: time,
    asignadas: Dict[date, Set[str]],
) -> Optional[Tuple[date, str]]:
    objetivo_min = _minutos(original_hora)

    for candidata in _candidatos(estrategia, desde, original_fecha, fecha_objetivo):
        if candidata < hoy or candidata in ausentes:
            continue
        slots = agenda.get(candidata.weekday(), [])
        if not slots:
            continue

        usadas = set(ocupadas.get(candidata, set())) | set(asignadas.get(candidata, set()))
        libres: List[Tuple[int, str]] = []
        for slot in slots:
            hh = _hhmm(slot["hora_inicio"])
            if hh in usadas:
                continue
            hora_slot = _parse_hora(hh)
            if candidata == hoy and _minutos(hora_slot) <= _minutos(ahora):
                continue
            libres.append((abs(_minutos(hora_slot) - objetivo_min), hh))

        if not libres:
            continue

        if estrategia == "mismo_dia_semana":
            libres.sort(key=lambda x: (x[0], x[1]))
        else:
            libres.sort(key=lambda x: x[1])

        return candidata, libres[0][1]

    return None


async def generar_plan(
    db: AsyncSession,
    *,
    ausencia_id: int,
    medico_id: int,
    desde: date,
    estrategia: str,
    fecha_objetivo: Optional[date],
    afectadas: List[dict],
) -> List[dict]:
    if estrategia not in ESTRATEGIAS:
        raise ValueError("estrategia inválida.")

    hoy, ahora = await _hoy_ahora(db)
    if desde < hoy:
        desde = hoy

    agenda = await _turnos_agenda(db, medico_id)
    fin_horizonte = desde + timedelta(days=HORIZONTE_DIAS)
    ausentes = await _fechas_ausente(db, medico_id, desde, fin_horizonte)

    ocupadas = await _ocupadas_rango(
        db, medico_id, desde, fin_horizonte, [a["id"] for a in afectadas]
    )
    asignadas: Dict[date, Set[str]] = {}

    propuestas: List[dict] = []
    for af in afectadas:
        original_fecha = af["fecha_cita"]
        original_hora = _parse_hora(af["hora_inicio"])
        slot = _buscar_slot(
            agenda=agenda,
            ocupadas=ocupadas,
            ausentes=ausentes,
            estrategia=estrategia,
            desde=desde,
            original_fecha=original_fecha,
            original_hora=original_hora,
            fecha_objetivo=fecha_objetivo,
            hoy=hoy,
            ahora=ahora,
            asignadas=asignadas,
        )

        if slot is None:
            propuestas.append(
                {
                    "ausencia_id": ausencia_id,
                    "cita_id": af["id"],
                    "fecha_anterior": original_fecha,
                    "hora_anterior": af["hora_inicio"],
                    "fecha_nueva": None,
                    "hora_nueva": None,
                    "estado": "sin_cupo",
                    "paciente_nombre": af["paciente_nombre"],
                    "paciente_cedula": af["paciente_cedula"],
                    "paciente_telefono": af["paciente_telefono"],
                    "especialidad": af["especialidad"],
                    "centro_salud": af["centro_salud"],
                }
            )
            continue

        nueva_fecha, nueva_hora = slot
        asignadas.setdefault(nueva_fecha, set()).add(nueva_hora)
        propuestas.append(
            {
                "ausencia_id": ausencia_id,
                "cita_id": af["id"],
                "fecha_anterior": original_fecha,
                "hora_anterior": af["hora_inicio"],
                "fecha_nueva": nueva_fecha,
                "hora_nueva": nueva_hora,
                "estado": "propuesta",
                "paciente_nombre": af["paciente_nombre"],
                "paciente_cedula": af["paciente_cedula"],
                "paciente_telefono": af["paciente_telefono"],
                "especialidad": af["especialidad"],
                "centro_salud": af["centro_salud"],
            }
        )

    return propuestas


async def insertar_propuestas(
    db: AsyncSession, propuestas: List[dict]
) -> List[str]:
    ids: List[str] = []
    for p in propuestas:
        fila = (
            await db.execute(
                text(
                    "INSERT INTO reprogramaciones_citas "
                    "(cita_id, ausencia_id, fecha_anterior, hora_anterior, "
                    " fecha_nueva, hora_nueva, estado) "
                    "VALUES (:cita_id, :ausencia_id, :fa, :ha, :fn, :hn, :estado) "
                    "RETURNING id"
                ),
                {
                    "cita_id": p["cita_id"],
                    "ausencia_id": p["ausencia_id"],
                    "fa": p["fecha_anterior"],
                    "ha": _parse_hora(p["hora_anterior"]),
                    "fn": p["fecha_nueva"],
                    "hn": _parse_hora(p["hora_nueva"]) if p["hora_nueva"] else None,
                    "estado": p["estado"],
                },
            )
        ).scalar_one()
        ids.append(str(fila))
    return ids


_PROPUESTA_SELECT = (
    "SELECT r.id, r.cita_id, r.ausencia_id, r.fecha_anterior, r.hora_anterior, "
    "       r.fecha_nueva, r.hora_nueva, r.estado, r.contacto, r.notas, "
    "       r.confirmada_en, r.created_at, "
    "       c.medico_id, c.especialidad, c.centro_salud, "
    "       h.nombre_completo AS paciente_nombre, h.cedula AS paciente_cedula, "
    "       h.telefono AS paciente_telefono, "
    "       p.nombre || ' ' || COALESCE(p.apellido, '') AS medico_nombre "
    "FROM reprogramaciones_citas r "
    "JOIN citas c ON c.id = r.cita_id "
    "LEFT JOIN historias_clinicas h ON h.id = c.paciente_id "
    "LEFT JOIN personal p ON p.id = c.medico_id "
)


def _to_propuesta(f) -> dict:
    return {
        "id": str(f["id"]),
        "cita_id": str(f["cita_id"]),
        "ausencia_id": f["ausencia_id"],
        "paciente_nombre": f["paciente_nombre"],
        "paciente_cedula": f["paciente_cedula"],
        "paciente_telefono": f["paciente_telefono"],
        "medico_id": f["medico_id"],
        "medico_nombre": (f["medico_nombre"] or "").strip() or None,
        "especialidad": f["especialidad"],
        "centro_salud": f["centro_salud"],
        "fecha_anterior": _iso(f["fecha_anterior"]),
        "hora_anterior": _hhmm(f["hora_anterior"]),
        "fecha_nueva": _iso(f["fecha_nueva"]),
        "hora_nueva": _hhmm(f["hora_nueva"]) if f["hora_nueva"] else None,
        "estado": f["estado"],
        "contacto": f["contacto"],
        "notas": f["notas"],
        "confirmada_en": _iso(f["confirmada_en"]),
        "created_at": _iso(f["created_at"]),
    }


async def listar_propuestas(
    db: AsyncSession, ausencia_id: Optional[int] = None, estado: Optional[str] = None
) -> List[dict]:
    condiciones = []
    params: dict = {}
    if ausencia_id:
        condiciones.append("r.ausencia_id = :aid")
        params["aid"] = ausencia_id
    if estado:
        condiciones.append("r.estado = :estado")
        params["estado"] = estado
    where = "WHERE " + " AND ".join(condiciones) if condiciones else ""
    filas = (
        await db.execute(
            text(
                _PROPUESTA_SELECT
                + where
                + " ORDER BY r.created_at, c.fecha_cita, c.hora_inicio"
            ),
            params,
        )
    ).mappings().all()
    return [_to_propuesta(f) for f in filas]


async def listar_propuestas_por_ids(
    db: AsyncSession, ids: List[str]
) -> List[dict]:
    if not ids:
        return []
    filas = (
        await db.execute(
            text(
                _PROPUESTA_SELECT
                + "WHERE r.id::text = ANY(:ids) "
                + "ORDER BY r.created_at, c.fecha_cita, c.hora_inicio"
            ),
            {"ids": ids},
        )
    ).mappings().all()
    return [_to_propuesta(f) for f in filas]


async def obtener_propuesta(db: AsyncSession, propuesta_id: str) -> Optional[dict]:
    fila = (
        await db.execute(
            text(_PROPUESTA_SELECT + "WHERE r.id = :id"), {"id": propuesta_id}
        )
    ).mappings().first()
    return _to_propuesta(fila) if fila else None


async def confirmar_propuesta(
    db: AsyncSession, propuesta_id: str, personal_id: Optional[int]
) -> dict:
    fila = (
        await db.execute(
            text(
                "SELECT r.id, r.cita_id, r.ausencia_id, r.estado, r.fecha_nueva, "
                "       r.hora_nueva, c.medico_id, c.estado AS cita_estado "
                "FROM reprogramaciones_citas r "
                "JOIN citas c ON c.id = r.cita_id "
                "WHERE r.id = :id "
                "FOR UPDATE OF c"
            ),
            {"id": propuesta_id},
        )
    ).mappings().first()

    if not fila:
        raise LookupError("La propuesta no existe.")
    if fila["estado"] != "propuesta" or fila["fecha_nueva"] is None:
        raise ValueError("La propuesta no está pendiente de confirmación.")
    if fila["cita_estado"] in ("cancelada", "completada"):
        raise ValueError("La cita ya no se puede reprogramar.")

    fecha_nueva = fila["fecha_nueva"]
    hora_nueva = fila["hora_nueva"]
    hoy, ahora = await _hoy_ahora(db)
    if fecha_nueva < hoy or (
        fecha_nueva == hoy and _minutos(hora_nueva) <= _minutos(ahora)
    ):
        raise ValueError("La fecha propuesta ya pasó.")

    ausente = (
        await db.execute(
            text(
                "SELECT 1 FROM ausencias_medicos "
                "WHERE medico_id = :mid AND estado = 'activa' "
                "  AND :fecha BETWEEN fecha_desde AND fecha_hasta"
            ),
            {"mid": fila["medico_id"], "fecha": fecha_nueva},
        )
    ).first()
    if ausente:
        raise ValueError("El médico está ausente en la fecha propuesta.")

    ocupada = (
        await db.execute(
            text(
                "SELECT 1 FROM citas "
                "WHERE medico_id = :mid AND fecha_cita = :fecha "
                "  AND hora_inicio = :hora AND id <> :cid "
                "  AND estado <> 'cancelada'"
            ),
            {
                "mid": fila["medico_id"],
                "fecha": fecha_nueva,
                "hora": hora_nueva,
                "cid": fila["cita_id"],
            },
        )
    ).first()
    if ocupada:
        raise ValueError("El horario propuesto ya fue ocupado por otra cita.")

    await db.execute(
        text(
            "UPDATE citas SET fecha_cita = :fecha, hora_inicio = :hora "
            "WHERE id = :cid"
        ),
        {"fecha": fecha_nueva, "hora": hora_nueva, "cid": fila["cita_id"]},
    )
    await db.execute(
        text(
            "UPDATE reprogramaciones_citas "
            "SET estado = 'confirmada', contacto = 'confirmado', "
            "    confirmada_por = :pid, confirmada_en = now(), updated_at = now() "
            "WHERE id = :id"
        ),
        {"pid": personal_id, "id": propuesta_id},
    )

    ausencia_resuelta = False
    if fila["ausencia_id"]:
        ausencia_resuelta = await resolver_ausencia(db, fila["ausencia_id"])

    propuesta = await obtener_propuesta(db, propuesta_id)
    return {"propuesta": propuesta, "ausencia_resuelta": ausencia_resuelta}


async def rechazar_propuesta(
    db: AsyncSession, propuesta_id: str, notas: Optional[str]
) -> dict:
    propuesta = await obtener_propuesta(db, propuesta_id)
    if not propuesta:
        raise LookupError("La propuesta no existe.")
    if propuesta["estado"] not in ("propuesta", "sin_cupo"):
        raise ValueError("La propuesta ya no se puede rechazar.")

    await db.execute(
        text(
            "UPDATE reprogramaciones_citas "
            "SET estado = 'rechazada', contacto = 'rechazado', "
            "    notas = COALESCE(:notas, notas), updated_at = now() "
            "WHERE id = :id"
        ),
        {"notas": notas, "id": propuesta_id},
    )

    ausencia_resuelta = False
    if propuesta["ausencia_id"]:
        ausencia_resuelta = await resolver_ausencia(db, propuesta["ausencia_id"])

    return {
        "propuesta": await obtener_propuesta(db, propuesta_id),
        "ausencia_resuelta": ausencia_resuelta,
    }


async def reprogramar_propuesta(
    db: AsyncSession,
    propuesta_id: str,
    fecha: date,
    hora_inicio: time,
    notas: Optional[str],
) -> dict:
    propuesta = await obtener_propuesta(db, propuesta_id)
    if not propuesta:
        raise LookupError("La propuesta no existe.")
    if propuesta["estado"] not in ("propuesta", "rechazada", "sin_cupo"):
        raise ValueError("La propuesta ya no se puede reprogramar.")

    hoy, ahora = await _hoy_ahora(db)
    if fecha < hoy or (fecha == hoy and _minutos(hora_inicio) <= _minutos(ahora)):
        raise ValueError("La fecha elegida ya pasó.")

    ausente = (
        await db.execute(
            text(
                "SELECT 1 FROM ausencias_medicos "
                "WHERE medico_id = :mid AND estado = 'activa' "
                "  AND :fecha BETWEEN fecha_desde AND fecha_hasta"
            ),
            {"mid": propuesta["medico_id"], "fecha": fecha},
        )
    ).first()
    if ausente:
        raise ValueError("El médico está ausente en la fecha elegida.")

    ocupada = (
        await db.execute(
            text(
                "SELECT 1 FROM citas "
                "WHERE medico_id = :mid AND fecha_cita = :fecha "
                "  AND hora_inicio = :hora AND id <> :cid "
                "  AND estado <> 'cancelada'"
            ),
            {
                "mid": propuesta["medico_id"],
                "fecha": fecha,
                "hora": hora_inicio,
                "cid": propuesta["cita_id"],
            },
        )
    ).first()
    if ocupada:
        raise ValueError("El horario elegido ya está ocupado.")

    await db.execute(
        text(
            "UPDATE reprogramaciones_citas "
            "SET fecha_nueva = :fecha, hora_nueva = :hora, estado = 'propuesta', "
            "    contacto = 'pendiente', confirmada_por = NULL, confirmada_en = NULL, "
            "    notas = COALESCE(:notas, notas), updated_at = now() "
            "WHERE id = :id"
        ),
        {"fecha": fecha, "hora": hora_inicio, "notas": notas, "id": propuesta_id},
    )
    return await obtener_propuesta(db, propuesta_id)


async def actualizar_contacto(
    db: AsyncSession, propuesta_id: str, contacto: str, notas: Optional[str]
) -> dict:
    if contacto not in ("pendiente", "contactado", "no_contesta", "confirmado", "rechazado"):
        raise ValueError("Estado de contacto inválido.")
    propuesta = await obtener_propuesta(db, propuesta_id)
    if not propuesta:
        raise LookupError("La propuesta no existe.")
    await db.execute(
        text(
            "UPDATE reprogramaciones_citas "
            "SET contacto = :contacto, notas = COALESCE(:notas, notas), "
            "    updated_at = now() WHERE id = :id"
        ),
        {"contacto": contacto, "notas": notas, "id": propuesta_id},
    )
    return await obtener_propuesta(db, propuesta_id)


async def resolver_ausencia(db: AsyncSession, ausencia_id: int) -> bool:
    resultado = await db.execute(
        text(
            "UPDATE ausencias_medicos a SET estado = 'resuelta', resuelta_en = now() "
            "WHERE a.id = :aid AND a.estado = 'activa' "
            "  AND NOT EXISTS ("
            "    SELECT 1 FROM reprogramaciones_citas r "
            "    WHERE r.ausencia_id = :aid AND r.estado IN ('propuesta', 'sin_cupo')"
            "  ) "
            "  AND NOT EXISTS ("
            "    SELECT 1 FROM citas c "
            "    WHERE c.medico_id = a.medico_id "
            "      AND c.fecha_cita BETWEEN a.fecha_desde AND a.fecha_hasta "
            "      AND c.estado IN ('pendiente', 'confirmada')"
            "  )"
        ),
        {"aid": ausencia_id},
    )
    return bool(resultado.rowcount)


_DIAS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
_MESES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]


def _fecha_larga_es(f: date) -> str:
    dia_sem = _DIAS_ES[f.weekday()]
    mes = _MESES_ES[f.month - 1]
    return f"{dia_sem} {f.day} de {mes}"


def _telefono_wa(telefono: Optional[str]) -> Optional[str]:
    if not telefono:
        return None
    digitos = "".join(c for c in str(telefono) if c.isdigit())
    if not digitos:
        return None
    if digitos.startswith("58") and len(digitos) >= 11:
        return digitos
    if digitos.startswith("0") and len(digitos) == 11:
        return f"58{digitos[1:]}"
    if len(digitos) == 10 and not digitos.startswith("0"):
        return f"58{digitos}"
    return f"58{digitos}"


async def obtener_citas_jornada(
    db: AsyncSession,
    medico_id: int,
    fecha: date,
    turno_id: Optional[int] = None,
) -> List[dict]:
    """Obtiene las citas activas de un médico en una fecha específica.

    Si se indica `turno_id`, filtra por la franja horaria del turno.
    """
    filtro_turno = ""
    params: dict = {"mid": medico_id, "fecha": fecha}
    if turno_id is not None:
        rango = (
            await db.execute(
                text("SELECT hora_inicio, hora_fin FROM turnos WHERE id = :tid"),
                {"tid": turno_id},
            )
        ).first()
        if not rango:
            raise LookupError("El turno indicado no existe.")
        filtro_turno = " AND c.hora_inicio >= :hora_inicio AND c.hora_inicio < :hora_fin"
        params["hora_inicio"] = rango[0]
        params["hora_fin"] = rango[1]

    filas = (
        await db.execute(
            text(
                "SELECT c.id, c.fecha_cita, c.hora_inicio, c.paciente_id, "
                "       h.nombre_completo AS paciente_nombre, h.cedula AS paciente_cedula, "
                "       h.telefono AS paciente_telefono, c.especialidad, c.centro_salud, "
                "       c.estado, p.nombre || ' ' || COALESCE(p.apellido, '') AS medico_nombre "
                "FROM citas c "
                "LEFT JOIN historias_clinicas h ON h.id = c.paciente_id "
                "LEFT JOIN personal p ON p.id = c.medico_id "
                "WHERE c.medico_id = :mid AND c.fecha_cita = :fecha "
                "  AND c.estado IN ('pendiente', 'confirmada')"
                f"{filtro_turno} "
                "ORDER BY c.hora_inicio ASC, c.created_at ASC"
            ),
            params,
        )
    ).mappings().all()

    return [
        {
            "id": str(f["id"]),
            "fecha_cita": _iso(f["fecha_cita"]),
            "hora_inicio": _hhmm(f["hora_inicio"]),
            "paciente_id": str(f["paciente_id"]) if f["paciente_id"] else None,
            "paciente_nombre": f["paciente_nombre"] or "Paciente sin historia",
            "paciente_cedula": f["paciente_cedula"],
            "paciente_telefono": f["paciente_telefono"],
            "especialidad": f["especialidad"],
            "centro_salud": f["centro_salud"],
            "medico_nombre": (f["medico_nombre"] or "").strip(),
            "estado": f["estado"],
        }
        for f in filas
    ]


async def obtener_turnos_jornada(
    db: AsyncSession, medico_id: int, fecha: date
) -> List[dict]:
    """Turnos del médico para el día de la fecha, con el conteo de citas activas.

    Usa la agenda configurada del médico (`agenda_medicos`) y, si no tiene
    agenda ese día, el catálogo de turnos. Cuando algún turno tiene citas, solo
    devuelve esos turnos para que recepción no vea franjas vacías.
    """
    filas = (
        await db.execute(
            text(
                "SELECT DISTINCT t.id AS turno_id, t.nombre, t.hora_inicio, t.hora_fin "
                "FROM agenda_medicos a "
                "JOIN turnos t ON t.id = a.turno_id "
                "WHERE a.medico_id = :mid AND a.activo = TRUE "
                "  AND a.dia_semana = EXTRACT(DOW FROM CAST(:fecha AS date))::int "
                "ORDER BY t.hora_inicio"
            ),
            {"mid": medico_id, "fecha": fecha},
        )
    ).mappings().all()

    if not filas:
        filas = (
            await db.execute(
                text(
                    "SELECT id AS turno_id, nombre, hora_inicio, hora_fin "
                    "FROM turnos ORDER BY hora_inicio"
                )
            )
        ).mappings().all()

    horas = (
        await db.execute(
            text(
                "SELECT hora_inicio FROM citas "
                "WHERE medico_id = :mid AND fecha_cita = :fecha "
                "  AND estado IN ('pendiente', 'confirmada')"
            ),
            {"mid": medico_id, "fecha": fecha},
        )
    ).scalars().all()

    items = []
    for f in filas:
        inicio, fin = f["hora_inicio"], f["hora_fin"]
        items.append(
            {
                "turno_id": f["turno_id"],
                "nombre": f["nombre"],
                "hora_inicio": _hhmm(inicio),
                "hora_fin": _hhmm(fin),
                "citas": sum(1 for h in horas if inicio <= h < fin),
            }
        )
    con_citas = [i for i in items if i["citas"] > 0]
    return con_citas or items


async def mover_jornada(
    db: AsyncSession,
    *,
    medico_id: int,
    fecha_origen: date,
    fecha_destino: date,
    ajustar_horas: bool = False,
    hora_inicio_base: Optional[time] = None,
    intervalo_minutos: int = 30,
    citas_ids: Optional[List[str]] = None,
    personal_id: Optional[int] = None,
) -> dict:
    """Traslada en bloque las citas de una fecha a otra y prepara los enlaces de WhatsApp."""
    # 1. Obtener datos del médico
    medico = (
        await db.execute(
            text(
                "SELECT p.nombre || ' ' || COALESCE(p.apellido, '') AS nombre, "
                "       p.especialidad "
                "FROM personal p WHERE p.id = :mid"
            ),
            {"mid": medico_id},
        )
    ).mappings().first()
    if not medico:
        raise LookupError("El médico especialista no existe.")

    medico_nombre = (medico["nombre"] or "").strip()
    especialidad_default = medico["especialidad"] or "Consulta médica"

    # 2. Consultar citas activas en la fecha origen
    cond_citas = "AND c.id::text = ANY(:cids)" if citas_ids else ""
    params = {"mid": medico_id, "fo": fecha_origen}
    if citas_ids:
        params["cids"] = [str(x) for x in citas_ids]

    citas_origen = (
        await db.execute(
            text(
                f"SELECT c.id, c.fecha_cita, c.hora_inicio, c.paciente_id, "
                f"       h.nombre_completo AS paciente_nombre, h.cedula AS paciente_cedula, "
                f"       h.telefono AS paciente_telefono, c.especialidad, c.centro_salud "
                f"FROM citas c "
                f"LEFT JOIN historias_clinicas h ON h.id = c.paciente_id "
                f"WHERE c.medico_id = :mid AND c.fecha_cita = :fo "
                f"  AND c.estado IN ('pendiente', 'confirmada') {cond_citas} "
                f"ORDER BY c.hora_inicio ASC, c.created_at ASC "
                f"FOR UPDATE OF c"
            ),
            params,
        )
    ).mappings().all()

    if not citas_origen:
        raise ValueError("No hay citas pendientes o confirmadas para trasladar en esa fecha.")

    # 3. Calcular nuevas horas
    citas_trasladadas = []
    fecha_ant_txt = _fecha_larga_es(fecha_origen)
    fecha_nueva_txt = _fecha_larga_es(fecha_destino)

    for i, c in enumerate(citas_origen):
        cid = str(c["id"])
        hora_ant_str = _hhmm(c["hora_inicio"])
        if ajustar_horas and hora_inicio_base:
            total_min = hora_inicio_base.hour * 60 + hora_inicio_base.minute + (i * intervalo_minutos)
            nueva_h = time(total_min // 60, total_min % 60)
            hora_nueva_str = _hhmm(nueva_h)
        else:
            nueva_h = c["hora_inicio"]
            hora_nueva_str = hora_ant_str

        # Actualizar la cita en BD
        await db.execute(
            text(
                "UPDATE citas "
                "SET fecha_cita = :fd, hora_inicio = :hn "
                "WHERE id = :cid"
            ),
            {"fd": fecha_destino, "hn": nueva_h, "cid": c["id"]},
        )

        # Crear o actualizar registro de reprogramación para trazabilidad
        reprog = (
            await db.execute(
                text(
                    "INSERT INTO reprogramaciones_citas "
                    "(cita_id, fecha_anterior, hora_anterior, fecha_nueva, hora_nueva, estado, contacto) "
                    "VALUES (:cid, :fa, :ha, :fn, :hn, 'confirmada', 'pendiente') "
                    "RETURNING id"
                ),
                {
                    "cid": c["id"],
                    "fa": fecha_origen,
                    "ha": c["hora_inicio"],
                    "fn": fecha_destino,
                    "hn": nueva_h,
                },
            )
        ).scalar_one()

        paciente_nom = c["paciente_nombre"] or "paciente"
        especialidad = c["especialidad"] or especialidad_default
        tel_wa = _telefono_wa(c["paciente_telefono"])

        # Redactar mensaje claro y personalizado
        mensaje_wa = (
            f"Estimado/a {paciente_nom}, le saludamos de BnaSalud / CITAB. "
            f"Le informamos que por reestructuración de horarios médicos, su cita de {especialidad} "
            f"con {medico_nombre} prevista para el {fecha_ant_txt} a las {hora_ant_str} "
            f"ha sido trasladada para el *{fecha_nueva_txt} a las {hora_nueva_str}*. "
            f"Por favor responda a este mensaje si confirma su asistencia o si requiere coordinar otra fecha. ¡Muchas gracias!"
        )

        link_wa = None
        if tel_wa:
            link_wa = f"https://wa.me/{tel_wa}?text={quote(mensaje_wa)}"

        citas_trasladadas.append(
            {
                "id": str(reprog),
                "cita_id": cid,
                "paciente_nombre": paciente_nom,
                "paciente_cedula": c["paciente_cedula"],
                "paciente_telefono": c["paciente_telefono"],
                "medico_nombre": medico_nombre,
                "especialidad": especialidad,
                "centro_salud": c["centro_salud"],
                "fecha_anterior": _iso(fecha_origen),
                "hora_anterior": hora_ant_str,
                "fecha_nueva": _iso(fecha_destino),
                "hora_nueva": hora_nueva_str,
                "contacto": "pendiente",
                "mensaje_whatsapp": mensaje_wa,
                "link_whatsapp": link_wa,
            }
        )

    await db.commit()

    return {
        "total_movidas": len(citas_trasladadas),
        "fecha_origen": _iso(fecha_origen),
        "fecha_destino": _iso(fecha_destino),
        "medico_nombre": medico_nombre,
        "citas": citas_trasladadas,
    }
