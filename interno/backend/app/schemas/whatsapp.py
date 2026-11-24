"""Schemas Pydantic para WhatsApp."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


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


class ConfiguracionWhatsappRead(BaseModel):
    """Lectura de configuración de WhatsApp."""
    id: int
    clinica_id: int
    instance_name: str
    api_url: str
    telefono_origen: str
    activo: bool
    creado_por: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class ConfiguracionWhatsappCreate(BaseModel):
    """Creación de configuración de WhatsApp."""
    clinica_id: int = Field(..., description="ID de la clínica (centro)")
    instance_name: str = Field(..., min_length=3, max_length=100, description="Nombre de la instancia en Evolution API")
    api_url: str = Field(default="http://localhost:8080", description="URL del Evolution API")
    api_key: str = Field(..., min_length=10, description="API Key de Evolution API")
    telefono_origen: str = Field(..., min_length=10, max_length=20, description="Número de WhatsApp de la clínica")


class ConfiguracionWhatsappUpdate(BaseModel):
    """Actualización de configuración de WhatsApp."""
    instance_name: Optional[str] = Field(None, min_length=3, max_length=100)
    api_url: Optional[str] = "http://localhost:8080"
    api_key: Optional[str] = Field(None, min_length=10)
    telefono_origen: Optional[str] = Field(None, min_length=10, max_length=20)
    activo: Optional[bool] = None


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


class QrCodeResponse(BaseModel):
    """Response del código QR o pairing code para conectar WhatsApp."""
    qr: Optional[str] = None
    pairing_code: Optional[str] = None
    instancia: str
    error: Optional[str] = None
