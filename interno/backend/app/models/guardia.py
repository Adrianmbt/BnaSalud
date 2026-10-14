"""Modelo ORM de la tabla guardias.

Registra los turnos de guardia de los medicos de emergencia,
incluyendo inicio, cambio y finalizacion de guardia.
"""
from datetime import date, datetime
from typing import Optional

from sqlalchemy import ForeignKey, Integer, Text, Date, TIMESTAMP, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Guardia(Base):
    """Registro de guardia de un medico de emergencia."""

    __tablename__ = "guardias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    medico_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("personal.id"), nullable=False
    )
    clinica_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("clinicas.id"), nullable=True
    )
    turno_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("turnos.id"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    hora_inicio: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
    hora_fin: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    estado: Mapped[str] = mapped_column(
        Text, nullable=False, default="ACTIVA"
    )
    registrado_por: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("personal.id")
    )
    observaciones: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
