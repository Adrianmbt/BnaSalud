"""Modelo ORM de la tabla `usuarios` y referencia a `personal` para el login interno."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Usuario(Base):
    """Registro de acceso al sistema. Contiene usuario, hash de contraseña y rol."""

    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    rol: Mapped[str] = mapped_column(Text, nullable=False)
    personal_id: Mapped[Optional[int]] = mapped_column(Integer)
    paciente_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    clinica_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("clinicas.id"), nullable=True
    )
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Personal(Base):
    """Referencia a la tabla `personal` para obtener el nombre mostrado en la UI."""

    __tablename__ = "personal"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cedula: Mapped[Optional[str]] = mapped_column(String)
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    apellido: Mapped[Optional[str]] = mapped_column(String)
    cargo: Mapped[Optional[str]] = mapped_column(String)
    especialidad: Mapped[Optional[str]] = mapped_column(String)
    clinica_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("clinicas.id"), nullable=True
    )
