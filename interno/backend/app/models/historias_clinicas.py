"""Modelo ORM para la tabla `historias_clinicas` del sistema CITAB interno."""
from sqlalchemy import (
    Column,
    DateTime,
    Text,
    Integer,
    String,
    Uuid,
    Boolean,
    func,
    JSON,
)

from app.core.database import Base


class HistoriaClinica(Base):
    __tablename__ = "historias_clinicas"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=func.gen_random_uuid(), nullable=False)
    cedula = Column(String(20), unique=True, nullable=False, index=True)
    nombre_completo = Column(Text, nullable=False)
    apellido = Column(Text, nullable=True)
    direccion = Column(Text, nullable=True)
    telefono = Column(Text, nullable=True)
    tipo_sangre = Column(Text, nullable=True)
    antecedentes_medicos = Column(JSON, default=[])
    antecedentes_operatorios = Column(JSON, default=[])
    alergias = Column(JSON, default=[])
    numero_historia = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"HistoriaClinica(cedula={self.cedula!r}, nombre={self.nombre_completo!r})"


# Ensure SQLAlchemy maps this model to the existing table
try:
    from sqlalchemy.orm import mapper
    mapper(HistoriaClinica, HistoriaClinica.__tablename__)
except Exception:
    pass  # Tabla ya existe; SQLAlchemy la manejará