"""Endpoints de personal: listado de medicos y otro personal."""
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.usuario import Personal

router = APIRouter(tags=["Personal"])


class PersonalItem(BaseModel):
    id: int
    nombre: str
    apellido: Optional[str] = None
    cargo: Optional[str] = None
    especialidad: Optional[str] = None
    clinica_id: Optional[int] = None


class PersonalResponse(BaseModel):
    id: int
    nombre: str
    apellido: Optional[str] = None
    especialidad: Optional[str] = None
    cargo: Optional[str] = None
    clinica_id: Optional[int] = None


@router.get("", response_model=List[PersonalResponse])
async def listar_personal(
    cargo: Optional[str] = Query(None, description="Filtrar por cargo (ej: Medico)"),
    clinica_id: Optional[int] = Query(None, description="Filtrar por clinica"),
    rol: Optional[str] = Query(None, description="Filtrar por rol de usuario (ej: medico_emergencia)"),
    db: AsyncSession = Depends(get_db),
):
    """Lista el personal, opcionalmente filtrado por cargo, clinica y/o rol."""
    if rol:
        # Filter by rol through usuarios table join
        result = await db.execute(
            text(
                "SELECT DISTINCT p.id, p.nombre, p.apellido, p.especialidad, p.cargo, p.clinica_id "
                "FROM personal p "
                "INNER JOIN usuarios u ON u.personal_id = p.id "
                "WHERE u.rol = :rol "
                + (" AND p.cargo ILIKE CONCAT('%', :cargo, '%')" if cargo else "") +
                (" AND p.clinica_id = :clinica_id" if clinica_id else "") +
                " ORDER BY p.apellido, p.nombre"
            ),
            {k: v for k, v in {"rol": rol, "cargo": cargo, "clinica_id": clinica_id}.items() if v is not None},
        )
        rows = result.mappings().all()
        return [
            PersonalResponse(
                id=r["id"],
                nombre=r["nombre"],
                apellido=r["apellido"],
                especialidad=r["especialidad"],
                cargo=r["cargo"],
                clinica_id=r["clinica_id"],
            )
            for r in rows
        ]
    else:
        stmt = select(Personal)
        if cargo:
            stmt = stmt.where(Personal.cargo.ilike(f"%{cargo}%"))
        if clinica_id:
            stmt = stmt.where(Personal.clinica_id == clinica_id)
        stmt = stmt.order_by(Personal.apellido, Personal.nombre)
        result = await db.execute(stmt)
        rows = result.scalars().all()
        return [
            PersonalResponse(
                id=r.id,
                nombre=r.nombre,
                apellido=r.apellido,
                especialidad=r.especialidad,
                cargo=r.cargo,
                clinica_id=r.clinica_id,
            )
            for r in rows
        ]
