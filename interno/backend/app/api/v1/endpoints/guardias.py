"""Guardias: gestion de turnos de guardia para medicos de emergencia.

Permite a recepcion iniciar, cambiar y finalizar guardias,
y consultar los medicos activos en guardia.
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.guardia import Guardia
from app.models.turno import Turno  # noqa: F401 - ensure turnos table is in metadata
from app.models.usuario import Personal
from app.schemas.guardia import (
    CambiarGuardiaRequest,
    CambiarGuardiaResponse,
    GuardiaResponse,
    IniciarGuardiaRequest,
)

router = APIRouter()


async def _obtener_medico_emergencia(db: AsyncSession, medico_id: int) -> Personal:
    """Obtiene un medico de emergencia por ID y valida que exista y sea de emergencia."""
    result = await db.execute(
        select(Personal).where(Personal.id == medico_id)
    )
    medico = result.scalar_one_or_none()
    if not medico:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontro el medico con ID #{medico_id}",
        )
    # Validar que sea medico de emergencia (rol medico_emergencia en usuarios)
    check = await db.execute(
        text("SELECT 1 FROM usuarios WHERE personal_id = :pid AND rol = 'medico_emergencia'"),
        {"pid": medico_id},
    )
    if not check.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El medico #{medico_id} no es medico de emergencia. Solo los medicos de emergencia pueden estar en guardia.",
        )
    return medico


async def _guardia_activa_medico(
    db: AsyncSession, medico_id: int, fecha
) -> Optional[Guardia]:
    """Verifica si un medico ya tiene guardia activa en la fecha."""
    result = await db.execute(
        select(Guardia).where(
            and_(
                Guardia.medico_id == medico_id,
                Guardia.fecha == fecha,
                Guardia.estado == "ACTIVA",
            )
        )
    )
    return result.scalar_one_or_none()


def _a_response(guardia: Guardia, medico=None, turno_nombre=None) -> GuardiaResponse:
    """Convierte una guardia a GuardiaResponse."""
    return GuardiaResponse(
        id=guardia.id,
        medico_id=guardia.medico_id,
        medico_nombre=(
            f"{medico.nombre} {medico.apellido or ''}".strip()
            if medico
            else None
        ),
        especialidad=medico.especialidad if medico else None,
        clinica_id=guardia.clinica_id,
        turno_id=guardia.turno_id,
        turno_nombre=turno_nombre,
        fecha=guardia.fecha,
        hora_inicio=guardia.hora_inicio,
        hora_fin=guardia.hora_fin,
        estado=guardia.estado,
        observaciones=guardia.observaciones,
    )


@router.post(
    "/iniciar",
    response_model=GuardiaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Inicia la guardia de un medico",
)
async def iniciar_guardia(
    payload: IniciarGuardiaRequest,
    db: AsyncSession = Depends(get_db),
) -> GuardiaResponse:
    """Recepcion inicia la guardia de un medico de emergencia."""
    medico = await _obtener_medico_emergencia(db, payload.medico_id)

    # Verificar que no tenga guardia activa ya en esta fecha
    existente = await _guardia_activa_medico(db, payload.medico_id, payload.fecha)
    if existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"El medico ya tiene una guardia activa en esta fecha "
                f"(guardia #{existente.id}). Finalice o cambie la guardia primero."
            ),
        )

    guardia = Guardia(
        medico_id=payload.medico_id,
        clinica_id=payload.clinica_id,
        turno_id=payload.turno_id,
        fecha=payload.fecha,
        hora_inicio=datetime.now(timezone.utc),
        estado="ACTIVA",
        observaciones=payload.observaciones,
    )
    db.add(guardia)

    try:
        await db.commit()
        await db.refresh(guardia)
    except Exception as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al iniciar guardia: {str(err)}",
        )

    return _a_response(guardia, medico)


@router.post(
    "/cambiar",
    response_model=CambiarGuardiaResponse,
    status_code=status.HTTP_200_OK,
    summary="Cambia la guardia de un medico a otro",
)
async def cambiar_guardia(
    payload: CambiarGuardiaRequest,
    db: AsyncSession = Depends(get_db),
) -> CambiarGuardiaResponse:
    """Handover: medico saliente deja la guardia, medico nuevo asume."""
    # Obtener la guardia saliente
    result = await db.execute(
        select(Guardia).where(Guardia.id == payload.guardia_saliente_id)
    )
    guardia_saliente = result.scalar_one_or_none()
    if not guardia_saliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontro la guardia con ID #{payload.guardia_saliente_id}",
        )
    if guardia_saliente.estado != "ACTIVA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se puede cambiar una guardia que este en estado ACTIVA.",
        )

    # Obtener medico entrante
    medico_entrante = await _obtener_medico_emergencia(db, payload.medico_entrante_id)

    # Verificar que el entrante no tenga guardia activa
    existente = await _guardia_activa_medico(
        db, payload.medico_entrante_id, guardia_saliente.fecha
    )
    if existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"El medico entrante ya tiene una guardia activa "
                f"(guardia #{existente.id})."
            ),
        )

    ahora = datetime.now(timezone.utc)

    # Finalizar guardia saliente
    guardia_saliente.estado = "REEMPLAZADA"
    guardia_saliente.hora_fin = ahora
    guardia_saliente.observaciones = (
        (guardia_saliente.observaciones or "")
        + f" | Cambio de guardia a medico #{payload.medico_entrante_id}"
    )

    # Crear nueva guardia para el entrante
    guardia_entrante = Guardia(
        medico_id=payload.medico_entrante_id,
        clinica_id=guardia_saliente.clinica_id,
        turno_id=payload.turno_id,
        fecha=guardia_saliente.fecha,
        hora_inicio=ahora,
        estado="ACTIVA",
        registrado_por=guardia_saliente.registrado_por,
        observaciones=payload.observaciones,
    )
    db.add(guardia_entrante)

    try:
        await db.commit()
        await db.refresh(guardia_saliente)
        await db.refresh(guardia_entrante)
    except Exception as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cambiar guardia: {str(err)}",
        )

    # Obtener datos para response
    result_sal = await db.execute(
        select(Personal).where(Personal.id == guardia_saliente.medico_id)
    )
    medico_saliente = result_sal.scalar_one_or_none()

    return CambiarGuardiaResponse(
        guardia_saliente=_a_response(guardia_saliente, medico_saliente),
        guardia_entrante=_a_response(guardia_entrante, medico_entrante),
        mensaje="Guardia cambiada exitosamente.",
    )


@router.patch(
    "/{guardia_id}/finalizar",
    response_model=GuardiaResponse,
    status_code=status.HTTP_200_OK,
    summary="Finaliza una guardia activa",
)
async def finalizar_guardia(
    guardia_id: int,
    db: AsyncSession = Depends(get_db),
) -> GuardiaResponse:
    """Finaliza una guardia activa."""
    result = await db.execute(
        select(Guardia).where(Guardia.id == guardia_id)
    )
    guardia = result.scalar_one_or_none()
    if not guardia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontro la guardia con ID #{guardia_id}",
        )
    if guardia.estado != "ACTIVA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden finalizar guardias en estado ACTIVA.",
        )

    guardia.estado = "FINALIZADA"
    guardia.hora_fin = datetime.now(timezone.utc)

    try:
        await db.commit()
        await db.refresh(guardia)
    except Exception as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al finalizar guardia: {str(err)}",
        )

    result_med = await db.execute(
        select(Personal).where(Personal.id == guardia.medico_id)
    )
    medico = result_med.scalar_one_or_none()

    return _a_response(guardia, medico)


@router.get(
    "/activas",
    response_model=List[GuardiaResponse],
    summary="Lista medicos en guardia activa",
)
async def listar_guardias_activas(
    clinica_id: Optional[int] = Query(None, description="Filtrar por clinica"),
    db: AsyncSession = Depends(get_db),
) -> List[GuardiaResponse]:
    """Retorna los medicos de emergencia con guardia activa, opcionalmente filtrados por clinica."""
    stmt = select(Guardia).where(Guardia.estado == "ACTIVA")
    if clinica_id is not None:
        stmt = stmt.where(Guardia.clinica_id == clinica_id)
    stmt = stmt.order_by(Guardia.hora_inicio.asc())

    result = await db.execute(stmt)
    guardias = result.scalars().all()

    respuestas = []
    for g in guardias:
        result_med = await db.execute(
            select(Personal).where(Personal.id == g.medico_id)
        )
        medico = result_med.scalar_one_or_none()
        respuestas.append(_a_response(g, medico))

    return respuestas
