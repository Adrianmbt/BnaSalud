"""Endpoints para búsqueda de empleados y beneficiarios por cédula."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.empleado import Empleado
from app.models.beneficiario import Beneficiario  # type: ignore
from app.schemas.historias_clinicas import HistoriaClinicaCreate

router = APIRouter(tags=["Búsqueda"])


@router.get(
    "/empleados",
    summary="Buscar empleado por cédula",
)
async def buscar_empleado(
    cedula: str,
    db: AsyncSession = Depends(get_db),
) -> Optional[dict]:
    """Buscar un empleado por su cédula. Retorna sus datos si existe."""
    stmt = select(Empleado).where(Empleado.cedula == cedula)
    result = await db.execute(stmt)
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró ningún empleado con cédula '{cedula}'.",
        )
    return {
        "id": str(emp.id),
        "cedula": emp.cedula,
        "nombre_completo": emp.nombre_completo,
        "edad": emp.edad,
        "cargo": emp.cargo,
        "activo": emp.activo,
        "created_at": str(emp.created_at),
    }


@router.get(
    "/beneficiarios",
    summary="Buscar beneficiario por cédula",
)
async def buscar_beneficiario(
    cedula: str,
    db: AsyncSession = Depends(get_db),
) -> Optional[dict]:
    """Buscar un beneficiario por su cédula. Retorna sus datos si existe."""
    stmt = select(Beneficiario).where(Beneficiario.cedula == cedula)
    result = await db.execute(stmt)
    ben = result.scalar_one_or_none()
    if not ben:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró ningún beneficiario con cédula '{cedula}'.",
        )
    # Obtener nombre del trabajador asociado
    emp_nombre = None
    if ben.empleado_id:
        emp_stmt = select(Empleado).where(Empleado.id == ben.empleado_id)
        emp_result = await db.execute(emp_stmt)
        emp = emp_result.scalar_one_or_none()
        if emp:
            emp_nombre = emp.nombre_completo

    return {
        "id": str(ben.id),
        "cedula": ben.cedula,
        "nombre_completo": ben.nombre_completo,
        "parentesco": ben.parentesco,
        "empleado_id": str(ben.empleado_id) if ben.empleado_id else None,
        "empleado_nombre": emp_nombre,
        "activo": ben.activo,
        "created_at": str(ben.created_at),
    }