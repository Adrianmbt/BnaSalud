"""Endpoints para gestión de historias clínicas y operaciones de recepción."""
import json
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.cola import ColaAtencion
from app.models.historias_clinicas import HistoriaClinica  # type: ignore
from app.schemas.historias_clinicas import (
    HistoriaClinicaCreate,
    HistoriaClinicaResponse,
)


router = APIRouter(tags=["Historias Clínicas"])


def _ser_historia(h: "HistoriaClinica") -> dict:
    """Serializa un registro de historia clínica al esquema de respuesta."""
    return {
        "id": str(h.id),
        "cedula": h.cedula,
        "nombre_completo": h.nombre_completo,
        "apellido": h.apellido,
        "telefono": h.telefono,
        "direccion": h.direccion,
        "tipo_sangre": h.tipo_sangre,
        "antecedentes_medicos": h.antecedentes_medicos or [],
        "antecedentes_operatorios": h.antecedentes_operatorios or [],
        "alergias": h.alergias or [],
        "numero_historia": h.numero_historia or "",
        "created_at": str(h.created_at),
    }


@router.get(
    "/{cedula}",
    response_model=HistoriaClinicaResponse,
    summary="Obtener historia clínica por cédula",
)
async def obtener_historia_por_cedula(
    cedula: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Busca la historia clínica del paciente por su cédula."""
    stmt = select(HistoriaClinica).where(HistoriaClinica.cedula == cedula)
    result = await db.execute(stmt)
    historia = result.scalar_one_or_none()
    if not historia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró historia clínica para la cédula '{cedula}'.",
        )
    return _ser_historia(historia)


@router.post(
    "",
    response_model=HistoriaClinicaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear o actualizar historia clínica",
)
async def crear_actualizar_historia_clinica(
    payload: HistoriaClinicaCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Alta o actualización de historia clínica del paciente."""
    # Buscar si ya existe una historia con esta cédula
    stmt = select(HistoriaClinica).where(HistoriaClinica.cedula == payload.cedula)
    result = await db.execute(stmt)
    existente = result.scalar_one_or_none()

    if existente:
        # Actualizar existente
        existente.nombre_completo = payload.nombre_completo
        existente.telefono = payload.telefono
        existente.direccion = payload.direccion
        existente.tipo_sangre = payload.tipo_sangre
        existente.antecedentes_medicos = payload.antecedentes_medicos or []
        existente.antecedentes_operatorios = payload.antecedentes_operatorios or []
        existente.alergias = payload.alergias or []
        await db.commit()
        await db.refresh(existente)
        return _ser_historia(existente)
    else:
        # Crear nueva
        from sqlalchemy import UUID
        from datetime import datetime, timezone

        nuevo = HistoriaClinica(
            id=uuid.uuid4(),
            cedula=payload.cedula,
            nombre_completo=payload.nombre_completo,
            telefono=payload.telefono,
            direccion=payload.direccion,
            tipo_sangre=payload.tipo_sangre,
            antecedentes_medicos=payload.antecedentes_medicos or [],
            antecedentes_operatorios=payload.antecedentes_operatorios or [],
            alergias=payload.alergias or [],
            created_at=datetime.now(timezone.utc),
        )
        db.add(nuevo)
        await db.commit()
        await db.refresh(nuevo)
        return _ser_historia(nuevo)