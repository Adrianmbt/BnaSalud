from typing import List, Optional

from pydantic import BaseModel


class SignosVitales(BaseModel):
    presion_arterial: Optional[str] = None
    frecuencia_cardiaca: Optional[int] = None
    frecuencia_respiratoria: Optional[int] = None
    temperatura: Optional[float] = None
    saturacion_oxigeno: Optional[int] = None
    peso_kg: Optional[float] = None
    talla_cm: Optional[float] = None


class MedicamentoReceta(BaseModel):
    nombre: str
    posologia: str


class ConsultaCargarRequest(BaseModel):
    paciente_id: str
    cola_id: Optional[int] = None
    cita_id: Optional[str] = None
    medico_id: Optional[int] = None
    medico_nombre: Optional[str] = None
    especialidad: Optional[str] = None
    motivo_consulta: Optional[str] = None
    enfermedad_actual: Optional[str] = None
    examen_fisico: Optional[str] = None
    signos_vitales: Optional[SignosVitales] = None
    cie10_codigo: Optional[str] = None
    codigo_cie10: Optional[str] = None
    cie10_descripcion: Optional[str] = None
    diagnostico_principal: Optional[str] = None
    diagnostico_secundario: Optional[str] = None
    tratamiento: Optional[str] = None
    recomendaciones: Optional[str] = None
    indicaciones_medicas: Optional[str] = None
    recetas: List[MedicamentoReceta] = []
    laboratorios: List[dict] = []
    estudios: List[dict] = []
    insumos: List[dict] = []
    ordenes_ids: Optional[List[str]] = None
    comprobante_ref: Optional[str] = None
    proxima_consulta: Optional[str] = None
    remision_examen: Optional["RemisionExamenRequest"] = None


class RemisionExamenRequest(BaseModel):
    examen_ofrecido_id: int
    cita_examen_id: str


class ConsultaDetalleResponse(BaseModel):
    consulta_id: str
    fecha: Optional[str] = None
    cola_id: Optional[int] = None
    especialidad: Optional[str] = None
    medico_nombre: Optional[str] = None
    cie10_codigo: Optional[str] = None
    cie10_descripcion: Optional[str] = None
    motivo_consulta: Optional[str] = None
    examen_fisico: Optional[str] = None
    signos_vitales: Optional[SignosVitales] = None
    diagnostico_secundario: Optional[str] = None
    tratamiento: Optional[str] = None
    recomendaciones: Optional[str] = None
    recetas: List[dict] = []
    laboratorios: List[dict] = []
    estudios: List[dict] = []
    insumos: List[dict] = []
    insumos_aplicados: List[dict] = []
    ordenes_ids: List[str] = []
    comprobante_ref: Optional[str] = None
    proxima_consulta: Optional[str] = None
    centro_nombre: Optional[str] = None
    centro_codigo: Optional[str] = None


class ConsultaHoyItemResponse(BaseModel):
    """Fila del datatable de pacientes atendidos hoy (vista sin paciente en consulta)."""
    consulta_id: str
    creado_en: Optional[str] = None
    paciente_cedula: str = ""
    paciente_nombre: str = ""
    comprobante_ref: str = ""
    especialidad: str = ""
    medico_nombre: str = ""
    motivo_consulta: str = ""
    examen_fisico: Optional[str] = None
    cie10_codigo: str = ""
    cie10_descripcion: str = ""
    tratamiento: str = ""
    recomendaciones: Optional[str] = None


class DetalleEstadoRemision(BaseModel):
    """Estado final de la consulta y datos de la cita con el especialista (si fue remitido)."""
    remitido: bool = False
    especialidad_destino: Optional[str] = None
    cita_fecha: Optional[str] = None
    cita_hora: Optional[str] = None
    medico_especialista: Optional[str] = None
    codigo_cita: Optional[str] = None


class DetalleRemisionExamen(BaseModel):
    """Datos de la cita de examen en centro adscrito (si fue remitido para estudios)."""
    remitido: bool = False
    examen: Optional[str] = None
    centro: Optional[str] = None
    fecha_cita: Optional[str] = None
    hora_inicio: Optional[str] = None
    codigo_confirmacion: Optional[str] = None
    estado: Optional[str] = None


class ConsultaDetalleCompleta(BaseModel):
    """Detalle completo de una consulta: ficha clínica, tratamiento, órdenes, recetas y remisión."""
    consulta_id: str
    fecha: str
    paciente_cedula: str = ""
    paciente_nombre: str = ""
    comprobante_ref: Optional[str] = None
    especialidad: Optional[str] = None
    medico_nombre: Optional[str] = None
    motivo_consulta: Optional[str] = None
    examen_fisico: Optional[str] = None
    cie10_codigo: Optional[str] = None
    cie10_descripcion: Optional[str] = None
    diagnostico_secundario: Optional[str] = None
    signos_vitales: Optional[dict] = None
    tratamiento: Optional[str] = None
    recomendaciones: Optional[str] = None
    recetas: List[dict] = []
    laboratorios: List[dict] = []
    estudios: List[dict] = []
    insumos_aplicados: List[dict] = []
    remision: DetalleEstadoRemision = DetalleEstadoRemision()
    remision_examen: DetalleRemisionExamen = DetalleRemisionExamen()


class ConsultaUpdateRequest(BaseModel):
    """Campos editables de una consulta registrada (datatable de atendidos hoy)."""
    motivo_consulta: Optional[str] = None
    examen_fisico: Optional[str] = None
    cie10_codigo: Optional[str] = None
    cie10_descripcion: Optional[str] = None
    tratamiento: Optional[str] = None
    recomendaciones: Optional[str] = None
