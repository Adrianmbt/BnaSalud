"""Esquemas de Historia Clínica Integral (CITAB) y reposos médicos."""
from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.consultas import SignosVitales


class PacienteCreate(BaseModel):
    """Alta básica de un paciente que aún no tiene historia clínica."""

    cedula: str = Field(..., min_length=3, max_length=20)
    tipo_cedula: str = Field(default="V", max_length=2)
    nombres: str = Field(..., min_length=2, max_length=120)
    apellidos: str = Field(default="", max_length=120)
    fecha_nacimiento: Optional[date] = None
    telefono: Optional[str] = Field(default=None, max_length=40)
    direccion: Optional[str] = None
    email: Optional[str] = Field(default=None, max_length=120)


class PacienteContactoUpdate(BaseModel):
    """Corrección de los datos del paciente desde recepción (sin tocar la cédula)."""

    nombre_completo: Optional[str] = Field(default=None, min_length=2, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=40)
    direccion: Optional[str] = None
    email: Optional[str] = Field(default=None, max_length=120)


class PacienteOut(BaseModel):
    id: str
    cedula: str
    tipo_cedula: Optional[str] = "V"
    nombre_completo: str
    fecha_nacimiento: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    numero_historia: Optional[str] = None
    tiene_ficha: bool = False
    numero_carpeta: Optional[str] = None
    es_trabajador: bool = False
    es_beneficiario: bool = False


class FichaIntegralUpsert(BaseModel):
    """Ficha CITAB: los datos se guardan completos en un JSONB versionado."""

    numero_carpeta: Optional[str] = Field(default=None, max_length=60)
    datos: dict[str, Any] = Field(default_factory=dict)


class FichaIntegralOut(BaseModel):
    id: str
    historia_clinica_id: str
    clinica_id: Optional[int] = None
    numero_carpeta: Optional[str] = None
    datos: dict[str, Any] = Field(default_factory=dict)
    version: int
    creado_por: Optional[str] = None
    actualizado_por: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RecetaIntegral(BaseModel):
    """Línea del récipe médico: medicamento del catálogo o escrito a mano."""

    nombre: str = Field(..., min_length=1, max_length=200)
    posologia: str = Field(default="", max_length=300)
    cantidad: Optional[int] = Field(default=None, ge=1, le=999)


class ReposoIndicacion(BaseModel):
    """Reposo emitido dentro de las indicaciones de la atención."""

    fecha_inicio: Optional[date] = None
    dias: Literal[1, 3, 5, 7]
    diagnostico: Optional[str] = Field(default=None, max_length=300)
    descripcion: Optional[str] = None


class AtencionIntegralCreate(BaseModel):
    """Atención registrada desde la historia integral (crea una consulta)."""

    cola_id: Optional[int] = None
    medico_id: Optional[int] = None
    medico_nombre: Optional[str] = None
    motivo_consulta: Optional[str] = None
    enfermedad_actual: Optional[str] = None
    examen_fisico: Optional[str] = None
    signos_vitales: Optional[SignosVitales] = None
    cie10_codigo: Optional[str] = None
    diagnostico_principal: Optional[str] = None
    diagnostico_secundario: Optional[str] = None
    tratamiento: Optional[str] = None
    recetas: list[RecetaIntegral] = Field(default_factory=list)
    recomendaciones: Optional[str] = None
    proxima_consulta: Optional[str] = None
    reposo: Optional[ReposoIndicacion] = None


class AtencionIntegralOut(BaseModel):
    id: str
    created_at: Optional[str] = None
    medico_nombre: Optional[str] = None
    motivo_consulta: Optional[str] = None
    examen_fisico: Optional[str] = None
    cie10_codigo: Optional[str] = None
    cie10_descripcion: Optional[str] = None
    tratamiento: Optional[str] = None
    recetas: list[dict[str, Any]] = Field(default_factory=list)
    recomendaciones: Optional[str] = None
    proxima_consulta: Optional[str] = None
    comprobante_ref: Optional[str] = None
    signos_vitales: Optional[dict[str, Any]] = None
    diagnostico_secundario: Optional[str] = None
    reposo: Optional[dict[str, Any]] = None


class ColaHistoriaItem(BaseModel):
    """Paciente que pasó por consulta médica y requiere su historia integral."""

    cola_id: int
    paciente_id: Optional[str] = None
    cedula: str
    nombre_completo: str
    estado: str
    medico_id: Optional[int] = None
    medico_nombre: Optional[str] = None
    motivo_consulta: Optional[str] = None
    creado_en: Optional[str] = None
    iniciado_en: Optional[str] = None
    fin_en: Optional[str] = None
    consulta_id: Optional[str] = None
    tiene_ficha: bool = False
    tiene_atencion_integral: bool = False
    reposos_vigentes: int = 0


class ReposoCreate(BaseModel):
    """Emisión de reposo. `dias` solo admite los valores del formato."""

    medico_id: Optional[int] = None
    medico_nombre: Optional[str] = None
    consulta_id: Optional[str] = None
    empleado_id: Optional[str] = None
    fecha_inicio: Optional[date] = None
    dias: Literal[1, 3, 5, 7]
    diagnostico: Optional[str] = None
    descripcion: Optional[str] = None


class ReposoOut(BaseModel):
    id: str
    folio: str
    historia_clinica_id: str
    paciente_cedula: Optional[str] = None
    paciente_nombre: Optional[str] = None
    consulta_id: Optional[str] = None
    medico_id: Optional[int] = None
    medico_nombre: Optional[str] = None
    empleado_id: Optional[str] = None
    beneficiario_id: Optional[str] = None
    trabajador_nombre: Optional[str] = None
    fecha_emision: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    dias: int
    diagnostico: Optional[str] = None
    descripcion: Optional[str] = None
    estado: str
    anulado_por: Optional[str] = None
    anulado_en: Optional[str] = None
    motivo_anulacion: Optional[str] = None
    created_at: Optional[str] = None


class ReposoAnular(BaseModel):
    motivo: str = Field(..., min_length=3, max_length=300)


class MedicoOut(BaseModel):
    id: int
    nombre: str
    apellido: Optional[str] = None
    especialidad: Optional[str] = None
    cargo: Optional[str] = None
    clinica_id: Optional[int] = None


class PacienteDetalleOut(BaseModel):
    paciente: PacienteOut
    ficha: Optional[FichaIntegralOut] = None
    atenciones: list[AtencionIntegralOut] = Field(default_factory=list)
    reposos: list[ReposoOut] = Field(default_factory=list)


class MetricaRepososOut(BaseModel):
    anio: int
    mes: Optional[int] = None
    total: int
    vigentes: int
    anulados: int
    dias_vigentes: int
    trabajadores: int
    por_medico: list[dict[str, Any]] = Field(default_factory=list)
    por_dia: list[dict[str, Any]] = Field(default_factory=list)
    por_mes: list[dict[str, Any]] = Field(default_factory=list)


class ResumenHistoriasOut(BaseModel):
    pacientes: int
    fichas: int
    atenciones_mes: int
    reposos_vigentes: int
    reposos_mes: int
    trabajadores_con_reposo: int
    actualizado_en: Optional[datetime] = None
