"""Modelos ORM de la extensión de farmacia.

Mapean las tablas existentes de PostgreSQL local (base `bnasalud`):
`insumos_catalogo`, `lotes`, `movimientos_inventario` y `stock_por_centro`.
"""
import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TipoMovimientoEnum(str, enum.Enum):
    """Valores permitidos para el tipo de movimiento de inventario."""
    ENTRADA = "ENTRADA"
    SALIDA = "SALIDA"
    AJUSTE = "AJUSTE"


class InsumoCatalogo(Base):
    """Catálogo de insumos médicos con seguimiento de stock."""

    __tablename__ = "insumos_catalogo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text)
    categoria: Mapped[Optional[str]] = mapped_column(String(100))
    unidad: Mapped[str] = mapped_column(String(50), nullable=False, default="pieza")
    stock_actual: Mapped[int] = mapped_column(Integer, default=0)
    stock_minimo: Mapped[int] = mapped_column(Integer, default=10)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Lote(Base):
    """Lote de medicamento o insumo con seguimiento de vencimiento."""

    __tablename__ = "lotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    codigo_lote: Mapped[str] = mapped_column(String(50), nullable=False)
    medicamento_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("medicamentos_catalogo.id", ondelete="SET NULL"),
    )
    insumo_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("insumos_catalogo.id", ondelete="SET NULL"),
    )
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cantidad_inicial: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fecha_entrada: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_vencimiento: Mapped[date] = mapped_column(Date, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "(medicamento_id IS NOT NULL) OR (insumo_id IS NOT NULL)",
            name="ck_lote_producto",
        ),
    )


class MovimientoInventario(Base):
    """Movimiento de inventario (entrada, salida o ajuste) de un lote."""

    __tablename__ = "movimientos_inventario"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lote_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("lotes.id", ondelete="SET NULL"),
    )
    tipo: Mapped[TipoMovimientoEnum] = mapped_column(String(20), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    observacion: Mapped[Optional[str]] = mapped_column(Text)
    creado_por: Mapped[Optional[str]] = mapped_column(String(100))
    clinica_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("clinicas.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')",
            name="ck_movimiento_tipo",
        ),
    )


class StockPorCentro(Base):
    """Stock de un insumo específico por centro de salud."""

    __tablename__ = "stock_por_centro"

    insumo_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("insumos_catalogo.id", ondelete="CASCADE"),
        primary_key=True,
    )
    clinica_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("clinicas.id", ondelete="CASCADE"),
        primary_key=True,
    )
    stock_actual: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stock_minimo: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
