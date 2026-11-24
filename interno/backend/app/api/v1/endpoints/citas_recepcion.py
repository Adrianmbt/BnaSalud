"""Endpoints de Recepción para agendar citas presenciales o telefónicas."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services import citas_recepcion as svc

router = APIRouter(tags=["Citas de recepción"])


class PacienteNuevo(BaseModel):
    cedula: str = Field(..., description="Cédula sin puntos ni guiones")
    nombre_completo: str
    apellido: Optional[str] = None
    telefono: Optional[str] = None
    comuna: Optional[str] = None
    fecha_nacimiento: Optional[str] = Field(None, description="YYYY-MM-DD")


class CitaRecepcionRequest(BaseModel):
    paciente_id: Optional[str] = Field(
        None, description="Historia clínica existente. Si falta, se usa `paciente`."
    )
    paciente: Optional[PacienteNuevo] = Field(
        None, description="Alta rápida del paciente nuevo dentro del mismo flujo."
    )
    medico_id: int
    fecha: str = Field(..., description="YYYY-MM-DD")
    turno_id: Optional[int] = None
    hora_inicio: Optional[str] = Field(None, description="HH:MM dentro del turno")
    motivo: Optional[str] = None
    centro_id: Optional[int] = None


@router.get("/pacientes")
async def buscar_pacientes(
    q: str = Query(..., min_length=2, description="Cédula o nombre"),
    db: AsyncSession = Depends(get_db),
):
    """Buscador rápido de pacientes para el alta de la cita."""
    return {"items": await svc.buscar_pacientes(db, q)}


@router.get("/disponibilidad")
async def disponibilidad(
    medico_id: int = Query(...),
    fecha: str = Query(..., description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
):
    """Cupos disponibles vs. ocupados del médico en una fecha."""
    try:
        return await svc.disponibilidad_dia(db, medico_id, fecha)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))


@router.post("/citas", status_code=status.HTTP_201_CREATED)
async def crear_cita(payload: CitaRecepcionRequest, db: AsyncSession = Depends(get_db)):
    """Registra la cita en local (estado `confirmada`) y la encola para el portal."""
    try:
        return await svc.crear_cita(
            db,
            medico_id=payload.medico_id,
            fecha=payload.fecha,
            paciente_id=payload.paciente_id,
            paciente=payload.paciente.model_dump() if payload.paciente else None,
            hora_inicio=payload.hora_inicio,
            turno_id=payload.turno_id,
            motivo=payload.motivo,
            centro_id=payload.centro_id,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))


@router.get("/sync/estado")
async def estado_sync(db: AsyncSession = Depends(get_db)):
    """Estado de la cola de sincronización de citas hacia el portal."""
    return await svc.estado_sync(db)


@router.post("/sync")
async def sincronizar(db: AsyncSession = Depends(get_db)):
    """Fuerza el envío de la cola pendiente (útil al volver la conexión)."""
    enviados, fallidos = await svc.empujar_pendientes(db)
    estado = await svc.estado_sync(db)
    return {"enviados": enviados, "fallidos": fallidos, **estado}
