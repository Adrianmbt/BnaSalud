"""Schemas Pydantic para WhatsApp."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class Destinatario(BaseModel):
    """Destinatario individual en envío masivo."""
    telefono: str = Field(..., min_length=10, max_length=20)
    cedula: Optional[str] = None
    nombre: Optional[str] = None


class EnviarMensajeRequest(BaseModel):
    """Request para enviar un mensaje individual."""
    telefono: str = Field(..., min_length=10, max_length=20, description="Número con código de país")
    mensaje: str = Field(..., min_length=1, max_length=4096, description="Texto del mensaje")
    cedula: Optional[str] = Field(None, description="Cédula del destinatario (para registro)")


class EnviarMasivoRequest(BaseModel):
    """Request para envío masivo de mensajes."""
    mensaje: str = Field(..., min_length=1, max_length=4096, description="Texto del mensaje")
    destinatarios: list[Destinatario] = Field(..., min_length=1, max_length=500, description="Lista de destinatarios")


class MensajeWhastappResponse(BaseModel):
    """Response de un mensaje enviado."""
    id: UUID
    destinatario_cedula: Optional[str]
    destinatario_nombre: Optional[str]
    destinatario_telefono: Optional[str]
    mensaje: str
    estado: str
    evolution_message_id: Optional[str]
    error_detalle: Optional[str]
    enviado_en: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class EstadoConexionResponse(BaseModel):
    """Response del estado de conexión WhatsApp."""
    conectado: bool
    estado: Optional[str] = None
    instancia: str
    detalles: Optional[dict] = None


class EnvioMasivoResponse(BaseModel):
    """Response del envío masivo."""
    total: int
    enviados: int
    fallidos: int
    mensajes: list[MensajeWhastappResponse]
