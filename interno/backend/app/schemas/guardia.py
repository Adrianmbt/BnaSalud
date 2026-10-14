"""Schemas Pydantic para el modulo de guardias."""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class IniciarGuardiaRequest(BaseModel):
    """Request para iniciar una guardia."""
    medico_id: int = Field(..., description="ID del medico que inicia guardia")
    clinica_id: Optional[int] = Field(None, description="ID de la clinica (opcional)")
    turno_id: int = Field(..., description="ID del turno ( FK a turnos)")
    fecha: date = Field(..., description="Fecha de la guardia")
    observaciones: Optional[str] = Field(None, description="Observaciones opcionales")


class CambiarGuardiaRequest(BaseModel):
    """Request para cambiar de guardia (handover)."""
    guardia_saliente_id: int = Field(..., description="ID de la guardia activa del medico saliente")
    medico_entrante_id: int = Field(..., description="ID del medico que asume la guardia")
    turno_id: int = Field(..., description="ID del turno")
    observaciones: Optional[str] = Field(None, description="Motivo del cambio")


class GuardiaResponse(BaseModel):
    """Response de una guardia."""
    id: int
    medico_id: int
    medico_nombre: Optional[str] = None
    especialidad: Optional[str] = None
    clinica_id: Optional[int] = None
    turno_id: int
    turno_nombre: Optional[str] = None
    fecha: date
    hora_inicio: Optional[datetime] = None
    hora_fin: Optional[datetime] = None
    estado: str
    observaciones: Optional[str] = None


class CambiarGuardiaResponse(BaseModel):
    """Response del cambio de guardia."""
    guardia_saliente: GuardiaResponse
    guardia_entrante: GuardiaResponse
    mensaje: str
