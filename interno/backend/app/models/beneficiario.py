"""Modelo ORM para la tabla `beneficiarios` del sistema CITAB interno."""
import uuid
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Text,
    Integer,
    String,
    Uuid,
    func,
)

from app.core.database import Base


class Beneficiario(Base):
    __tablename__ = "beneficiarios"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    empleado_id = Column(Uuid(as_uuid=True), nullable=True)
    cedula = Column(String(20), unique=True, nullable=False, index=True)
    nombre_completo = Column(Text, nullable=False)
    parentesco = Column(Text, nullable=True)
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"Beneficiario(cedula={self.cedula!r}, nombre={self.nombre_completo!r})"