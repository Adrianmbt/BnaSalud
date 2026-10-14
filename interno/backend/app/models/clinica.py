"""Modelo ORM para la tabla `clinicas` (centros de salud) con temas visuales."""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Clinica(Base):
    """Centro de salud registrado en el sistema, con configuración visual."""

    __tablename__ = "clinicas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    codigo: Mapped[str] = mapped_column(Text, nullable=False)
    parroquia: Mapped[Optional[str]] = mapped_column(Text)
    direccion: Mapped[Optional[str]] = mapped_column(Text)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Tema visual por centro
    logo_url: Mapped[Optional[str]] = mapped_column(Text)
    color_primary: Mapped[Optional[str]] = mapped_column(Text, default="#3B98D4")
    color_secondary: Mapped[Optional[str]] = mapped_column(Text, default="#1A4B7C")
    color_accent: Mapped[Optional[str]] = mapped_column(Text, default="#38B000")
    color_bg: Mapped[Optional[str]] = mapped_column(Text, default="#FFFFFF")
    color_surface: Mapped[Optional[str]] = mapped_column(Text, default="#F8FAFC")
    font_heading: Mapped[Optional[str]] = mapped_column(Text, default="Sora")
    font_body: Mapped[Optional[str]] = mapped_column(Text, default="Manrope")
