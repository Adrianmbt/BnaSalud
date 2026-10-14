"""Consultas médicas en el historial clínico del paciente."""
import json
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.consultas import (
    ConsultaCargarRequest,
    ConsultaDetalleCompleta,
    ConsultaDetalleResponse,
    ConsultaHoyItemResponse,
    ConsultaUpdateRequest,
    DetalleEstadoRemision,
    DetalleRemisionExamen,
    SignosVitales,
)

router = APIRouter(tags=["Consultas"])


def _generar_comprobante() -> str:
    return f"ABH-{secrets.randbelow(90000) + 10000}"


def _parse_json_list(valor) -> List[dict]:
    if not valor:
        return []
    if isinstance(valor, list):
        return valor
    try:
        parsed = json.loads(valor)
        return parsed if isinstance(parsed, list) else []
    except (ValueError, TypeError):
        return []


def _vitales_para_jsonb(sv: Optional[SignosVitales]) -> Optional[dict]:
    if sv is None:
        return None
    datos = sv.model_dump(exclude_none=True)
    return datos if datos else None


def _mapear_payload(payload: ConsultaCargarRequest) -> dict:
    """Traduce el payload enriquecido del frontend a las columnas de `consultas`."""
    signos_vitales = _vitales_para_jsonb(payload.signos_vitales)

    insumos = list(payload.insumos or [])
    if signos_vitales:
        insumos.append({"tipo": "signos_vitales", "datos": signos_vitales})
    if payload.diagnostico_secundario:
        insumos.append({"tipo": "diagnostico_secundario", "valor": payload.diagnostico_secundario.strip()})

    recetas = [r.model_dump() for r in payload.recetas]

    registro = {
        "paciente_id": payload.paciente_id,
        "cola_id": payload.cola_id,
        "cita_id": payload.cita_id,
        "medico_id": payload.medico_id,
        "medico_nombre": payload.medico_nombre or "No asignado",
        "especialidad": payload.especialidad or "Medicina General",
        "motivo_consulta": payload.enfermedad_actual or payload.motivo_consulta,
        "examen_fisico": payload.examen_fisico,
        "cie10_codigo": payload.codigo_cie10 or payload.cie10_codigo,
        "cie10_descripcion": payload.diagnostico_principal or payload.cie10_descripcion,
        "tratamiento": payload.tratamiento,
        "recomendaciones": payload.indicaciones_medicas or payload.recomendaciones,
        "recetas": json.dumps(recetas, ensure_ascii=False),
        "laboratorios": json.dumps(payload.laboratorios or [], ensure_ascii=False),
        "estudios": json.dumps(payload.estudios or [], ensure_ascii=False),
        "insumos": json.dumps(insumos, ensure_ascii=False),
        "ordenes_ids": json.dumps(payload.ordenes_ids or [], ensure_ascii=False),
        "comprobante_ref": payload.comprobante_ref or _generar_comprobante(),
    }
    if payload.proxima_consulta:
        registro["proxima_consulta"] = payload.proxima_consulta.strip()

    if payload.remision_examen:
        registro["examen_remitido"] = True
        registro["cita_examen_id"] = str(payload.remision_examen.cita_examen_id)
    return registro


def _extraer_estructurados(insumos: List[dict]) -> tuple:
    """Devuelve (signos_vitales, diagnostico_secundario) a partir del jsonb insumos."""
    sv: Optional[dict] = None
    diag_sec = None
    for item in insumos:
        if not isinstance(item, dict):
            continue
        if item.get("tipo") == "signos_vitales" and isinstance(item.get("datos"), dict):
            sv = item["datos"]
        elif item.get("tipo") == "diagnostico_secundario":
            diag_sec = item.get("valor")
    return sv, diag_sec


def _insumos_aplicados(insumos: List[dict]) -> List[dict]:
    """Devuelve solo los insumos/medicamentos realmente aplicados al paciente.

    Incluye medicamentos con insumo_id (del stock) y medicamentos externos
    (tipo == 'medicamento_externo', sin insumo_id).
    Filtra los pseudo-items estructurados (signos_vitales, diagnostico_secundario).
    """
    resultado = []
    for item in insumos or []:
        if not isinstance(item, dict):
            continue
        if item.get("tipo") in ("signos_vitales", "diagnostico_secundario"):
            continue
        if item.get("insumo_id") is not None or item.get("tipo") == "medicamento_externo":
            resultado.append(item)
    return resultado


async def _validar_y_descontar_insumos(
    db: AsyncSession,
    insumos: List[dict],
    clinica_id: Optional[int] = None,
) -> None:
    """Valida stock de los insumos aplicados y descuenta del inventario.

    Usa tabla_origen (si viene del frontend) para buscar directamente en la tabla
    correcta y evitar colisiones de ID entre medicamentos_catalogo e insumos_catalogo.
    Fallback a búsqueda en las 3 tablas si no se provee tabla_origen.

    Si hay clinica_id y existe stock_por_centro para el insumo, el stock se
    valida/desc uenta contra ese centro (y no contra el global).
    """
    aplicados = _insumos_aplicados(insumos)
    if not aplicados:
        return

    TABLAS_VALIDAS = {"medicamentos_catalogo", "insumos_catalogo"}
    inventario = {}

    # Agrupar items por tabla_origen conocida
    por_tabla = {}
    sin_tabla = []
    for item in aplicados:
        if item.get("insumo_id") is None:
            continue
        tabla = item.get("tabla_origen", "")
        if tabla in TABLAS_VALIDAS:
            por_tabla.setdefault(tabla, []).append(item)
        else:
            sin_tabla.append(item)

    # Lookup directo por tabla_origen
    for tabla, items in por_tabla.items():
        ids = [int(i["insumo_id"]) for i in items if str(i.get("insumo_id", "")).isdigit()]
        if not ids:
            continue
        result = await db.execute(
            text(f"SELECT id, nombre, stock_actual FROM {tabla} WHERE id = ANY(:ids) AND activo = TRUE"),
            {"ids": ids},
        )
        for r in result.mappings():
            inventario[(tabla, r.id)] = {"nombre": r.nombre, "stock_actual": r.stock_actual, "tabla": tabla}

    # Fallback: buscar en las 3 tablas para items sin tabla_origen
    if sin_tabla:
        ids_fb = [int(i["insumo_id"]) for i in sin_tabla if str(i.get("insumo_id", "")).isdigit()]
        if ids_fb:
            for tabla in ["medicamentos_catalogo", "insumos_catalogo"]:
                if not ids_fb:
                    break
                result = await db.execute(
                    text(f"SELECT id, nombre, stock_actual FROM {tabla} WHERE id = ANY(:ids) AND activo = TRUE"),
                    {"ids": ids_fb},
                )
                found_ids = set()
                for r in result.mappings():
                    inventario[(tabla, r.id)] = {"nombre": r.nombre, "stock_actual": r.stock_actual, "tabla": tabla}
                    found_ids.add(r.id)
                ids_fb = [i for i in ids_fb if i not in found_ids]

    # Stock por centro (solo insumos; stock_por_centro referencia insumos_catalogo)
    stock_centro: dict = {}
    if clinica_id is not None:
        ids_insumo = [
            int(i["insumo_id"])
            for i in aplicados
            if i.get("insumo_id") is not None and str(i.get("insumo_id", "")).isdigit()
        ]
        if ids_insumo:
            result = await db.execute(
                text(
                    "SELECT insumo_id, stock_actual FROM stock_por_centro "
                    "WHERE clinica_id = :c AND insumo_id = ANY(:ids)"
                ),
                {"c": clinica_id, "ids": list(set(ids_insumo))},
            )
            stock_centro = {r.insumo_id: r.stock_actual for r in result.mappings()}

    def _stock_disponible(iid: int, med: dict) -> int:
        if med["tabla"] == "insumos_catalogo" and iid in stock_centro:
            return stock_centro[iid] or 0
        return med["stock_actual"] or 0

    # Validar stock
    for item in aplicados:
        iid = item.get("insumo_id")
        if iid is None:
            continue
        iid = int(iid)
        tabla = item.get("tabla_origen", "")
        if tabla in TABLAS_VALIDAS:
            med = inventario.get((tabla, iid))
        else:
            # Buscar en cualquier tabla
            med = None
            for t in TABLAS_VALIDAS:
                med = inventario.get((t, iid))
                if med:
                    break
        if not med:
            raise HTTPException(400, f"El insumo/medicamento id {iid} no existe en el inventario.")
        cantidad = int(item.get("cantidad") or 1)
        if cantidad <= 0:
            raise HTTPException(400, f"Cantidad invalida para {med['nombre']}.")
        if _stock_disponible(iid, med) < cantidad:
            raise HTTPException(
                409,
                f"Stock insuficiente de {med['nombre']}: disponible {_stock_disponible(iid, med)}, requerido {cantidad}.",
            )

    # Descontar stock
    for item in aplicados:
        iid = item.get("insumo_id")
        if iid is None:
            continue
        iid = int(iid)
        cantidad = int(item.get("cantidad") or 1)
        tabla = item.get("tabla_origen", "")
        if tabla in TABLAS_VALIDAS:
            med = inventario.get((tabla, iid))
        else:
            med = None
            for t in TABLAS_VALIDAS:
                med = inventario.get((t, iid))
                if med:
                    break
        if not med:
            continue
        if med["tabla"] == "insumos_catalogo" and iid in stock_centro:
            await db.execute(
                text(
                    "UPDATE stock_por_centro SET stock_actual = stock_actual - :cant "
                    "WHERE clinica_id = :c AND insumo_id = :id"
                ),
                {"cant": cantidad, "c": clinica_id, "id": iid},
            )
            # Doble libro: el descuento de un centro también resta del global.
            await db.execute(
                text("UPDATE insumos_catalogo SET stock_actual = stock_actual - :cant WHERE id = :id"),
                {"cant": cantidad, "id": iid},
            )
            continue
        await db.execute(
            text(f"UPDATE {med['tabla']} SET stock_actual = stock_actual - :cant WHERE id = :id"),
            {"cant": cantidad, "id": iid},
        )


async def _validar_remision_examen(db: AsyncSession, payload: ConsultaCargarRequest) -> None:
    """Valida la cita de examen remitida: debe existir, ser del paciente y estar pendiente."""
    rex = payload.remision_examen
    if not rex:
        return
    cita = (
        await db.execute(
            text(
                "SELECT ce.paciente_id, ce.estado, ce.examen_ofrecido_id "
                "FROM citas_examenes ce WHERE ce.id::text = :cid"
            ),
            {"cid": rex.cita_examen_id},
        )
    ).mappings().first()
    if not cita:
        raise HTTPException(404, "La cita de examen remitida no existe.")
    if str(cita["paciente_id"]) != str(payload.paciente_id):
        raise HTTPException(400, "La cita de examen no pertenece al paciente.")
    if cita["estado"] != "pendiente":
        raise HTTPException(409, f"La cita de examen ya está {cita['estado']}.")
    if cita["examen_ofrecido_id"] != rex.examen_ofrecido_id:
        raise HTTPException(400, "El examen_ofrecido_id no coincide con la cita.")


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
async def crear_consulta(
    payload: ConsultaCargarRequest,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_current_user),
) -> dict:
    """Registra una consulta médica (incl. signos vitales y diagnósticos) en el historial."""
    await _validar_remision_examen(db, payload)
    registro = _mapear_payload(payload)

    clinica_id = usuario.get("clinica_id")
    if clinica_id is not None:
        registro["clinica_id"] = clinica_id

    await _validar_y_descontar_insumos(db, payload.insumos, clinica_id=clinica_id)

    columnas = ", ".join(registro.keys())
    placeholders = ", ".join(f":{k}" for k in registro.keys())
    result = await db.execute(
        text(f"INSERT INTO consultas ({columnas}) VALUES ({placeholders}) RETURNING id, comprobante_ref"),
        registro,
    )
    await db.commit()
    fila = dict(result.mappings().first())

    if payload.cita_id:
        try:
            # La cita puede llegar como código de confirmación o como UUID (id) de la cita.
            await db.execute(
                text(
                    "UPDATE citas SET estado = 'completada' "
                    "WHERE codigo_confirmacion = :codigo OR id::text = :codigo"
                ),
                {"codigo": payload.cita_id},
            )
            await db.commit()
        except Exception:
            await db.rollback()

    return {"id": fila["id"], "comprobante_ref": fila["comprobante_ref"]}


@router.get("/hoy", response_model=List[ConsultaHoyItemResponse])
async def listar_atendidos_hoy(
    fecha: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> List[ConsultaHoyItemResponse]:
    """Lista las consultas registradas en el día (datatable de atendidos hoy).

    Si no se pasa `fecha`, usa CURRENT_DATE; si se pasa, filtra por ese día
    (ATENDIDOS por fecha, con la zona horaria de la BD).
    """
    if not fecha:
        fecha = "CURRENT_DATE"
    else:
        try:
            datetime.fromisoformat(fecha)
        except ValueError:
            raise HTTPException(400, "Formato de fecha inválido (esperado YYYY-MM-DD).")
        fecha = f"DATE '{fecha}'"
    result = await db.execute(
        text(
            "SELECT c.id, c.created_at, c.especialidad, c.medico_nombre, "
            "c.motivo_consulta, c.examen_fisico, c.cie10_codigo, c.cie10_descripcion, "
            "c.tratamiento, c.recomendaciones, c.comprobante_ref, "
            "h.cedula AS paciente_cedula, h.nombre_completo AS paciente_nombre "
            "FROM consultas c "
            "LEFT JOIN historias_clinicas h ON h.id::text = c.paciente_id::text "
            f"WHERE c.created_at::date = {fecha} "
            "ORDER BY c.created_at DESC"
        ),
    )
    filas = [dict(r) for r in result.mappings()]

    return [
        ConsultaHoyItemResponse(
            consulta_id=str(c["id"]),
            creado_en=str(c.get("created_at") or "")[:19],
            paciente_cedula=c.get("paciente_cedula") or "",
            paciente_nombre=c.get("paciente_nombre") or "",
            comprobante_ref=c.get("comprobante_ref") or "",
            especialidad=c.get("especialidad") or "",
            medico_nombre=c.get("medico_nombre") or "",
            motivo_consulta=c.get("motivo_consulta") or "",
            examen_fisico=c.get("examen_fisico"),
            cie10_codigo=c.get("cie10_codigo") or "",
            cie10_descripcion=c.get("cie10_descripcion") or "",
            tratamiento=c.get("tratamiento") or "",
            recomendaciones=c.get("recomendaciones"),
        )
        for c in filas
    ]


@router.get("/contador-hoy/{medico_id}")
async def contar_consultas_hoy(
    medico_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Retorna la cantidad de consultas del médico en el día de hoy."""
    result = await db.execute(
        text(
            "SELECT COUNT(*) AS total FROM consultas "
            "WHERE medico_id = :mid AND created_at::date = CURRENT_DATE"
        ),
        {"mid": medico_id},
    )
    total = result.scalar() or 0
    return {"total": total}


@router.get("/detalle/{consulta_id}", response_model=ConsultaDetalleCompleta)
async def detalle_consulta(
    consulta_id: str,
    db: AsyncSession = Depends(get_db),
) -> ConsultaDetalleCompleta:
    """Detalle completo de una consulta + estado final (remitido/finalizado) y cita con el especialista."""
    try:
        from uuid import UUID
        UUID(consulta_id)
    except ValueError:
        raise HTTPException(404, "Consulta no encontrada.")

    r = await db.execute(
        text(
            "SELECT c.id, c.created_at, c.especialidad, c.medico_nombre, "
            "c.motivo_consulta, c.examen_fisico, c.cie10_codigo, c.cie10_descripcion, "
            "c.tratamiento, c.recomendaciones, c.recetas, c.laboratorios, c.estudios, "
            "c.insumos, c.comprobante_ref, "
            "c.examen_remitido, c.cita_examen_id, "
            "cex.fecha_cita AS ex_fecha, "
            "to_char(cex.hora_inicio, 'HH24:MI') AS ex_hora, "
            "cex.codigo_confirmacion AS ex_codigo, "
            "cex.estado AS ex_estado, eo.examen AS ex_nombre, "
            "cl.nombre AS ex_centro, "
            "h.cedula AS paciente_cedula, h.nombre_completo AS paciente_nombre, "
            "ca.derivado_a_especialista AS remitido, "
            "ci.especialidad AS cita_especialidad, ci.fecha_cita, "
            "to_char(ci.hora_inicio, 'HH24:MI') AS cita_hora, "
            "ci.codigo_confirmacion AS codigo_cita, "
            "TRIM(CONCAT(p.nombre, ' ', p.apellido)) AS medico_especialista "
            "FROM consultas c "
            "LEFT JOIN historias_clinicas h ON h.id::text = c.paciente_id::text "
            "LEFT JOIN cola_atencion ca ON ca.id = c.cola_id "
            "LEFT JOIN citas ci ON ci.codigo_confirmacion = c.cita_id "
            "LEFT JOIN personal p ON p.id = ci.medico_id "
            "LEFT JOIN citas_examenes cex ON cex.id::text = c.cita_examen_id::text "
            "LEFT JOIN examenes_ofrecidos eo ON eo.id = cex.examen_ofrecido_id "
            "LEFT JOIN clinicas cl ON cl.id = eo.centro_id "
            "WHERE c.id = :cid"
        ),
        {"cid": consulta_id},
    )
    fila = r.mappings().first()
    if not fila:
        raise HTTPException(404, "Consulta no encontrada.")

    insumos = _parse_json_list(fila.get("insumos"))
    sv, diag_sec = _extraer_estructurados(insumos)

    return ConsultaDetalleCompleta(
        consulta_id=str(fila["id"]),
        fecha=str(fila.get("created_at") or "")[:19],
        paciente_cedula=fila.get("paciente_cedula") or "",
        paciente_nombre=fila.get("paciente_nombre") or "",
        comprobante_ref=fila.get("comprobante_ref") or "",
        especialidad=fila.get("especialidad") or "",
        medico_nombre=fila.get("medico_nombre") or "",
        motivo_consulta=fila.get("motivo_consulta") or "",
        examen_fisico=fila.get("examen_fisico"),
        cie10_codigo=fila.get("cie10_codigo") or "",
        cie10_descripcion=fila.get("cie10_descripcion") or "",
        diagnostico_secundario=diag_sec,
        signos_vitales=sv,
        tratamiento=fila.get("tratamiento"),
        recomendaciones=fila.get("recomendaciones"),
        recetas=_parse_json_list(fila.get("recetas")),
        laboratorios=_parse_json_list(fila.get("laboratorios")),
        estudios=_parse_json_list(fila.get("estudios")),
        insumos_aplicados=_insumos_aplicados(insumos),
        remision=DetalleEstadoRemision(
            remitido=bool(fila.get("remitido")) or bool(fila.get("codigo_cita")),
            especialidad_destino=fila.get("cita_especialidad") or "",
            cita_fecha=str(fila.get("cita_fecha") or "")[:10] or None,
            cita_hora=fila.get("cita_hora"),
            medico_especialista=fila.get("medico_especialista"),
            codigo_cita=fila.get("codigo_cita"),
        ),
        remision_examen=DetalleRemisionExamen(
            remitido=bool(fila.get("examen_remitido")),
            examen=fila.get("ex_nombre"),
            centro=fila.get("ex_centro"),
            fecha_cita=str(fila.get("ex_fecha") or "")[:10] or None,
            hora_inicio=fila.get("ex_hora"),
            codigo_confirmacion=fila.get("ex_codigo"),
            estado=fila.get("ex_estado"),
        ),
    )


@router.put("/{consulta_id}")
async def actualizar_consulta_completa(
    consulta_id: str,
    payload: ConsultaCargarRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Reemplaza el contenido clínico de una consulta ya registrada (retomar del día).

    Conserva el comprobante e identificadores de origen (cola, cita) de la
    consulta original y no vuelve a descontar stock de insumos.
    """
    fila = (
        await db.execute(
            text("SELECT id, comprobante_ref FROM consultas WHERE id = :cid"),
            {"cid": consulta_id},
        )
    ).mappings().first()
    if not fila:
        raise HTTPException(404, "Consulta no encontrada.")

    await _validar_remision_examen(db, payload)
    registro = _mapear_payload(payload)
    registro.pop("comprobante_ref", None)
    for clave in ("cola_id", "cita_id"):
        if registro.get(clave) is None:
            registro.pop(clave, None)

    columnas = ", ".join(f"{k} = :{k}" for k in registro.keys())
    registro["cid"] = consulta_id
    await db.execute(
        text(f"UPDATE consultas SET {columnas} WHERE id = :cid"),
        registro,
    )
    await db.commit()
    return {"id": str(fila["id"]), "comprobante_ref": fila["comprobante_ref"]}


@router.patch("/{consulta_id}")
async def actualizar_consulta(
    consulta_id: str,
    payload: ConsultaUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Edita los campos clínicos de una consulta ya registrada."""
    filtro = dict(
        {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    )
    if not filtro:
        return {"status": "success", "consulta_id": consulta_id, "actualizado": False}

    columnas = ", ".join(f"{k} = :{k}" for k in filtro.keys())
    filtro["cid"] = consulta_id
    existe = (await db.execute(
        text("SELECT 1 FROM consultas WHERE id = :cid"),
        {"cid": consulta_id},
    )).first()
    if not existe:
        raise HTTPException(404, "Consulta no encontrada.")
    await db.execute(
        text(f"UPDATE consultas SET {columnas} WHERE id = :cid"),
        filtro,
    )
    await db.commit()
    return {"status": "success", "consulta_id": consulta_id, "actualizado": True}


@router.delete("/{consulta_id}")
async def eliminar_consulta(
    consulta_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Elimina una consulta del registro de atendidos hoy."""
    existe = (await db.execute(
        text("SELECT 1 FROM consultas WHERE id = :cid"),
        {"cid": consulta_id},
    )).first()
    if not existe:
        raise HTTPException(404, "Consulta no encontrada.")
    await db.execute(
        text("DELETE FROM consultas WHERE id = :cid"),
        {"cid": consulta_id},
    )
    await db.commit()
    return {"status": "success", "consulta_id": consulta_id}


@router.put("/{consulta_id}/resultados-examenes")
async def actualizar_resultados_examenes(
    consulta_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Actualiza los resultados de exámenes (laboratorios + estudios) de una consulta."""
    existe = (await db.execute(
        text("SELECT 1 FROM consultas WHERE id = :cid"),
        {"cid": consulta_id},
    )).first()
    if not existe:
        raise HTTPException(404, "Consulta no encontrada.")

    lab = payload.get("laboratorios")
    est = payload.get("estudios")
    updates = []
    params = {"cid": consulta_id}
    if lab is not None:
        updates.append("laboratorios = :lab")
        params["lab"] = json.dumps(lab, ensure_ascii=False)
    if est is not None:
        updates.append("estudios = :est")
        params["est"] = json.dumps(est, ensure_ascii=False)
    if not updates:
        return {"status": "success", "consulta_id": consulta_id, "actualizado": False}

    await db.execute(
        text(f"UPDATE consultas SET {', '.join(updates)} WHERE id = :cid"),
        params,
    )
    await db.commit()
    return {"status": "success", "consulta_id": consulta_id, "actualizado": True}


@router.get("/{paciente_id}", response_model=List[ConsultaDetalleResponse])
async def listar_consultas(
    paciente_id: str,
    db: AsyncSession = Depends(get_db),
) -> List[ConsultaDetalleResponse]:
    """Lista las consultas de un paciente por su id."""
    try:
        from uuid import UUID
        UUID(paciente_id)
    except ValueError:
        return []

    result = await db.execute(
        text(
            "SELECT c.*, cl.nombre AS centro_nombre, cl.codigo AS centro_codigo "
            "FROM consultas c "
            "LEFT JOIN clinicas cl ON cl.id = c.clinica_id "
            "WHERE c.paciente_id = :pid "
            "ORDER BY c.created_at DESC"
        ),
        {"pid": paciente_id},
    )
    filas = [dict(r) for r in result.mappings()]

    resultado: List[ConsultaDetalleResponse] = []
    for c in filas:
        insumos = _parse_json_list(c.get("insumos"))
        sv, diag_sec = _extraer_estructurados(insumos)
        resultado.append(
            ConsultaDetalleResponse(
                consulta_id=str(c["id"]),
                fecha=str(c.get("created_at") or "")[:19],
                cola_id=c.get("cola_id"),
                especialidad=c.get("especialidad", ""),
                medico_nombre=c.get("medico_nombre", ""),
                cie10_codigo=c.get("cie10_codigo", ""),
                cie10_descripcion=c.get("cie10_descripcion", ""),
                motivo_consulta=c.get("motivo_consulta", ""),
                examen_fisico=c.get("examen_fisico"),
                signos_vitales=SignosVitales(**sv) if sv else None,
                diagnostico_secundario=diag_sec,
                tratamiento=c.get("tratamiento", ""),
                recomendaciones=c.get("recomendaciones"),
                recetas=_parse_json_list(c.get("recetas")),
                laboratorios=_parse_json_list(c.get("laboratorios")),
                estudios=_parse_json_list(c.get("estudios")),
                insumos=insumos,
                insumos_aplicados=_insumos_aplicados(insumos),
                ordenes_ids=[str(o) for o in (c.get("ordenes_ids") or [])],
                proxima_consulta=c.get("proxima_consulta"),
                comprobante_ref=c.get("comprobante_ref", ""),
                centro_nombre=c.get("centro_nombre") or "Sin centro",
                centro_codigo=c.get("centro_codigo") or "",
            )
        )
    return resultado
