from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.cola import EstadoAtencionEnum


class CheckInRequest(BaseModel):
    """Registro del paciente en recepción de la cola de atención."""
    cedula: str = Field(..., description="Cédula del paciente", example="18234567")
    nombre: Optional[str] = Field(
        None, description="Obligatorio solo si la cédula no está registrada"
    )
    apellido: Optional[str] = Field(None, description="Apellido del paciente")
    telefono: Optional[str] = Field(None, description="Teléfono de contacto")
    direccion: Optional[str] = Field(None, description="Dirección de residencia")
    motivo: Optional[str] = Field(
        None, description="Motivo de la consulta / síntoma principal"
    )
    prioridad: int = Field(
        3, ge=1, le=5, description="Triaje inicial: 1 = crítico, 5 = leve"
    )
    clinica_id: Optional[int] = None
    ruta_atencion: Optional[str] = Field(
        None, description="CITA | EMERGENCIA"
    )
    especialidad: Optional[str] = None


class TransicionEstadoRequest(BaseModel):
    nuevo_estado: EstadoAtencionEnum = Field(
        ..., description="Nuevo estado del paciente en la cola"
    )
    cambiado_por: Optional[int] = Field(
        None, description="ID del personal (medico/enfermero) que realiza el cambio"
    )
    observacion: Optional[str] = Field(
        None, description="Nota o motivo de la transición"
    )
    derivado_a_especialista: Optional[bool] = Field(
        False, description="Marca que el paciente fue remitido a un especialista"
    )
    especialidad_destino: Optional[str] = Field(
        None, description="Especialidad a la que se remite al paciente"
    )
    especialista_id: Optional[int] = Field(
        None, description="ID del especialista al que se remite al paciente"
    )


class EditarColaRequest(BaseModel):
    """Edición de los datos del paciente registrado en la cola de recepción."""
    nombre: Optional[str] = Field(None, description="Nombre del paciente")
    apellido: Optional[str] = Field(None, description="Apellido del paciente")
    cedula: Optional[str] = Field(None, description="Nueva cédula del paciente")
    telefono: Optional[str] = Field(None, description="Teléfono de contacto")
    direccion: Optional[str] = Field(None, description="Dirección de residencia")
    prioridad: Optional[int] = Field(
        None, ge=1, le=5, description="Prioridad / categoría de triaje"
    )
    consulta_id: Optional[str] = Field(None, description="ID de la consulta asociada")


class TransicionEstadoResponse(BaseModel):
    id: int
    paciente_cedula: str
    paciente_nombre: str
    estado_anterior: str
    estado_nuevo: str
    mensaje: str
    actualizado_en: Optional[datetime] = None


class ColaItemSchema(BaseModel):
    id: int
    token: str
    paciente_id: Optional[UUID] = None
    paciente_cedula: str
    paciente_nombre: str
    apellido: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    clinica_id: Optional[int] = None
    atencion_estado: str = "RECEPCION"
    ruta_atencion: Optional[str] = None
    triaje_realizado: Optional[bool] = False
    categoria: Optional[str] = None
    prioridad: int = 3
    sintomas_principales: Optional[str] = None
    motivo_consulta: Optional[str] = None
    especialidad: Optional[str] = None
    medico_id: Optional[int] = None
    cita_id: Optional[UUID] = None
    consulta_id: Optional[UUID] = None
    creado_en: Optional[datetime] = None
    fec_triaje: Optional[datetime] = None
    fec_encolada: Optional[datetime] = None
    iniciado_en: Optional[datetime] = None
    fin_en: Optional[datetime] = None
    cancelado_en: Optional[datetime] = None


class ColaListaResponse(BaseModel):
    recepcion: List[ColaItemSchema]
    triaje: List[ColaItemSchema]
    espera: List[ColaItemSchema]
    consulta: List[ColaItemSchema]
    finalizado: List[ColaItemSchema]
