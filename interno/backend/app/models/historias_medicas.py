"""Modelos ORM de Historia Clínica Integral y reposos médicos (CITAB)."""
from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Text,
    Uuid,
    func,
)

from app.core.database import Base


class HistoriaIntegral(Base):
    """Ficha basal del paciente en formato CITAB (una por historia clínica)."""

    __tablename__ = "historias_integrales"

    id = Column(
        Uuid(as_uuid=True), primary_key=True, default=func.gen_random_uuid(), nullable=False
    )
    historia_clinica_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("historias_clinicas.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    clinica_id = Column(Integer, ForeignKey("clinicas.id", ondelete="SET NULL"), nullable=True)
    numero_carpeta = Column(Text, nullable=True)
    datos = Column(JSON, nullable=False, default=dict)
    version = Column(Integer, nullable=False, default=1)
    creado_por = Column(Text, nullable=True)
    actualizado_por = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"HistoriaIntegral(historia_clinica_id={self.historia_clinica_id!r}, version={self.version})"


class ReposoMedico(Base):
    """Reposo médico emitido desde una atención de historia integral."""

    __tablename__ = "reposos_medicos"

    id = Column(
        Uuid(as_uuid=True), primary_key=True, default=func.gen_random_uuid(), nullable=False
    )
    folio = Column(Text, unique=True, nullable=False, index=True)
    historia_clinica_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("historias_clinicas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    consulta_id = Column(
        Uuid(as_uuid=True), ForeignKey("consultas.id", ondelete="SET NULL"), nullable=True
    )
    medico_id = Column(Integer, ForeignKey("personal.id", ondelete="SET NULL"), nullable=True)
    medico_nombre = Column(Text, nullable=True)
    empleado_id = Column(
        Uuid(as_uuid=True), ForeignKey("empleados.id", ondelete="SET NULL"), nullable=True
    )
    beneficiario_id = Column(
        Uuid(as_uuid=True), ForeignKey("beneficiarios.id", ondelete="SET NULL"), nullable=True
    )
    fecha_emision = Column(Date, nullable=False, server_default=func.current_date())
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    dias = Column(Integer, nullable=False)
    diagnostico = Column(Text, nullable=True)
    descripcion = Column(Text, nullable=True)
    estado = Column(Text, nullable=False, default="vigente")
    anulado_por = Column(Text, nullable=True)
    anulado_en = Column(DateTime(timezone=True), nullable=True)
    motivo_anulacion = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"ReposoMedico(folio={self.folio!r}, dias={self.dias}, estado={self.estado!r})"
