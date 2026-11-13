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
    turno_nombre: str = ""
    hora_inicio: str
    hora_fin: str


class JornadaDisponible(BaseModel):
    """Turno completo (Mañana, Tarde, ...) con sus cupos libres.

    La solicitud de cita se elige por turno; el paciente se ancla al turno
    (rango hora_inicio - hora_fin), no a una hora específica.
    """

    turno_id: int
    nombre: str = ""
    hora_inicio: str
    hora_fin: str
    capacidad: int = 0
    cupos_libres: int = 0
    disponible: bool = False


class JornadasDia(BaseModel):
    fecha: str
    disponible: bool = False
    motivo: str = ""
    turnos: List[JornadaDisponible] = []


class DiaDisponibilidad(BaseModel):
    fecha: str
    disponible: bool
    motivo: str = ""
    turnos_libres: List[TurnoLibre] = []
    cupos_libres: int = 0


class DisponibilidadResponse(BaseModel):
    medico_id: int
    nivel: str
    fecha_desde: str
    fecha_hasta: str
    dias: List[DiaDisponibilidad]


class CitaCrearRequest(BaseModel):
    paciente_id: Optional[str] = None
    cita_id: Optional[str] = Field(
        None,
        description=(
            "Si viene, la cita existente se actualiza (solicitud del portal "
            "que recepción confirma) en lugar de crear una nueva."
        ),
    )
    medico_id: int = Field(..., description="ID del especialista en personal")
    especialidad: str = ""
    fecha: str = Field(..., description="Fecha de la cita (YYYY-MM-DD)")
    hora_inicio: Optional[str] = Field(
        None,
        description="Hora de la cita (HH:MM). Si se indica turno_id, se valida que esté dentro del rango del turno.",
    )
    turno_id: Optional[int] = Field(
        None,
        description="ID del turno (rango hora_inicio - hora_fin) al que se asigna la cita.",
    )
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
    paciente_nombre: Optional[str] = None
    paciente_telefono: Optional[str] = None
    medico_nombre: Optional[str] = None
    centro_salud: Optional[str] = None
    whatsapp_url: Optional[str] = None
    whatsapp_mensaje: Optional[str] = None


class ReprogramarTodasRequest(BaseModel):
    """Mueve todas las citas restantes del día de un especialista a una nueva fecha/hora."""
    medico_id: int = Field(..., description="ID del especialista en personal")
    fecha: str = Field(..., description="Nueva fecha de las citas (YYYY-MM-DD)")
    hora_inicio: str = Field(..., description="Nueva hora de las citas (HH:MM)")


class CupoDiaSemana(BaseModel):
    """Un día de la semana con sus cupos libres totales."""

    dia_semana: int  # 0=Lunes ... 6=Domingo
    nombre: str
    fecha: str  # primera fecha de la semana para ese día
    turnos: List[JornadaDisponible] = []
    cupos_libres: int = 0


class CupoSemanalResponse(BaseModel):
    """Cupos disponibles por día de la semana para un médico.

    Calculado desde agenda_medicos (turnos configurados) menos citas
    ya registradas (no canceladas). No hay un número hardcodeado de 20;
    depende del horario real del médico.
    """

    medico_id: int
    medico_nombre: str
    especialidad: str
    semana_desde: str  # lunes de la semana
    semana_hasta: str  # domingo de la semana
    dias: List[CupoDiaSemana] = []
    cupos_libres_totales: int = 0


class ReprogramarTodasResponse(BaseModel):
    movidas: int
    canceladas: int
    fecha: str
    hora_inicio: str
