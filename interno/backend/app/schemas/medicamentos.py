"""Schemas del catálogo de medicamentos para recetas médicas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MedicamentoItem(BaseModel):
    id: int
    nombre: str
    presentacion: str = ""
    concentracion: str = ""
    posologia_sugerida: str = ""
    creado_por: Optional[str] = None


class MedicamentoListaResponse(BaseModel):
    items: list[MedicamentoItem]
    total: int


class MedicamentoCrearRequest(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=120)
    presentacion: Optional[str] = Field(None, max_length=60)
    concentracion: Optional[str] = Field(None, max_length=60)
    posologia_sugerida: Optional[str] = Field(None, max_length=200)
    creado_por: Optional[str] = Field(None, max_length=120)


class MedicamentoCreadoResponse(MedicamentoItem):
    created_at: datetime