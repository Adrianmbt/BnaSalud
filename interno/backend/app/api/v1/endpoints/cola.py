"""Cola de atención: registro en recepción, listado por estado y transición de estado.

Basado en el flujo de trabajo de `cola_atencion` + `atencion_historial_estados`
usando SQLAlchemy Async con inyección de AsyncSession desde el pool.
"""
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete, func, text, and_, bindparam
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.cola import (
    ColaAtencion,
    ColaAtencionHistorial,
    EstadoAtencionEnum,
    RutaAtencionEnum,
)
from app.models.historias_clinicas import HistoriaClinica
from app.schemas.cola import (
    CheckInRequest,
    ColaItemSchema,
    ColaListaResponse,
    EditarColaRequest,
    TransicionEstadoRequest,
    TransicionEstadoResponse,
)

router = APIRouter()

async def _encolar_citas_hoy(db: AsyncSession, medico_id: int) -> None:
    """Encolea automáticamente las citas pendientes de HOY de un especialista.

    Para cada cita pendiente (no cancelada/completada) del día con el médico indicado,
    crea un registro en `cola_atencion` (estado EN_ESPERA_CONSULTA) si aún no existe una
    cola vinculada a esa cita, y enlaza `cola_id` en la cita.

    Respeta la unicidad `uq_cola_paciente_por_dia`: si el paciente ya tiene un registro
    de cola HOY en estado terminal (finalizado/cancelado/no asistió — p. ej. salió de
    emergencias), se reutiliza ese registro reencolándolo para el especialista en lugar
    de duplicar al paciente.
    """
    hoy = (await db.execute(text("SELECT CURRENT_DATE AS hoy"))).scalar_one()
    fecha_dia_cola = func.date(
        func.timezone("America/Caracas", ColaAtencion.creado_en)
    )

    # Obtener clinica_id del médico desde la tabla personal
    medico_row = (await db.execute(
        text("SELECT clinica_id FROM personal WHERE id = :mid"),
        {"mid": medico_id},
    )).mappings().first()
    clinica_id_medico = medico_row["clinica_id"] if medico_row else None

    citas = (await db.execute(
        text(
            "SELECT c.id, c.paciente_id, c.especialidad, c.motivo, c.hora_inicio, "
            "       c.codigo_confirmacion, c.cola_id "
            "FROM citas c "
            "WHERE c.medico_id = :mid AND c.fecha_cita = :fec "
            "  AND c.estado NOT IN ('cancelada', 'completada')"
        ),
        {"mid": medico_id, "fec": hoy},
    )).mappings().all()

    hay_cambios = False
    for cita in citas:
        if cita["cola_id"] is not None:
            continue

        # Datos del paciente desde la historia clínica (si existe).
        nombre = "Paciente"
        cedula = ""
        if cita["paciente_id"]:
            hc = (await db.execute(
                text(
                    "SELECT cedula, nombre_completo FROM historias_clinicas WHERE id = :pid"
                ),
                {"pid": cita["paciente_id"]},
            )).mappings().first()
            if hc:
                cedula = hc["cedula"] or ""
                nombre = hc["nombre_completo"] or "Paciente"

        # Reutilizar el registro de HOY del paciente si está en estado terminal.
        if cedula:
            existente = (
                await db.execute(
                    select(ColaAtencion)
                    .where(
                        ColaAtencion.paciente_cedula == cedula,
                        fecha_dia_cola == hoy,
                        ColaAtencion.atencion_estado.in_([
                            EstadoAtencionEnum.FINALIZADO,
                            EstadoAtencionEnum.CANCELADO,
                            EstadoAtencionEnum.NO_ASISTIO,
                        ]),
                    )
                    .order_by(ColaAtencion.creado_en.asc())
                    .limit(1)
                )
            ).scalar_one_or_none()

            if existente is not None:
                existente.atencion_estado = EstadoAtencionEnum.EN_ESPERA_CONSULTA
                existente.ruta_atencion = RutaAtencionEnum.CITA
                existente.motivo_consulta = cita["motivo"]
                existente.especialidad = cita["especialidad"]
                existente.medico_id = medico_id
                existente.especialista_id = medico_id
                existente.derivado_a_especialista = True
                existente.cita_id = cita["id"]
                existente.fec_encolada = datetime.now(timezone.utc)
                existente.fin_en = None
                existente.cancelado_en = None
                db.add(existente)
                await db.flush()

                await db.execute(
                    text("UPDATE citas SET cola_id = :cid WHERE id = :cita"),
                    {"cid": existente.id, "cita": cita["id"]},
                )
                hay_cambios = True
                continue

        token = f"C-{secrets.randbelow(90000) + 10000}"
        while True:
            existe = await db.execute(
                select(ColaAtencion.id).where(ColaAtencion.token == token)
            )
            if existe.first() is None:
                break
            token = f"C-{secrets.randbelow(90000) + 10000}"

        registro = ColaAtencion(
            token=token,
            paciente_id=cita["paciente_id"],
            paciente_cedula=cedula,
            paciente_nombre=nombre,
            ruta_atencion=RutaAtencionEnum.CITA,
            motivo_consulta=cita["motivo"],
            especialidad=cita["especialidad"],
            medico_id=medico_id,
            especialista_id=medico_id,
            derivado_a_especialista=True,
            cita_id=cita["id"],
            clinica_id=clinica_id_medico,
            atencion_estado=EstadoAtencionEnum.EN_ESPERA_CONSULTA,
            creado_en=datetime.now(timezone.utc),
            fec_encolada=datetime.now(timezone.utc),
        )
        db.add(registro)
        await db.flush()

        await db.execute(
            text("UPDATE citas SET cola_id = :cid WHERE id = :cita"),
            {"cid": registro.id, "cita": cita["id"]},
        )
        hay_cambios = True

    if hay_cambios:
        await db.commit()



# Matriz de transiciones permitidas. Los estados terminales no aceptan salidas.
TRANSICIONES_VALIDAS = {
    EstadoAtencionEnum.RECEPCION: [
        EstadoAtencionEnum.TRIAJE,
        EstadoAtencionEnum.EN_ESPERA_CONSULTA,
        EstadoAtencionEnum.EN_CONSULTA,
        EstadoAtencionEnum.CANCELADO,
        EstadoAtencionEnum.NO_ASISTIO,
    ],
    EstadoAtencionEnum.TRIAJE: [
        EstadoAtencionEnum.EN_ESPERA_CONSULTA,
        EstadoAtencionEnum.EN_CONSULTA,
        EstadoAtencionEnum.CANCELADO,
        EstadoAtencionEnum.NO_ASISTIO,
    ],
    EstadoAtencionEnum.EN_ESPERA_CONSULTA: [
        EstadoAtencionEnum.EN_CONSULTA,
        EstadoAtencionEnum.CANCELADO,
        EstadoAtencionEnum.NO_ASISTIO,
    ],
    EstadoAtencionEnum.EN_CONSULTA: [
        EstadoAtencionEnum.FINALIZADO,
        EstadoAtencionEnum.CANCELADO,
    ],
    EstadoAtencionEnum.FINALIZADO: [],
    EstadoAtencionEnum.CANCELADO: [],
    EstadoAtencionEnum.NO_ASISTIO: [],
}


async def _map_historias(
    db: AsyncSession, filas: list[ColaAtencion]
) -> dict:
    """Carga las historias clínicas de los pacientes de la cola (batch)."""
    ids = {
        f.paciente_id
        for f in filas
        if f.paciente_id is not None
    }
    resultado: dict = {}
    if ids:
        stmt = select(HistoriaClinica).where(HistoriaClinica.id.in_(ids))
        historias = (await db.execute(stmt)).scalars().all()
        for h in historias:
            resultado[h.id] = h
    return resultado


async def _map_categorias(
    db: AsyncSession, cedulas: set[str]
) -> dict[str, str]:
    """Clasifica cédulas como trabajador | beneficiario | publico (criterio de elegibilidad)."""
    res: dict[str, str] = {c: "publico" for c in cedulas}
    if not cedulas:
        return res
    q_ben = text(
        "SELECT cedula FROM beneficiarios WHERE cedula IN :cs AND activo = TRUE"
    ).bindparams(bindparam("cs", expanding=True))
    for (ced,) in (await db.execute(q_ben, {"cs": list(cedulas)})).all():
        if res.get(ced) == "publico":
            res[ced] = "beneficiario"
    q_emp = text(
        "SELECT cedula FROM empleados WHERE cedula IN :cs AND activo = TRUE"
    ).bindparams(bindparam("cs", expanding=True))
    for (ced,) in (await db.execute(q_emp, {"cs": list(cedulas)})).all():
        res[ced] = "trabajador"
    return res


def _a_item(
    f: ColaAtencion,
    historia: Optional[HistoriaClinica] = None,
    categoria: Optional[str] = None,
) -> ColaItemSchema:
    apellido = historia.apellido if historia else None
    telefono = historia.telefono if historia else None
    direccion = historia.direccion if historia else None
    return ColaItemSchema(
        id=f.id,
        token=f.token,
        paciente_id=f.paciente_id,
        paciente_cedula=f.paciente_cedula,
        paciente_nombre=f.paciente_nombre,
        apellido=apellido,
        telefono=telefono,
        direccion=direccion,
        clinica_id=f.clinica_id,
        atencion_estado=f.atencion_estado.value,
        ruta_atencion=f.ruta_atencion.value if f.ruta_atencion else None,
        triaje_realizado=f.triaje_realizado,
        categoria=categoria,
        prioridad=f.prioridad,
        sintomas_principales=f.sintomas_principales,
        motivo_consulta=f.motivo_consulta,
        especialidad=f.especialidad,
        medico_id=f.medico_id,
        cita_id=f.cita_id,
        consulta_id=f.consulta_id,
        creado_en=f.creado_en,
        fec_triaje=f.fec_triaje,
        fec_encolada=f.fec_encolada,
        iniciado_en=f.iniciado_en,
        fin_en=f.fin_en,
        cancelado_en=f.cancelado_en,
    )


async def _crear_o_actualizar_historia(
    db: AsyncSession,
    cedula: str,
    nombre: Optional[str],
    apellido: Optional[str],
    telefono: Optional[str],
    direccion: Optional[str],
) -> HistoriaClinica:
    """Localiza la historia clínica por cédula; si no existe, la crea."""
    stmt = select(HistoriaClinica).where(HistoriaClinica.cedula == cedula)
    historia = (await db.execute(stmt)).scalar_one_or_none()
    ahora = datetime.now(timezone.utc)

    if historia:
        if nombre:
            historia.nombre_completo = nombre
        if apellido is not None:
            historia.apellido = apellido
        if telefono is not None:
            historia.telefono = telefono
        if direccion is not None:
            historia.direccion = direccion
        return historia

    historia = HistoriaClinica(
        id=uuid.uuid4(),
        cedula=cedula,
        nombre_completo=nombre or "Paciente",
        apellido=apellido,
        telefono=telefono,
        direccion=direccion,
        tipo_sangre=None,
        antecedentes_medicos=[],
        alergias=[],
        created_at=ahora,
    )
    db.add(historia)
    return historia


@router.post(
    "",
    response_model=ColaItemSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Registra al paciente en recepción de la cola",
)
async def registrar_checkin(
    payload: CheckInRequest,
    db: AsyncSession = Depends(get_db),
) -> ColaItemSchema:
    """Alta de un paciente en la cola de atención (estado inicial: RECEPCION)."""
    hoy = (
        await db.execute(text("SELECT CURRENT_DATE AS hoy"))
    ).scalar_one()

    fecha_dia_cola = func.date(
        func.timezone("America/Caracas", ColaAtencion.creado_en)
    )
    duplicado = (
        await db.execute(
            select(ColaAtencion)
            .where(
                ColaAtencion.paciente_cedula == payload.cedula,
                fecha_dia_cola == hoy,
                ColaAtencion.atencion_estado.notin_(
                    [
                        EstadoAtencionEnum.CANCELADO,
                        EstadoAtencionEnum.NO_ASISTIO,
                    ]
                ),
                *(
                    [ColaAtencion.clinica_id == payload.clinica_id]
                    if payload.clinica_id is not None
                    else []
                ),
            )
            .order_by(ColaAtencion.creado_en.asc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if duplicado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"El paciente ya fue registrado hoy ({duplicado.token}, estado "
                f"'{duplicado.atencion_estado.value}'). El registro en la cola se "
                "permite una sola vez por día. Usa 'Retomar consulta' o 'Retomar "
                "paciente' para continuar su atención."
            ),
        )

    try:
        historia = await _crear_o_actualizar_historia(
            db,
            payload.cedula,
            payload.nombre,
            payload.apellido,
            payload.telefono,
            payload.direccion,
        )
        if historia:
            await db.flush()

        token = f"C-{secrets.randbelow(90000) + 10000}"
        while True:
            existe = await db.execute(
                select(ColaAtencion.id).where(ColaAtencion.token == token)
            )
            if existe.first() is None:
                break
            token = f"C-{secrets.randbelow(90000) + 10000}"

        registro = ColaAtencion(
            token=token,
            paciente_id=historia.id if historia else None,
            paciente_cedula=payload.cedula,
            paciente_nombre=payload.nombre or "Paciente",
            clinica_id=payload.clinica_id,
            ruta_atencion=(
                RutaAtencionEnum(payload.ruta_atencion.upper())
                if payload.ruta_atencion
                else None
            ),
            motivo_consulta=payload.motivo,
            especialidad=payload.especialidad,
            prioridad=payload.prioridad,
            atencion_estado=EstadoAtencionEnum.RECEPCION,
        )
        db.add(registro)
        await db.commit()
        await db.refresh(registro)
    except HTTPException:
        await db.rollback()
        raise
    except Exception as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al registrar el paciente: {str(err)}",
        )

    return _a_item(
        registro,
        historia,
        (await _map_categorias(db, {registro.paciente_cedula})).get(registro.paciente_cedula),
    )


@router.get(
    "",
    response_model=ColaListaResponse,
    summary="Lista la cola agrupada por estado",
)
async def listar_cola(
    clinica_id: Optional[int] = None,
    especialidad: Optional[str] = None,
    medico_id: Optional[int] = None,
    rol: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> ColaListaResponse:
    """Cola de la clínica agrupada por estado de atención.

    Filtrado por rol:
    - recepcionista: ve la cola completa de la clínica (clinica_id).
    - medico_emergencia: ve solo sus pacientes asignados (medico_id).
    - medico (especialista): ve solo pacientes remitidos a él (especialista_id).
    """
    if medico_id is not None and rol in ("medico_emergencia", "medico"):
        await _encolar_citas_hoy(db, medico_id)

    stmt = select(ColaAtencion)

    if clinica_id:
        stmt = stmt.where(ColaAtencion.clinica_id == clinica_id)

    if medico_id is not None:
        if rol == "medico":
            # Especialista: ve pacientes remitidos a él + pacientes con cita asignada
            from sqlalchemy import or_
            stmt = stmt.where(
                or_(
                    and_(
                        ColaAtencion.especialista_id == medico_id,
                        ColaAtencion.derivado_a_especialista == True,
                    ),
                    ColaAtencion.medico_id == medico_id,
                )
            )
        elif rol == "medico_emergencia":
            # Médico de emergencia: ve sus pacientes asignados
            # + pacientes de emergencia sin asignar en espera
            from sqlalchemy import or_
            stmt = stmt.where(
                or_(
                    ColaAtencion.medico_id == medico_id,
                    and_(
                        ColaAtencion.ruta_atencion == RutaAtencionEnum.EMERGENCIA,
                        ColaAtencion.medico_id.is_(None),
                        ColaAtencion.atencion_estado == EstadoAtencionEnum.EN_ESPERA_CONSULTA,
                    ),
                )
            )
        else:
            # Otro rol: ve solo sus pacientes asignados
            stmt = stmt.where(ColaAtencion.medico_id == medico_id)
    elif especialidad:
        stmt = stmt.where(ColaAtencion.especialidad == especialidad)

    stmt = stmt.order_by(ColaAtencion.prioridad.asc(), ColaAtencion.creado_en.asc())
    result = await db.execute(stmt)
    filas = list(result.scalars().all())

    historias = await _map_historias(db, filas)
    cat_map = await _map_categorias(
        db, {f.paciente_cedula for f in filas if f.paciente_cedula}
    )

    # Para pacientes finalizados sin consulta_id en cola, buscar la consulta más reciente
    sin_consulta = [f for f in filas if f.consulta_id is None and f.paciente_id is not None and f.medico_id is not None]
    if sin_consulta:
        mapa_consulta = {}
        for f in sin_consulta:
            r = await db.execute(
                text(
                    "SELECT id FROM consultas "
                    "WHERE paciente_id = :pid AND medico_id = :mid "
                    "ORDER BY created_at DESC LIMIT 1"
                ),
                {"pid": str(f.paciente_id), "mid": f.medico_id},
            )
            row = r.first()
            if row:
                mapa_consulta[(str(f.paciente_id), f.medico_id)] = row[0]
                f.consulta_id = row[0]

    def _f(estado: EstadoAtencionEnum):
        return [
            _a_item(f, historias.get(f.paciente_id), cat_map.get(f.paciente_cedula))
            for f in filas
            if f.atencion_estado == estado
        ]

    return ColaListaResponse(
        recepcion=_f(EstadoAtencionEnum.RECEPCION),
        triaje=_f(EstadoAtencionEnum.TRIAJE),
        espera=_f(EstadoAtencionEnum.EN_ESPERA_CONSULTA),
        consulta=_f(EstadoAtencionEnum.EN_CONSULTA),
        finalizado=_f(EstadoAtencionEnum.FINALIZADO),
    )


@router.patch(
    "/{cola_id}",
    response_model=ColaItemSchema,
    status_code=status.HTTP_200_OK,
    summary="Edita los datos del paciente en la cola de recepción",
)
async def editar_paciente_cola(
    cola_id: int,
    payload: EditarColaRequest,
    db: AsyncSession = Depends(get_db),
) -> ColaItemSchema:
    stmt = select(ColaAtencion).where(ColaAtencion.id == cola_id)
    registro = (await db.execute(stmt)).scalar_one_or_none()
    if not registro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró el registro de cola con ID #{cola_id}",
        )

    historia = None
    if registro.paciente_id:
        historia = (
            await db.execute(
                select(HistoriaClinica).where(
                    HistoriaClinica.id == registro.paciente_id
                )
            )
        ).scalar_one_or_none()

    if historia:
        if payload.nombre is not None:
            historia.nombre_completo = payload.nombre
        if payload.apellido is not None:
            historia.apellido = payload.apellido
        if payload.telefono is not None:
            historia.telefono = payload.telefono
        if payload.direccion is not None:
            historia.direccion = payload.direccion

    if payload.nombre is not None:
        registro.paciente_nombre = payload.nombre or registro.paciente_nombre
    if payload.cedula is not None:
        registro.paciente_cedula = payload.cedula or registro.paciente_cedula
    if payload.prioridad is not None:
        registro.prioridad = payload.prioridad

    if payload.consulta_id is not None:
        try:
            import uuid as _uuid
            registro.consulta_id = _uuid.UUID(payload.consulta_id)
        except (ValueError, AttributeError):
            pass

    try:
        await db.commit()
        await db.refresh(registro)
    except Exception as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al editar el paciente: {str(err)}",
        )

    if historia:
        await db.refresh(historia)
    return _a_item(
        registro,
        historia,
        (await _map_categorias(db, {registro.paciente_cedula})).get(registro.paciente_cedula),
    )


@router.delete(
    "/{cola_id}",
    status_code=status.HTTP_200_OK,
    summary="Elimina un paciente de la cola de recepción",
)
async def eliminar_paciente_cola(
    cola_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(ColaAtencion).where(ColaAtencion.id == cola_id)
    registro = (await db.execute(stmt)).scalar_one_or_none()
    if not registro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró el registro de cola con ID #{cola_id}",
        )

    await db.execute(
        delete(ColaAtencionHistorial).where(
            ColaAtencionHistorial.cola_id == cola_id
        )
    )
    await db.delete(registro)
    try:
        await db.commit()
    except Exception as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar el paciente: {str(err)}",
        )

    return {
        "id": cola_id,
        "eliminado": True,
        "mensaje": "Paciente eliminado de la cola de recepción.",
    }


@router.put(
    "/{cola_id}/consulta",
    status_code=status.HTTP_200_OK,
    summary="Vincula una consulta a un registro de cola",
)
async def vincular_consulta(
    cola_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Vincula el ID de una consulta a un registro de cola_atencion."""
    import uuid as _uuid
    consulta_id_str = payload.get("consulta_id")
    if not consulta_id_str:
        raise HTTPException(400, "consulta_id es requerido.")
    try:
        consulta_uuid = _uuid.UUID(consulta_id_str)
    except (ValueError, AttributeError):
        raise HTTPException(400, "consulta_id no es un UUID válido.")

    stmt = select(ColaAtencion).where(ColaAtencion.id == cola_id)
    registro = (await db.execute(stmt)).scalar_one_or_none()
    if not registro:
        raise HTTPException(404, f"No se encontró cola con ID #{cola_id}.")

    registro.consulta_id = consulta_uuid
    try:
        await db.commit()
        await db.refresh(registro)
    except Exception as err:
        await db.rollback()
        raise HTTPException(500, f"Error al vincular consulta: {err}")

    return {"status": "ok", "cola_id": cola_id, "consulta_id": str(consulta_uuid)}


@router.patch(
    "/{cola_id}/transicion",
    response_model=TransicionEstadoResponse,
    status_code=status.HTTP_200_OK,
    summary="Transiciona el estado de un paciente en la cola con SQLAlchemy Async",
)
async def transicionar_estado_paciente(
    cola_id: int,
    payload: TransicionEstadoRequest,
    db: AsyncSession = Depends(get_db),
) -> TransicionEstadoResponse:
    """
    Actualiza el estado de un paciente en la cola de atención mediante SQLAlchemy
    Async, validando las reglas del flujo de trabajo y registrando el historial
    en la misma transacción.
    """
    ahora_utc = datetime.now(timezone.utc)

    # Bloquear la fila para evitar concurrencia al transicionar
    stmt = select(ColaAtencion).where(ColaAtencion.id == cola_id).with_for_update()
    result = await db.execute(stmt)
    registro = result.scalar_one_or_none()

    if not registro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró el registro de cola con ID #{cola_id}",
        )

    estado_actual = registro.atencion_estado
    nuevo_estado = payload.nuevo_estado

    # Mismo estado: respuesta sin modificaciones.
    if estado_actual == nuevo_estado:
        return TransicionEstadoResponse(
            id=registro.id,
            paciente_cedula=registro.paciente_cedula,
            paciente_nombre=registro.paciente_nombre,
            estado_anterior=estado_actual.value,
            estado_nuevo=nuevo_estado.value,
            mensaje="El paciente ya se encuentra en el estado indicado.",
            actualizado_en=registro.creado_en or ahora_utc,
        )

    permitidos = TRANSICIONES_VALIDAS.get(estado_actual, [])
    if nuevo_estado not in permitidos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Transición no válida: no es posible pasar de "
                f"'{estado_actual.value}' a '{nuevo_estado.value}'."
            ),
        )

    # Actualizar timestamps de acuerdo al estado de destino.
    registro.atencion_estado = nuevo_estado
    if payload.derivado_a_especialista:
        registro.derivado_a_especialista = True
        if payload.especialidad_destino:
            registro.especialidad = payload.especialidad_destino
        if payload.especialista_id:
            registro.especialista_id = payload.especialista_id
    if nuevo_estado == EstadoAtencionEnum.TRIAJE:
        registro.fec_triaje = ahora_utc
    elif nuevo_estado == EstadoAtencionEnum.EN_ESPERA_CONSULTA:
        registro.fec_encolada = ahora_utc
        if payload.cambiado_por:
            registro.medico_id = payload.cambiado_por
    elif nuevo_estado == EstadoAtencionEnum.EN_CONSULTA:
        medico_check = payload.cambiado_por or registro.medico_id
        if not medico_check:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "No se puede iniciar la consulta sin asignar un médico. "
                    "Envía el campo 'cambiado_por' con el ID del médico."
                ),
            )
        duplicado = (
            await db.execute(
                select(ColaAtencion.id)
                .where(
                    ColaAtencion.medico_id == medico_check,
                    ColaAtencion.atencion_estado == EstadoAtencionEnum.EN_CONSULTA,
                    ColaAtencion.id != registro.id,
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if duplicado:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"El médico ya tiene un paciente en consulta activa "
                    f"(cola #{duplicado}). Finalice la consulta actual antes "
                    f"de atender otro paciente."
                ),
            )
        registro.iniciado_en = ahora_utc
        registro.medico_id = medico_check
    elif nuevo_estado in (
        EstadoAtencionEnum.FINALIZADO,
        EstadoAtencionEnum.CANCELADO,
        EstadoAtencionEnum.NO_ASISTIO,
    ):
        registro.fin_en = ahora_utc
        if nuevo_estado in (
            EstadoAtencionEnum.CANCELADO,
            EstadoAtencionEnum.NO_ASISTIO,
        ):
            registro.cancelado_en = ahora_utc

    # Auditoría en la misma transacción.
    historial = ColaAtencionHistorial(
        cola_id=registro.id,
        estado_anterior=estado_actual.value,
        estado_nuevo=nuevo_estado.value,
        cambiado_por=payload.cambiado_por,
        observacion=payload.observacion,
        creado_en=ahora_utc,
    )
    db.add(historial)

    try:
        await db.commit()
        await db.refresh(registro)
    except Exception as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar la transacción en la base de datos: {str(err)}",
        )

    return TransicionEstadoResponse(
        id=registro.id,
        paciente_cedula=registro.paciente_cedula,
        paciente_nombre=registro.paciente_nombre,
        estado_anterior=estado_actual.value,
        estado_nuevo=nuevo_estado.value,
        mensaje=f"Estado actualizado exitosamente a '{nuevo_estado.value}'.",
        actualizado_en=ahora_utc,
    )
