"""Endpoints de solicitudes, ausencias y reprogramación de citas."""

import json
import unicodedata
from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.agenda import _especialista
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.reprogramacion import (
    AfectadasResponse,
    AusenciaCrearRequest,
    AusenciaItem,
    AusenciasResponse,
    CitasSolicitudResponse,
    ConfirmarPropuestaResponse,
    ContactoRequest,
    MoverJornadaRequest,
    MoverJornadaResponse,
    PlanRequest,
    PlanResponse,
    PlanResumen,
    PropuestaItem,
    PropuestasResponse,
    RechazarPropuestaRequest,
    ReproponerRequest,
    TurnosJornadaResponse,
)
from app.services import reprogramacion as svc

router = APIRouter()

_AUSENCIA_SELECT = (
    "SELECT a.id, a.medico_id, a.fecha_desde, a.fecha_hasta, a.motivo, "
    "       a.estado, a.created_at, a.resuelta_en, "
    "       p.nombre || ' ' || COALESCE(p.apellido, '') AS medico_nombre, "
    "       p.especialidad, "
    "       (SELECT count(*) FROM citas c "
    "         WHERE c.medico_id = a.medico_id "
    "           AND c.fecha_cita BETWEEN a.fecha_desde AND a.fecha_hasta "
    "           AND c.estado IN ('pendiente', 'confirmada')) AS afectadas, "
    "       (SELECT count(*) FROM reprogramaciones_citas r "
    "         WHERE r.ausencia_id = a.id "
    "           AND r.estado IN ('propuesta', 'sin_cupo')) AS propuestas_pendientes "
    "FROM ausencias_medicos a "
    "JOIN personal p ON p.id = a.medico_id "
)


def _fecha(valor: Optional[str], campo: str) -> Optional[date]:
    if valor is None or valor == "":
        return None
    try:
        return datetime.strptime(valor, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"{campo} inválida (formato YYYY-MM-DD)."
        )


def _hora(valor: str) -> time:
    try:
        return datetime.strptime(valor, "%H:%M").time()
    except ValueError:
        raise HTTPException(status_code=400, detail="hora inválida (formato HH:MM).")


def _iso(valor) -> Optional[str]:
    if valor is None:
        return None
    if hasattr(valor, "isoformat"):
        return valor.isoformat()
    return str(valor)


def _to_ausencia(f) -> dict:
    return {
        "id": f["id"],
        "medico_id": f["medico_id"],
        "medico_nombre": (f["medico_nombre"] or "").strip(),
        "especialidad": f["especialidad"],
        "fecha_desde": _iso(f["fecha_desde"]),
        "fecha_hasta": _iso(f["fecha_hasta"]),
        "motivo": f["motivo"],
        "estado": f["estado"],
        "afectadas": int(f["afectadas"] or 0),
        "propuestas_pendientes": int(f["propuestas_pendientes"] or 0),
        "created_at": _iso(f["created_at"]),
        "resuelta_en": _iso(f["resuelta_en"]),
    }


async def _obtener_ausencia(db: AsyncSession, ausencia_id: int) -> dict:
    fila = (
        await db.execute(
            text(_AUSENCIA_SELECT + "WHERE a.id = :id"), {"id": ausencia_id}
        )
    ).mappings().first()
    if not fila:
        raise HTTPException(status_code=404, detail="La ausencia no existe.")
    return _to_ausencia(fila)


async def _hoy(db: AsyncSession) -> date:
    return (await db.execute(text("SELECT CURRENT_DATE AS hoy"))).scalar_one()


@router.get("/citas", response_model=CitasSolicitudResponse)
async def listar_citas(
    estado: Optional[str] = Query(None),
    origen: Optional[str] = Query(None),
    especialidad: Optional[str] = Query(None),
    medico_id: Optional[int] = Query(None),
    centro_id: Optional[int] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Lista de citas/solicitudes para recepción."""
    if centro_id is None and settings.id_centro is not None:
        centro_id = settings.id_centro
    return await svc.listar_citas(
        db,
        estado=estado,
        origen=origen,
        especialidad=especialidad,
        medico_id=medico_id,
        centro_id=centro_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        q=q,
        page=page,
        limit=limit,
    )


@router.get("/especialidades")
async def listar_especialidades(db: AsyncSession = Depends(get_db)):
    """Especialidades con las que se pueden filtrar las solicitudes de citas."""
    filas = (
        await db.execute(
            text(
                "SELECT DISTINCT TRIM(esp) AS especialidad FROM ( "
                "  SELECT p.especialidad AS esp FROM personal p "
                "   WHERE p.especialidad IS NOT NULL AND TRIM(p.especialidad) <> '' "
                "  UNION ALL "
                "  SELECT c.especialidad AS esp FROM citas c "
                "   WHERE c.especialidad IS NOT NULL AND TRIM(c.especialidad) <> '' "
                ") s ORDER BY 1"
            )
        )
    ).scalars().all()

    # La BD tiene variantes con y sin tilde; se unifican conservando la forma
    # acentuada cuando existe.
    def _clave(texto: str) -> str:
        sin_tildes = unicodedata.normalize("NFKD", texto)
        return "".join(
            c for c in sin_tildes if not unicodedata.combining(c)
        ).lower().strip()

    unicas: dict = {}
    for fila in filas:
        if not fila:
            continue
        clave = _clave(fila)
        actual = unicas.get(clave)
        if actual is None or (
            any(ord(c) > 127 for c in fila)
            and not any(ord(c) > 127 for c in actual)
        ):
            unicas[clave] = fila
    return {"items": sorted(unicas.values(), key=_clave)}


def _lista_json(valor) -> list:
    """Normaliza columnas JSON (lista real o texto serializado) a lista."""
    if not valor:
        return []
    if isinstance(valor, list):
        return valor
    if isinstance(valor, str):
        try:
            cargado = json.loads(valor)
            return cargado if isinstance(cargado, list) else [str(cargado)]
        except ValueError:
            return [valor]
    return [str(valor)]


@router.get("/citas/{cita_id}/ficha")
async def ficha_cita(cita_id: str, db: AsyncSession = Depends(get_db)):
    """Ficha del paciente de una solicitud de cita, con su historial resumido."""
    fila = (
        await db.execute(
            text(
                "SELECT c.id, c.estado, c.origen, c.motivo, c.especialidad, "
                "       c.centro_salud, c.fecha_cita, c.hora_inicio, "
                "       c.codigo_confirmacion, c.created_at, c.paciente_id, c.medico_id, "
                "       h.id AS historia_id, h.cedula, h.nombre_completo, h.apellido, "
                "       h.telefono, h.direccion, h.tipo_sangre, h.numero_historia, "
                "       h.antecedentes_medicos, h.antecedentes_operatorios, h.alergias, "
                "       h.created_at AS historia_creada, "
                "       p.nombre || ' ' || COALESCE(p.apellido, '') AS medico_nombre, "
                "       p.especialidad AS medico_especialidad "
                "FROM citas c "
                "LEFT JOIN historias_clinicas h ON h.id = c.paciente_id "
                "LEFT JOIN personal p ON p.id = c.medico_id "
                "WHERE c.id::text = :id"
            ),
            {"id": cita_id},
        )
    ).mappings().first()
    if not fila:
        raise HTTPException(status_code=404, detail="La cita no existe.")

    historial = {
        "total_citas": 0,
        "completadas": 0,
        "canceladas": 0,
        "proximas": 0,
        "ultima_cita": None,
    }
    if fila["paciente_id"]:
        resumen = (
            await db.execute(
                text(
                    "SELECT count(*) AS total, "
                    "       count(*) FILTER (WHERE estado = 'completada') AS completadas, "
                    "       count(*) FILTER (WHERE estado = 'cancelada') AS canceladas, "
                    "       count(*) FILTER (WHERE estado IN ('pendiente','confirmada') "
                    "                    AND fecha_cita >= CURRENT_DATE) AS proximas "
                    "FROM citas WHERE paciente_id = :pid"
                ),
                {"pid": fila["paciente_id"]},
            )
        ).mappings().first()
        ultima = (
            await db.execute(
                text(
                    "SELECT fecha_cita, hora_inicio, especialidad, estado "
                    "FROM citas WHERE paciente_id = :pid AND id::text <> :cid "
                    "  AND fecha_cita <= CURRENT_DATE "
                    "ORDER BY fecha_cita DESC, hora_inicio DESC LIMIT 1"
                ),
                {"pid": fila["paciente_id"], "cid": cita_id},
            )
        ).mappings().first()
        historial = {
            "total_citas": int(resumen["total"] or 0),
            "completadas": int(resumen["completadas"] or 0),
            "canceladas": int(resumen["canceladas"] or 0),
            "proximas": int(resumen["proximas"] or 0),
            "ultima_cita": (
                {
                    "fecha_cita": _iso(ultima["fecha_cita"]),
                    "hora_inicio": str(ultima["hora_inicio"])[:5],
                    "especialidad": ultima["especialidad"],
                    "estado": ultima["estado"],
                }
                if ultima
                else None
            ),
        }

    return {
        "cita": {
            "id": str(fila["id"]),
            "estado": fila["estado"],
            "origen": fila["origen"],
            "motivo": fila["motivo"],
            "especialidad": fila["especialidad"],
            "centro_salud": fila["centro_salud"],
            "fecha_cita": _iso(fila["fecha_cita"]),
            "hora_inicio": str(fila["hora_inicio"])[:5] if fila["hora_inicio"] else "",
            "codigo_confirmacion": fila["codigo_confirmacion"],
            "created_at": _iso(fila["created_at"]),
            "medico_id": fila["medico_id"],
            "medico_nombre": (fila["medico_nombre"] or "").strip() or None,
            "medico_especialidad": fila["medico_especialidad"],
        },
        "paciente": {
            "historia_id": str(fila["historia_id"]) if fila["historia_id"] else None,
            "cedula": fila["cedula"],
            "nombre_completo": fila["nombre_completo"],
            "apellido": fila["apellido"],
            "telefono": fila["telefono"],
            "direccion": fila["direccion"],
            "tipo_sangre": fila["tipo_sangre"],
            "numero_historia": fila["numero_historia"],
            "antecedentes_medicos": _lista_json(fila["antecedentes_medicos"]),
            "antecedentes_operatorios": _lista_json(fila["antecedentes_operatorios"]),
            "alergias": _lista_json(fila["alergias"]),
            "registrada_en": _iso(fila["historia_creada"]),
        },
        "historial": historial,
    }


@router.post(
    "/ausencias", response_model=AusenciaItem, status_code=status.HTTP_201_CREATED
)
async def crear_ausencia(
    payload: AusenciaCrearRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Registra la ausencia de un médico y bloquea su agenda en ese rango."""
    desde = _fecha(payload.fecha_desde, "fecha_desde")
    hasta = _fecha(payload.fecha_hasta, "fecha_hasta")
    if desde is None or hasta is None:
        raise HTTPException(status_code=400, detail="Las fechas son obligatorias.")
    if hasta < desde:
        raise HTTPException(
            status_code=400, detail="fecha_hasta no puede ser menor que fecha_desde."
        )

    await _especialista(db, payload.medico_id)

    solapada = (
        await db.execute(
            text(
                "SELECT id FROM ausencias_medicos "
                "WHERE medico_id = :mid AND estado = 'activa' "
                "  AND fecha_desde <= :hasta AND fecha_hasta >= :desde"
            ),
            {"mid": payload.medico_id, "desde": desde, "hasta": hasta},
        )
    ).first()
    if solapada:
        raise HTTPException(
            status_code=409,
            detail="Ya existe una ausencia activa que se solapa con ese rango.",
        )

    fila = (
        await db.execute(
            text(
                "INSERT INTO ausencias_medicos "
                "(medico_id, fecha_desde, fecha_hasta, motivo, creada_por) "
                "VALUES (:mid, :desde, :hasta, :motivo, :creada_por) RETURNING id"
            ),
            {
                "mid": payload.medico_id,
                "desde": desde,
                "hasta": hasta,
                "motivo": payload.motivo,
                "creada_por": user.get("personal_id"),
            },
        )
    ).scalar_one()
    await db.commit()
    return await _obtener_ausencia(db, fila)


@router.get("/ausencias", response_model=AusenciasResponse)
async def listar_ausencias(
    estado: Optional[str] = Query(None),
    medico_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    condiciones = []
    params: dict = {}
    if estado:
        condiciones.append("a.estado = :estado")
        params["estado"] = estado
    if medico_id:
        condiciones.append("a.medico_id = :mid")
        params["mid"] = medico_id
    where = "WHERE " + " AND ".join(condiciones) if condiciones else ""
    filas = (
        await db.execute(
            text(
                _AUSENCIA_SELECT
                + where
                + " ORDER BY a.estado = 'activa' DESC, a.fecha_desde DESC, a.id DESC"
            ),
            params,
        )
    ).mappings().all()
    return {"items": [_to_ausencia(f) for f in filas]}


@router.patch("/ausencias/{ausencia_id}/cancelar", response_model=AusenciaItem)
async def cancelar_ausencia(ausencia_id: int, db: AsyncSession = Depends(get_db)):
    ausencia = await _obtener_ausencia(db, ausencia_id)
    if ausencia["estado"] != "activa":
        raise HTTPException(status_code=409, detail="La ausencia no está activa.")

    await db.execute(
        text(
            "UPDATE ausencias_medicos "
            "SET estado = 'cancelada', resuelta_en = now() WHERE id = :id"
        ),
        {"id": ausencia_id},
    )
    await db.execute(
        text(
            "UPDATE reprogramaciones_citas SET estado = 'cancelada', updated_at = now() "
            "WHERE ausencia_id = :id AND estado IN ('propuesta', 'sin_cupo')"
        ),
        {"id": ausencia_id},
    )
    await db.commit()
    return await _obtener_ausencia(db, ausencia_id)


@router.get("/ausencias/{ausencia_id}/afectadas", response_model=AfectadasResponse)
async def listar_afectadas(ausencia_id: int, db: AsyncSession = Depends(get_db)):
    ausencia = await _obtener_ausencia(db, ausencia_id)
    desde = _fecha(ausencia["fecha_desde"], "fecha_desde")
    hasta = _fecha(ausencia["fecha_hasta"], "fecha_hasta")
    return {
        "items": await svc.listar_afectadas(
            db, ausencia["medico_id"], desde, hasta
        )
    }


@router.post("/ausencias/{ausencia_id}/plan", response_model=PlanResponse)
async def generar_plan(
    ausencia_id: int,
    payload: PlanRequest,
    db: AsyncSession = Depends(get_db),
):
    """Genera propuestas en huecos libres reales. No mueve las citas."""
    ausencia = await _obtener_ausencia(db, ausencia_id)
    if ausencia["estado"] != "activa":
        raise HTTPException(status_code=409, detail="La ausencia no está activa.")
    if payload.estrategia not in svc.ESTRATEGIAS:
        raise HTTPException(
            status_code=400,
            detail="estrategia inválida: mismo_dia_semana, primer_hueco o fecha_objetivo.",
        )

    fecha_desde = _fecha(ausencia["fecha_desde"], "fecha_desde")
    fecha_hasta = _fecha(ausencia["fecha_hasta"], "fecha_hasta")
    hoy = await _hoy(db)

    desde = _fecha(payload.desde, "desde")
    if desde is None:
        desde = max(hoy, fecha_hasta + timedelta(days=1))
    if desde < hoy:
        desde = hoy

    fecha_objetivo = _fecha(payload.fecha_objetivo, "fecha_objetivo")
    if payload.estrategia == "fecha_objetivo" and fecha_objetivo is None:
        raise HTTPException(
            status_code=400, detail="fecha_objetivo es obligatoria con esa estrategia."
        )
    if fecha_objetivo and fecha_objetivo < hoy:
        raise HTTPException(status_code=400, detail="fecha_objetivo ya pasó.")
    if fecha_objetivo and fecha_objetivo > hoy + timedelta(days=svc.HORIZONTE_DIAS):
        raise HTTPException(
            status_code=400,
            detail="fecha_objetivo no puede superar los proximos 60 dias.",
        )

    pendientes = (
        await db.execute(
            text(
                "SELECT count(*) FROM reprogramaciones_citas "
                "WHERE ausencia_id = :aid AND estado IN ('propuesta', 'sin_cupo')"
            ),
            {"aid": ausencia_id},
        )
    ).scalar_one()
    if pendientes and not payload.reemplazar:
        raise HTTPException(
            status_code=409,
            detail="Ya hay propuestas pendientes. Usa reemplazar=true para regenerarlas.",
        )
    if pendientes:
        await db.execute(
            text(
                "DELETE FROM reprogramaciones_citas "
                "WHERE ausencia_id = :aid AND estado IN ('propuesta', 'sin_cupo')"
            ),
            {"aid": ausencia_id},
        )

    afectadas = await svc.listar_afectadas(
        db, ausencia["medico_id"], fecha_desde, fecha_hasta
    )
    if not afectadas:
        raise HTTPException(
            status_code=400,
            detail="No hay citas pendientes o confirmadas en el rango de ausencia.",
        )

    plan = await svc.generar_plan(
        db,
        ausencia_id=ausencia_id,
        medico_id=ausencia["medico_id"],
        desde=desde,
        estrategia=payload.estrategia,
        fecha_objetivo=fecha_objetivo,
        afectadas=afectadas,
    )
    ids = await svc.insertar_propuestas(db, plan)
    await db.commit()

    propuestas = await svc.listar_propuestas_por_ids(db, ids)
    sin_telefono = sum(1 for p in plan if not p.get("paciente_telefono"))
    resumen = PlanResumen(
        total=len(plan),
        con_cupo=sum(1 for p in plan if p["estado"] == "propuesta"),
        sin_cupo=sum(1 for p in plan if p["estado"] == "sin_cupo"),
        sin_telefono=sin_telefono,
    )
    return {"ausencia_id": ausencia_id, "propuestas": propuestas, "resumen": resumen}


@router.get("/propuestas", response_model=PropuestasResponse)
async def listar_propuestas(
    ausencia_id: Optional[int] = Query(None),
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return {"items": await svc.listar_propuestas(db, ausencia_id, estado)}


@router.post(
    "/propuestas/{propuesta_id}/confirmar",
    response_model=ConfirmarPropuestaResponse,
)
async def confirmar_propuesta(
    propuesta_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Confirma la propuesta y mueve la cita. Revalida que el hueco siga libre."""
    try:
        resultado = await svc.confirmar_propuesta(
            db, propuesta_id, user.get("personal_id")
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    await db.commit()
    return resultado


@router.post(
    "/propuestas/{propuesta_id}/rechazar",
    response_model=ConfirmarPropuestaResponse,
)
async def rechazar_propuesta(
    propuesta_id: str,
    payload: RechazarPropuestaRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        resultado = await svc.rechazar_propuesta(db, propuesta_id, payload.notas)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    await db.commit()
    return resultado


@router.post(
    "/propuestas/{propuesta_id}/reproponer", response_model=PropuestaItem
)
async def reproponer(
    propuesta_id: str,
    payload: ReproponerRequest,
    db: AsyncSession = Depends(get_db),
):
    fecha = _fecha(payload.fecha, "fecha")
    hora = _hora(payload.hora_inicio)
    try:
        propuesta = await svc.reprogramar_propuesta(
            db, propuesta_id, fecha, hora, payload.notas
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    await db.commit()
    return propuesta


@router.patch("/propuestas/{propuesta_id}/contacto", response_model=PropuestaItem)
async def actualizar_contacto(
    propuesta_id: str,
    payload: ContactoRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        propuesta = await svc.actualizar_contacto(
            db, propuesta_id, payload.contacto, payload.notas
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return propuesta


@router.get("/jornada/turnos", response_model=TurnosJornadaResponse)
async def turnos_jornada(
    medico_id: int = Query(...),
    fecha: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Turnos del médico para la fecha, con el número de citas activas por turno."""
    f = _fecha(fecha, "fecha")
    if not f:
        raise HTTPException(status_code=400, detail="Fecha requerida.")
    items = await svc.obtener_turnos_jornada(db, medico_id=medico_id, fecha=f)
    return {"items": items, "total": len(items)}


@router.get("/jornada/previa")
async def previa_jornada(
    medico_id: int = Query(...),
    fecha: str = Query(...),
    turno_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    f = _fecha(fecha, "fecha")
    if not f:
        raise HTTPException(status_code=400, detail="Fecha requerida.")
    try:
        items = await svc.obtener_citas_jornada(
            db, medico_id=medico_id, fecha=f, turno_id=turno_id
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"items": items, "total": len(items)}


@router.post("/mover-jornada", response_model=MoverJornadaResponse)
async def endpoint_mover_jornada(
    payload: MoverJornadaRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    fo = _fecha(payload.fecha_origen, "fecha_origen")
    fd = _fecha(payload.fecha_destino, "fecha_destino")
    if not fo or not fd:
        raise HTTPException(
            status_code=400, detail="fecha_origen y fecha_destino son requeridas."
        )
    hb = _hora(payload.hora_inicio_base) if payload.hora_inicio_base else None
    try:
        res = await svc.mover_jornada(
            db,
            medico_id=payload.medico_id,
            fecha_origen=fo,
            fecha_destino=fd,
            ajustar_horas=payload.ajustar_horas,
            hora_inicio_base=hb,
            intervalo_minutos=payload.intervalo_minutos,
            citas_ids=payload.citas_ids,
            personal_id=user.get("personal_id"),
        )
        await db.commit()
        return res
    except LookupError as e:
        await db.rollback()
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

