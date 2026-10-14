"""Modelos SQLAlchemy: Catálogo de exámenes y Órdenes médicas."""
import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Index, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class CatalogoExamen(Base):
    """Catálogo maestro de exámenes diagnósticos disponibles."""
    __tablename__ = "catalogo_examenes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    categoria = Column(
        Enum("laboratorio", "imagen", "funcional", "anatomia_patologica",
             name="exam_category_enum", create_type=False),
        nullable=False,
    )
    grupo = Column(Text, nullable=False)
    nombre_estudio = Column(Text, nullable=False, unique=True)
    requiere_ayuno = Column(Boolean, default=False, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_catalogo_categoria", "categoria"),
        Index("idx_catalogo_grupo", "grupo"),
        Index("idx_catalogo_activo", "activo", postgresql_where="activo = true"),
    )


class OrdenMedica(Base):
    """Encabezado de orden de exámenes médicos."""
    __tablename__ = "ordenes_medicas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paciente_id = Column(
        UUID(as_uuid=True),
        ForeignKey("historias_clinicas.id", ondelete="RESTRICT"),
        nullable=False,
    )
    medico_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="RESTRICT"),
        nullable=False,
    )
    origen_atencion = Column(
        Text,
        nullable=False,
    )  # 'recepcion' | 'emergencia' | 'consulta_especialidad'
    estado = Column(
        Enum("pendiente", "en_proceso", "completado", "cancelado",
             name="order_status_enum", create_type=False),
        default="pendiente",
        nullable=False,
    )
    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_ordenes_paciente", "paciente_id"),
        Index("idx_ordenes_medico", "medico_id"),
        Index("idx_ordenes_estado", "estado"),
        Index("idx_ordenes_created", "created_at"),
    )


class OrdenExamenItem(Base):
    """Item individual dentro de una orden médica (examen específico)."""
    __tablename__ = "orden_examenes_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    orden_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ordenes_medicas.id", ondelete="CASCADE"),
        nullable=False,
    )
    examen_id = Column(
        UUID(as_uuid=True),
        ForeignKey("catalogo_examenes.id", ondelete="SET NULL"),
        nullable=True,
    )
    nombre_examen = Column(Text, nullable=False)
    categoria = Column(
        Enum("laboratorio", "imagen", "funcional", "anatomia_patologica",
             name="exam_category_enum", create_type=False),
        nullable=False,
    )
    grupo = Column(Text, nullable=False)
    resultado = Column(Text, nullable=True)
    estado_item = Column(
        Enum("pendiente", "en_proceso", "completado", "cancelado",
             name="order_status_enum", create_type=False),
        default="pendiente",
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_orden_items_orden", "orden_id"),
        Index("idx_orden_items_examen", "examen_id"),
        Index("idx_orden_items_estado", "estado_item"),
    )
