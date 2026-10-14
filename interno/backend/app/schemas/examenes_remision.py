"""Schemas para la remisión de exámenes a centros de salud adscritos."""
from typing import List, Optional

from pydantic import BaseModel, Field


class CentroAdscritoItem(BaseModel):
    id: int
    nombre: str
    codigo: str = ""
    parroquia: str = ""
    direccion: str = ""


class ExamenOfrecidoItem(BaseModel):
    id: int
    examen: str
    centro_id: int
    centro: str
    horario_atencion: dict = {}
    horario_texto: str = ""
    cupo_diario: int = 0


class TurnoLibreExamen(BaseModel):
    hora_inicio: str
    hora_fin: str


class DiaDisponibilidadExamen(BaseModel):
    fecha: str
    cupo_restante: int = 0
    disponible: bool = False
    motivo: str = ""
    turnos_libres: List[TurnoLibreExamen] = []


class ElegibilidadResponse(BaseModel):
    elegible: bool = False
    tipo: str = "publico"  # trabajador | beneficiario | publico


class CitaExamenCrearRequest(BaseModel):
    examen_ofrecido_id: int = Field(..., description="id en examenes_ofrecidos")
    paciente_id: str = Field(..., description="uuid de historias_clinicas")
    fecha: str = Field(..., description="YYYY-MM-DD")
    hora_inicio: str = Field(..., description="HH:MM, inicio de una ventana del día")
    motivo: Optional[str] = None


class CitaExamenResponse(BaseModel):
    cita_id: str
    codigo_confirmacion: str
    examen_ofrecido_id: int
    examen: str
    centro: str
    fecha_cita: str
    hora_inicio: str
    estado: str