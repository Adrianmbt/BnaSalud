"""Modelos ORM de la cola de atención del sistema interno.

Mapean las tablas existentes de PostgreSQL local (base `bnasalud`):
`cola_atencion`, `atencion_historial_estados` y los enums nativos.
"""
import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    Text,
    TIMESTAMP,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class EstadoAtencionEnum(str, enum.Enum):
    """Valores del enum nativo `atencion_estado_t` de PostgreSQL."""
    RECEPCION = "RECEPCION"
    TRIAJE = "TRIAJE"
    EN_ESPERA_CONSULTA = "EN_ESPERA_CONSULTA"
    EN_CONSULTA = "EN_CONSULTA"
    FINALIZADO = "FINALIZADO"
    CANCELADO = "CANCELADO"
    NO_ASISTIO = "NO_ASISTIO"


class RutaAtencionEnum(str, enum.Enum):
    """Valores del enum nativo `ruta_atencion_t` de PostgreSQL."""
    CITA = "CITA"
    EMERGENCIA = "EMERGENCIA"


class CategoriaPrioridadEnum(str, enum.Enum):
    """Valores del enum nativo `categoria_paciente_t` de PostgreSQL."""
    VERDE = "VERDE"
    AMARILLO = "AMARILLO"
    ROJO = "ROJO"


class ColaAtencion(Base):
    """Registro de un paciente en la cola de atención de la clínica."""

    __tablename__ = "cola_atencion"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    paciente_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "historias_clinicas.id",
            ondelete="SET NULL",
            use_alter=True,
            name="cola_atencion_paciente_id_fkey",
        ),
    )
    paciente_cedula: Mapped[str] = mapped_column(Text, nullable=False)
    paciente_nombre: Mapped[str] = mapped_column(Text, nullable=False)
    clinica_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(
            "clinicas.id",
            ondelete="SET NULL",
            use_alter=True,
            name="cola_atencion_clinica_id_fkey",
        ),
    )
    atencion_estado: Mapped[EstadoAtencionEnum] = mapped_column(
        Enum(
            EstadoAtencionEnum,
            name="atencion_estado_t",
            native_enum=True,
            create_type=False,
        ),
        default=EstadoAtencionEnum.RECEPCION,
        nullable=False,
    )
    ruta_atencion: Mapped[Optional[RutaAtencionEnum]] = mapped_column(
        Enum(
            RutaAtencionEnum,
            name="ruta_atencion_t",
            native_enum=True,
            create_type=False,
        )
    )
    triaje_realizado: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    prioridad: Mapped[int] = mapped_column(SmallInteger, default=3, nullable=False)
    sintomas_principales: Mapped[Optional[str]] = mapped_column(Text)
    presion_sistolica: Mapped[Optional[int]] = mapped_column(SmallInteger)
    presion_diastolica: Mapped[Optional[int]] = mapped_column(SmallInteger)
    temperatura: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 1))
    peso_kg: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    frecuencia_cardiaca: Mapped[Optional[int]] = mapped_column(SmallInteger)
    frecuencia_respiratoria: Mapped[Optional[int]] = mapped_column(SmallInteger)
    saturacion_oxigeno: Mapped[Optional[int]] = mapped_column(SmallInteger)
    glucometria: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 1))
    nivel_conciencia: Mapped[Optional[str]] = mapped_column(Text)
    motivo_consulta: Mapped[Optional[str]] = mapped_column(Text)
    especialidad: Mapped[Optional[str]] = mapped_column(Text)
    medico_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(
            "personal.id",
            ondelete="SET NULL",
            use_alter=True,
            name="cola_atencion_medico_id_fkey",
        ),
    )
    cita_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    creado_en: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
    fec_triaje: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    fec_encolada: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    iniciado_en: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    fin_en: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    cancelado_en: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    registrado_por: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(
            "personal.id",
            use_alter=True,
            name="cola_atencion_registrado_por_fkey",
        ),
    )
    atendido_por: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(
            "personal.id",
            use_alter=True,
            name="cola_atencion_atendido_por_fkey",
        ),
    )
    consulta_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    nivel_prioridad: Mapped[Optional[int]] = mapped_column(SmallInteger)
    cuota_prioritaria: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    derivado_a_especialista: Mapped[Optional[bool]] = mapped_column(
        Boolean, default=False
    )
    especialista_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(
            "personal.id",
            ondelete="SET NULL",
            use_alter=True,
            name="cola_atencion_especialista_id_fkey",
        ),
    )
    aprobado_emergencia_uuid: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    clasificacion_origen: Mapped[Optional[str]] = mapped_column(Text)
    observaciones: Mapped[Optional[str]] = mapped_column(Text)
    categoria_prioridad: Mapped[CategoriaPrioridadEnum] = mapped_column(
        Enum(
            CategoriaPrioridadEnum,
            name="categoria_paciente_t",
            native_enum=True,
            create_type=False,
        ),
        default=CategoriaPrioridadEnum.AMARILLO,
        nullable=False,
    )


class ColaAtencionHistorial(Base):
    """Trazabilidad de los cambios de estado de un registro de cola."""

    __tablename__ = "atencion_historial_estados"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cola_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("cola_atencion.id", ondelete="CASCADE"), nullable=False
    )
    estado_anterior: Mapped[Optional[EstadoAtencionEnum]] = mapped_column(
        Enum(
            EstadoAtencionEnum,
            name="atencion_estado_t",
            native_enum=True,
            create_type=False,
        )
    )
    estado_nuevo: Mapped[EstadoAtencionEnum] = mapped_column(
        Enum(
            EstadoAtencionEnum,
            name="atencion_estado_t",
            native_enum=True,
            create_type=False,
        ),
        nullable=False,
    )
    cambiado_por: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey(
            "personal.id",
            use_alter=True,
            name="atencion_historial_estados_cambiado_por_fkey",
        ),
    )
    observacion: Mapped[Optional[str]] = mapped_column(Text)
    creado_en: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
