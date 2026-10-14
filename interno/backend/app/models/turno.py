"""Modelo ORM de la tabla turnos (definiciones de turno de guardia)."""
from typing import Optional

from sqlalchemy import Integer, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Turno(Base):
    """Definicion de un turno (ej: Guardia 24h, Manana, Tarde)."""

    __tablename__ = "turnos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    hora_inicio: Mapped[Optional[str]] = mapped_column(Time)
    hora_fin: Mapped[Optional[str]] = mapped_column(Time)
