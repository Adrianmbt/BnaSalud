"""Endpoints de remisión de exámenes a centros de salud adscritos."""
import json
import random
import string
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.examenes_remision import (
    CentroAdscritoItem,
    CitaExamenCrearRequest,
    CitaExamenResponse,
    DiaDisponibilidadExamen,
    ElegibilidadResponse,
    ExamenOfrecidoItem,
    TurnoLibreExamen,
)

router = APIRouter(tags=["Remisión de exámenes"])

DIA_ES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
RANGO_DIAS = 30
ESTADOS_QUE_OCUPAN = ("pendiente", "realizada")


async def _ofrecido(db: AsyncSession, ofrecido_id: int) -> dict:
    fila = (
        await db.execute(
            text(
                "SELECT eo.*, cl.nombre AS centro "
                "FROM examenes_ofrecidos eo JOIN clinicas cl ON cl.id = eo.centro_id "
                "WHERE eo.id = :id AND eo.activo = TRUE"
            ),
            {"id": ofrecido_id},
        )
    ).mappings().first()
    if not fila:
        raise HTTPException(404, "Examen ofrecido no encontrado.")
    return dict(fila)


async def _ocupadas(db: AsyncSession, ofrecido_id: int, desde, hasta) -> dict:
    r = await db.execute(
        text(
            "SELECT fecha_cita, to_char(hora_inicio, 'HH24:MI') AS h, estado "
            "FROM citas_examenes "
            "WHERE examen_ofrecido_id = :id AND fecha_cita BETWEEN :d AND :h"
        ),
        {"id": ofrecido_id, "d": desde, "h": hasta},
    )
    ocup: dict = {}
    for f in r.mappings():
        if f["estado"] not in ESTADOS_QUE_OCUPAN:
            continue
        ocup.setdefault(str(f["fecha_cita"]), {"hora": set(), "n": 0})
        ocup[str(f["fecha_cita"])]["hora"].add(f["h"])
        ocup[str(f["fecha_cita"])]["n"] += 1
    return ocup


def _dia_disponible(ofrecido: dict, fecha, ocup: dict) -> DiaDisponibilidadExamen:
    horario = ofrecido.get("horario_atencion") or {}
    try:
        ventanas = horario.get(DIA_ES[fecha.weekday()], []) or []
    except (KeyError, TypeError):
        ventanas = []
    cupo = int(ofrecido.get("cupo_diario") or 0)
    horas_ocup = ocup.get("hora", set())
    n_ocup = ocup.get("n", 0)
    cupo_rest = max(0, cupo - n_ocup)
    turnos = []
    for v in ventanas:
        partes = str(v).split("-")
        if len(partes) != 2:
            continue
        hs, hf = partes[0].strip(), partes[1].strip()
        if cupo_rest > 0 and hs not in horas_ocup:
            turnos.append(TurnoLibreExamen(hora_inicio=hs, hora_fin=hf))
    if not ventanas:
        motivo = "no atiende"
    elif cupo_rest <= 0:
        motivo = "cupo agotado"
    else:
        motivo = ""
    return DiaDisponibilidadExamen(
        fecha=fecha.isoformat(),
        cupo_restante=cupo_rest,
        disponible=bool(turnos),
        motivo=motivo,
        turnos_libres=turnos,
    )


@router.get("/centros-adscritos", response_model=List[CentroAdscritoItem])
async def listar_centros_adscritos(
    db: AsyncSession = Depends(get_db),
) -> List[CentroAdscritoItem]:
    r = await db.execute(
        text(
            "SELECT id, nombre, codigo, parroquia, direccion "
            "FROM clinicas WHERE activo = TRUE ORDER BY nombre"
        )
    )
    return [
        CentroAdscritoItem(
            id=f["id"],
            nombre=f["nombre"],
            codigo=f["codigo"] or "",
            parroquia=f["parroquia"] or "",
            direccion=f["direccion"] or "",
        )
        for f in r.mappings()
    ]


@router.get("/examenes-ofrecidos", response_model=List[ExamenOfrecidoItem])
async def listar_examenes_ofrecidos(
    texto: Optional[str] = None,
    centro_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
) -> List[ExamenOfrecidoItem]:
    cond = "eo.activo = TRUE"
    params: dict = {}
    if centro_id:
        cond += " AND eo.centro_id = :cid"
        params["cid"] = centro_id
    if texto and texto.strip():
        cond += " AND translate(lower(eo.examen), 'áéíóúüñ', 'aeiouun') LIKE :t"
        params["t"] = f"%{texto.strip().lower().translate(str.maketrans('ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))}%"
    r = await db.execute(
        text(
            "SELECT eo.id, eo.examen, eo.centro_id, cl.nombre AS centro, "
            "eo.horario_atencion, eo.horario_texto, eo.cupo_diario "
            "FROM examenes_ofrecidos eo JOIN clinicas cl ON cl.id = eo.centro_id "
            f"WHERE {cond} ORDER BY eo.examen, cl.nombre"
        ),
        params,
    )
    return [
        ExamenOfrecidoItem(
            id=f["id"],
            examen=f["examen"],
            centro_id=f["centro_id"],
            centro=f["centro"],
            horario_atencion=f["horario_atencion"] or {},
            horario_texto=f["horario_texto"] or "",
            cupo_diario=int(f["cupo_diario"] or 0),
        )
        for f in r.mappings()
    ]


@router.get("/examenes-ofrecidos/{ofrecido_id}/disponibilidad", response_model=List[DiaDisponibilidadExamen])
async def disponibilidad_examen(
    ofrecido_id: int,
    dias: int = RANGO_DIAS,
    db: AsyncSession = Depends(get_db),
) -> List[DiaDisponibilidadExamen]:
    ofrecido = await _ofrecido(db, ofrecido_id)
    dias = max(1, min(int(dias), RANGO_DIAS))
    hoy = datetime.now().date()
    desde = hoy + timedelta(days=1)
    hasta = desde + timedelta(days=dias - 1)
    ocup = await _ocupadas(db, ofrecido_id, desde, hasta)
    resultado = []
    cur = desde
    while cur <= hasta:
        resultado.append(_dia_disponible(ofrecido, cur, ocup.get(cur.isoformat(), {})))
        cur += timedelta(days=1)
    return resultado


@router.get("/examenes-ofrecidos/{ofrecido_id}/turnos", response_model=List[DiaDisponibilidadExamen])
async def turnos_examen(
    ofrecido_id: int,
    fecha: str,
    db: AsyncSession = Depends(get_db),
) -> List[DiaDisponibilidadExamen]:
    try:
        fec = datetime.strptime(fecha, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="fecha inválida (YYYY-MM-DD).")
    ofrecido = await _ofrecido(db, ofrecido_id)
    ocup = await _ocupadas(db, ofrecido_id, fec, fec)
    return [_dia_disponible(ofrecido, fec, ocup.get(feCtxt := fec.isoformat(), {}))]


@router.get("/elegibilidad", response_model=ElegibilidadResponse)
async def elegibilidad_remision(
    cedula: str,
    db: AsyncSession = Depends(get_db),
) -> ElegibilidadResponse:
    if not cedula or not cedula.strip():
        raise HTTPException(status_code=400, detail="cedula requerida.")
    c = cedula.strip()
    emp = (
        await db.execute(text("SELECT 1 FROM empleados WHERE cedula = :c AND activo = TRUE"), {"c": c})
    ).first()
    if emp:
        return ElegibilidadResponse(elegible=True, tipo="trabajador")
    ben = (
        await db.execute(
            text("SELECT 1 FROM beneficiarios WHERE cedula = :c AND activo = TRUE"), {"c": c}
        )
    ).first()
    if ben:
        return ElegibilidadResponse(elegible=True, tipo="beneficiario")
    return ElegibilidadResponse(elegible=False, tipo="publico")


def _generar_codigo(year: int) -> str:
    sufijo = "".join(random.choices(string.hexdigits.upper(), k=4))
    return f"EXAM-{year}-{sufijo}"


@router.post("/citas", response_model=CitaExamenResponse, status_code=status.HTTP_201_CREATED)
async def crear_cita_examen(
    payload: CitaExamenCrearRequest,
    db: AsyncSession = Depends(get_db),
) -> CitaExamenResponse:
    try:
        fec = datetime.strptime(payload.fecha, "%Y-%m-%d").date()
        hora = datetime.strptime(payload.hora_inicio, "%H:%M").time()
    except ValueError:
        raise HTTPException(status_code=400, detail="fecha/hora inválidas.")
    hoy = datetime.now().date()
    if fec <= hoy or fec > hoy + timedelta(days=RANGO_DIAS):
        raise HTTPException(
            status_code=400, detail=f"La fecha debe estar entre mañana y {RANGO_DIAS} días."
        )

    pac = (
        await db.execute(
            text("SELECT cedula FROM historias_clinicas WHERE id::text = :pid"),
            {"pid": payload.paciente_id},
        )
    ).mappings().first()
    if not pac:
        raise HTTPException(status_code=404, detail="Paciente no encontrado.")
    ced = pac["cedula"]

    emp = (
        await db.execute(text("SELECT 1 FROM empleados WHERE cedula = :c AND activo = TRUE"), {"c": ced})
    ).first()
    ben = None
    if not emp:
        ben = (
            await db.execute(
                text("SELECT 1 FROM beneficiarios WHERE cedula = :c AND activo = TRUE"), {"c": ced}
            )
        ).first()
    if not emp and not ben:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo trabajadores y beneficiarios pueden ser remitidos para estudios.",
        )

    ofrecido = await _ofrecido(db, payload.examen_ofrecido_id)
    horario = ofrecido.get("horario_atencion") or {}
    ventanas = horario.get(DIA_ES[fec.weekday()], []) or []
    if not any(payload.hora_inicio == str(v).split("-")[0].strip() for v in ventanas):
        raise HTTPException(
            status_code=400,
            detail=f"{ofrecido['examen']} no se realiza ese día/hora en {ofrecido['centro']}.",
        )

    cupo = int(ofrecido.get("cupo_diario") or 0)
    n_ocup = (
        await db.execute(
            text(
                "SELECT count(*) FROM citas_examenes "
                "WHERE examen_ofrecido_id = :id AND fecha_cita = :f "
                "AND estado IN ('pendiente', 'realizada')"
            ),
            {"id": payload.examen_ofrecido_id, "f": fec},
        )
    ).scalar()
    if cupo <= int(n_ocup or 0):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Se agotó el cupo de {cupo} pacientes para esa fecha en {ofrecido['centro']}.",
        )

    turno_ocupado = (
        await db.execute(
            text(
                "SELECT 1 FROM citas_examenes "
                "WHERE examen_ofrecido_id = :id AND fecha_cita = :f "
                "AND hora_inicio = :h AND estado IN ('pendiente', 'realizada')"
            ),
            {"id": payload.examen_ofrecido_id, "f": fec, "h": hora},
        )
    ).first()
    if turno_ocupado:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese turno ya está ocupado.")

    codigo = _generar_codigo(fec.year)
    while True:
        existe = (
            await db.execute(text("SELECT 1 FROM citas_examenes WHERE codigo_confirmacion = :c"), {"c": codigo})
        ).first()
        if not existe:
            break
        codigo = _generar_codigo(fec.year)

    r = await db.execute(
        text(
            "INSERT INTO citas_examenes "
            "(id, examen_ofrecido_id, paciente_id, fecha_cita, hora_inicio, motivo, estado, codigo_confirmacion) "
            "VALUES (gen_random_uuid(), :eid, :pid, :fec, :hora, :mot, 'pendiente', :cod) "
            "RETURNING id, codigo_confirmacion"
        ),
        {
            "eid": payload.examen_ofrecido_id,
            "pid": payload.paciente_id,
            "fec": fec,
            "hora": hora,
            "mot": (payload.motivo or "").strip() or None,
            "cod": codigo,
        },
    )
    await db.commit()
    fila = r.mappings().first()

    return CitaExamenResponse(
        cita_id=str(fila["id"]),
        codigo_confirmacion=fila["codigo_confirmacion"],
        examen_ofrecido_id=payload.examen_ofrecido_id,
        examen=ofrecido["examen"],
        centro=ofrecido["centro"],
        fecha_cita=fec.isoformat(),
        hora_inicio=payload.hora_inicio,
        estado="pendiente",
    )