"""Esquemas Pydantic para el módulo de autenticación interna."""
from typing import Optional
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, description="Usuario de acceso")
    password: str = Field(..., min_length=1, description="Contraseña de acceso")


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    rol: str
    username: str
    nombre: str
    personal_id: Optional[int] = None
    especialidad: Optional[str] = None
    clinica_id: Optional[int] = None
    clinica_code: Optional[str] = None
    clinica_nombre: Optional[str] = None
