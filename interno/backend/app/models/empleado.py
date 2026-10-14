"""Modelo ORM para la tabla `empleados` del sistema BnaSalud."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Text,
    Integer,
    String,
    ForeignKey,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class Empleado(Base):
    """Registro de empleados (nómina/payroll)."""

    __tablename__ = "empleados"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    cedula = Column(String(20), unique=True, nullable=False, index=True)
    nombre_completo = Column(Text, nullable=False)
    edad = Column(Integer, nullable=True)
    cargo = Column(Text, nullable=True)
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    fecha_nacimiento = Column(Text, nullable=True)
    genero = Column(Text, nullable=True)
    telefono = Column(String(20), nullable=True)

    def __repr__(self) -> str:
        return f"Empleado(cedula={self.cedula!r}, nombre={self.nombre_completo!r})"


class EmpleadoClinica(Base):
    """Relación many-to-many: empleados ↔ centros de salud."""

    __tablename__ = "empleado_clinica"

    empleado_id = Column(
        UUID(as_uuid=True),
        ForeignKey("empleados.id", ondelete="CASCADE"),
        primary_key=True,
    )
    clinica_id = Column(
        Integer,
        ForeignKey("clinicas.id", ondelete="CASCADE"),
        primary_key=True,
    )
    es_principal = Column(Boolean, default=True, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
