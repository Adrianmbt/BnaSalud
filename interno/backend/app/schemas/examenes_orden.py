"""Schemas Pydantic: Catálogo de exámenes y Órdenes médicas."""
from typing import Optional, List
from pydantic import BaseModel, Field


# ─── Catálogo ───

class CatalogoExamenItem(BaseModel):
    """Ítem del catálogo de exámenes."""
    id: str
    categoria: str
    grupo: str
    nombre_estudio: str
    requiere_ayuno: bool = False
    activo: bool = True

    class Config:
        from_attributes = True


class CatalogoExamenGrupo(BaseModel):
    """Grupo de exámenes dentro de una categoría."""
    grupo: str
    estudios: List[CatalogoExamenItem]


class CatalogoExamenCategoria(BaseModel):
    """Categoría completa con sus grupos."""
    categoria: str
    grupos: List[CatalogoExamenGrupo]


class CatalogoResponse(BaseModel):
    """Respuesta completa del catálogo estructurado."""
    categorias: List[CatalogoExamenCategoria]


# ─── Órdenes ───

class OrdenExamenItemCreate(BaseModel):
    """Item de examen dentro de una orden."""
    nombre_examen: str = Field(..., description="Nombre del examen")
    categoria: str = Field(..., description="Categoría: laboratorio|imagen|funcional|anatomia_patologica")
    grupo: str = Field(..., description="Grupo al que pertenece")


class OrdenCrearRequest(BaseModel):
    """Payload para crear una orden de exámenes."""
    paciente_id: str = Field(..., description="UUID del paciente (historia clínica)")
    origen_atencion: str = Field(
        ...,
        description="Origen: recepcion|emergencia|consulta_especialidad",
        pattern="^(recepcion|emergencia|consulta_especialidad)$",
    )
    observaciones: Optional[str] = Field(None, description="Observaciones generales de la orden")
    examenes: List[OrdenExamenItemCreate] = Field(
        ..., min_length=1, description="Lista de exámenes solicitados"
    )


class OrdenExamenItemResponse(BaseModel):
    """Respuesta de un item de examen."""
    id: str
    orden_id: str
    examen_id: Optional[str] = None
    nombre_examen: str
    categoria: str
    grupo: str
    resultado: Optional[str] = None
    estado_item: str = "pendiente"
    created_at: str

    class Config:
        from_attributes = True


class OrdenResponse(BaseModel):
    """Respuesta de una orden médica completa."""
    id: str
    paciente_id: str
    medico_id: str
    origen_atencion: str
    estado: str = "pendiente"
    observaciones: Optional[str] = None
    created_at: str
    updated_at: str
    items: List[OrdenExamenItemResponse] = []

    class Config:
        from_attributes = True


class OrdenItemListResponse(BaseModel):
    """Lista de órdenes de un paciente."""
    ordenes: List[OrdenResponse]


class ItemActualizarRequest(BaseModel):
    """Payload para actualizar un item de examen."""
    resultado: Optional[str] = Field(None, description="Resultado del examen")
    estado_item: Optional[str] = Field(
        None,
        description="Nuevo estado: pendiente|en_proceso|completado|cancelado",
        pattern="^(pendiente|en_proceso|completado|cancelado)$",
    )


class ItemActualizarResponse(BaseModel):
    """Respuesta al actualizar un item."""
    id: str
    nombre_examen: str
    resultado: Optional[str] = None
    estado_item: str
    orden_estado: str
    updated_at: str

    class Config:
        from_attributes = True
