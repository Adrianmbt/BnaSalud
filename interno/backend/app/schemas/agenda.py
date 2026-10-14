"""Schemas para el módulo de agenda de remisión (especialistas y citas)."""
from typing import List, Optional

from pydantic import BaseModel, Field


class EspecialistaItem(BaseModel):
    id: int
    nombre: str
    especialidad: str = ""
    emergencia: bool = False


class TurnoLibre(BaseModel):
    turno_id: int
    hora_inicio: str
    hora_fin: str


class DiaDisponibilidad(BaseModel):
    fecha: str
    disponible: bool
    motivo: str = ""
    turnos_libres: List[TurnoLibre] = []


class DisponibilidadResponse(BaseModel):
    medico_id: int
    nivel: str
    fecha_desde: str
    fecha_hasta: str
    dias: List[DiaDisponibilidad]


class CitaCrearRequest(BaseModel):
    paciente_id: Optional[str] = None
    medico_id: int = Field(..., description="ID del especialista en personal")
    especialidad: str = ""
    fecha: str = Field(..., description="Fecha de la cita (YYYY-MM-DD)")
    hora_inicio: str = Field(..., description="Hora de la cita (HH:MM)")
    nivel: str = Field(..., description="Nivel de prioridad: azul | verde | amarillo")
    origen: Optional[str] = "remision"
    motivo: Optional[str] = None


class CitaCreadaResponse(BaseModel):
    cita_id: str
    codigo_confirmacion: str
    especialidad: str
    medico_id: int
    fecha_cita: str
    hora_inicio: str
    estado: str


class ReprogramarTodasRequest(BaseModel):
    """Mueve todas las citas restantes del día de un especialista a una nueva fecha/hora."""
    medico_id: int = Field(..., description="ID del especialista en personal")
    fecha: str = Field(..., description="Nueva fecha de las citas (YYYY-MM-DD)")
    hora_inicio: str = Field(..., description="Nueva hora de las citas (HH:MM)")


class ReprogramarTodasResponse(BaseModel):
    movidas: int
    canceladas: int
    fecha: str
    hora_inicio: str
