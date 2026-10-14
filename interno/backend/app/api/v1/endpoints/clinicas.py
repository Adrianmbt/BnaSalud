"""Endpoints para listar centros de salud (clínicas)."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.clinica import Clinica

router = APIRouter()


@router.get(
    "",
    summary="Lista las clínicas activas disponibles",
)
async def listar_clinicas(db: AsyncSession = Depends(get_db)):
    stmt = select(Clinica).where(Clinica.activo == True).order_by(Clinica.nombre)
    result = await db.execute(stmt)
    clinicas = result.scalars().all()
    return [
        {
            "id": c.id,
            "nombre": c.nombre,
            "codigo": c.codigo,
            "parroquia": c.parroquia,
            "direccion": c.direccion,
        }
        for c in clinicas
    ]
