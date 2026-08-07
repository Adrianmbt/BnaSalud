from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import datetime, date, time
from pydantic import BaseModel, EmailStr, Field

# ==========================================
# ENUMS DE CONTROL
# ==========================================

class TipoIdentificacion(str, Enum):
    V = "V"
    E = "E"
    P = "P"

class EstadoCita(str, Enum):
    PENDIENTE = "pendiente"
    CONFIRMADA = "confirmada"
    EN_ESPERA = "en_espera"
    EN_CONSULTA = "en_consulta"
    COMPLETADA = "completada"
    FINALIZADA = "finalizada"
    CANCELADA = "cancelada"

class PrioridadTurno(str, Enum):
    NORMAL = "normal"
    ALTA = "alta_prioridad"

class OrigenAtencion(str, Enum):
    CITA_WEB = "cita_web"
    EMERGENCIA = "emergencia"
    JORNADA = "jornada"


# ==========================================
# SUB-ESTRUCTURAS (RECETAS Y LABORATORIOS)
# ==========================================

class MedicamentoItem(BaseModel):
    nombre: str = Field(..., json_schema_extra={"example": "Amoxicilina 500mg"})
    posologia: str = Field(..., json_schema_extra={"example": "1 cápsula cada 8 horas por 7 días"})

class LaboratorioResultado(BaseModel):
    parametro: str = Field(..., json_schema_extra={"example": "Hemoglobina"})
    valor: str = Field(..., json_schema_extra={"example": "14.2 g/dL"})


# ==========================================
# 1. HISTORIAS CLÍNICAS Y PACIENTES
# ==========================================

class HistoriaClinicaBase(BaseModel):
    tipo_cedula: TipoIdentificacion = Field(default=TipoIdentificacion.V)
    cedula: str = Field(..., json_schema_extra={"example": "12345678"})
    nombre_completo: str = Field(..., json_schema_extra={"example": "María Rodríguez"})
    fecha_nacimiento: Optional[date] = None
    telefono: Optional[str] = Field(None, json_schema_extra={"example": "04141234567"})
    email: Optional[EmailStr] = Field(None, json_schema_extra={"example": "maria@example.com"})
    tipo_sangre: Optional[str] = Field(None, json_schema_extra={"example": "O+"})
    antecedentes_medicos: List[str] = Field(default_factory=list, json_schema_extra={"example": ["Hipertensión"]})
    alergias: List[str] = Field(default_factory=list, json_schema_extra={"example": ["Penicilina"]})

class HistoriaClinicaCreate(HistoriaClinicaBase):
    pass

class HistoriaClinicaResponse(HistoriaClinicaBase):
    id: str
    numero_historia: str = Field(..., json_schema_extra={"example": "HIS-V12345678"})
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# 2. CITAS Y TURNOS MÉDICOS
# ==========================================

class CitaBase(BaseModel):
    centro_id: int = Field(..., json_schema_extra={"example": 1}, description="ID del centro de salud")
    especialidad_id: int = Field(..., json_schema_extra={"example": 101})
    fecha_cita: date = Field(..., json_schema_extra={"example": "2026-08-15"})
    hora_inicio: time = Field(..., json_schema_extra={"example": "08:30:00"})
    motivo: Optional[str] = Field(None, json_schema_extra={"example": "Control de rutina"})

class CitaCreate(CitaBase):
    paciente_id: str

class CitaConPacienteCreate(CitaBase):
    paciente: HistoriaClinicaBase

class CitaResponse(CitaBase):
    id: str
    codigo_confirmacion: str = Field(..., json_schema_extra={"example": "CITAB-2026-89A1"})
    paciente_id: str
    origen: OrigenAtencion = Field(default=OrigenAtencion.CITA_WEB)
    estado: EstadoCita = Field(default=EstadoCita.PENDIENTE)
    created_at: datetime

    class Config:
        from_attributes = True

class TurnoColaResponse(BaseModel):
    cita_id: str
    paciente_id: str
    paciente_nombre: str
    prioridad: PrioridadTurno = Field(default=PrioridadTurno.NORMAL)
    tiempo_espera_minutos: int = Field(..., json_schema_extra={"example": 15})
    estado: EstadoCita


# ==========================================
# 3. CONSULTAS Y ATENCIÓN MÉDICA (NUEVO)
# ==========================================

class ConsultaCargarRequest(BaseModel):
    paciente_id: str
    cita_id: Optional[str] = None
    motivo_consulta: str = Field(..., json_schema_extra={"example": "Cefalea constante de 3 días"})
    examen_fisico: str = Field(..., json_schema_extra={"example": "Presión arterial 130/85. Paciente consciente."})
    cie10_codigo: str = Field(..., json_schema_extra={"example": "I10"})
    cie10_descripcion: str = Field(..., json_schema_extra={"example": "Hipertensión esencial (primaria)"})
    tratamiento: str = Field(..., json_schema_extra={"example": "Enalapril 10mg cada 12 hrs"})
    recomendaciones: Optional[str] = Field(None, json_schema_extra={"example": "Reposo por 48 hrs y baja ingesta de sal"})
    recetas: List[MedicamentoItem] = Field(default_factory=list)
    laboratorios: List[LaboratorioResultado] = Field(default_factory=list)

class ConsultaDetalleResponse(BaseModel):
    consulta_id: str
    fecha: datetime
    especialidad: str
    medico_nombre: str
    cie10_codigo: str
    cie10_descripcion: str
    motivo_consulta: str
    examen_fisico: Optional[str] = None
    tratamiento: str
    recomendaciones: Optional[str] = None
    recetas: List[MedicamentoItem] = Field(default_factory=list)
    laboratorios: List[LaboratorioResultado] = Field(default_factory=list)
    comprobante_ref: str = Field(..., json_schema_extra={"example": "ABH-99281"})

    class Config:
        from_attributes = True

class ProgresoPacienteResponse(BaseModel):
    paciente: HistoriaClinicaResponse
    total_consultas: int
    historial: List[ConsultaDetalleResponse] = Field(default_factory=list)


# ==========================================
# 4. EMERGENCIAS
# ==========================================

class EmergenciaBase(BaseModel):
    paciente_id: Optional[str] = None
    centro_salud: str = Field(..., json_schema_extra={"example": "Hospital Luis Razetti"})
    nivel_triaje: int = Field(..., ge=1, le=5, description="1: Crítico/Inmediato, 5: No urgente")
    descripcion: str = Field(..., json_schema_extra={"example": "Dolor torácico agudo"})

class EmergenciaCreate(EmergenciaBase):
    pass

class EmergenciaResponse(EmergenciaBase):
    id: str
    estado: str = Field(default="en_atencion")
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# RED ASISTENCIAL: CENTROS Y ESPECIALIDADES
# ==========================================

class EspecialidadResponse(BaseModel):
    id: int
    nombre: str
    descripcion: str
    icono: str = Field(default="stethoscope", description="Icono de Material Symbols")

class CentroSaludResponse(BaseModel):
    id: int
    nombre: str
    subtitulo: str
    tipo: str = Field(description="Aliado, Especializado, Comunitario...")
    parroquia: str
    direccion: str
    horario: str
    servicios: List[str] = Field(default_factory=list)
    logo: str = Field(description="URL de la imagen del centro")
    textColor: str = Field(default="secondary", description="Clase de color Tailwind")
    tagText: str = Field(default="text-secondary", description="Clase de color para etiquetas")
    bgTag: str = Field(default="bg-secondary/10", description="Clase de fondo para etiquetas")
    disabled: bool = False


# ==========================================
# RAG / BÚSQUEDA VECTORIAL
# ==========================================

class RAGQuery(BaseModel):
    pregunta: str = Field(..., json_schema_extra={"example": "¿Cuál es el protocolo de triaje para casos febriles?"})
    top_k: int = Field(default=3, ge=1, le=10)

class RAGResponse(BaseModel):
    respuesta: str
    fuentes: List[Dict[str, Any]] = Field(default_factory=list)

from typing import List, Optional

# ==========================================
# ESQUEMAS: TALENTO HUMANO (RRHH)
# ==========================================

class AsignarTurnoSchema(BaseModel):
    personal_id: int
    clinica_id: int
    turno_id: int
    fecha_asignacion: date
    observaciones: Optional[str] = None

class PersonalDetalleSchema(BaseModel):
    personal_id: int
    nombre: str
    cargo: str
    especialidad: Optional[str]
    telefono: Optional[str]
    status: str

class TurnoResumenSchema(BaseModel):
    turno: str
    horario: str
    personal: List[PersonalDetalleSchema]

class DisponibilidadResponseSchema(BaseModel):
    clinica_id: int
    fecha: date
    total_personal_guardia: int
    turnos: List[TurnoResumenSchema]


# ==========================================
# ESQUEMAS: FARMACIA & RECETAS
# ==========================================

class ItemDespachoSchema(BaseModel):
    medicamento_id: int
    cantidad_despachada: int = Field(gt=0, description="Debe ser mayor a 0")

class DespacharRecetaRequestSchema(BaseModel):
    receta_id: int
    clinica_id: int
    despachado_por_id: int
    items: List[ItemDespachoSchema]

class RecetaDetalleItemSchema(BaseModel):
    medicamento_id: int
    nombre_medicamento: str
    cantidad_prescrita: int
    cantidad_despachada: int
    posologia: str

class RecetaResponseSchema(BaseModel):
    id: int
    codigo_receta: str
    paciente_cedula: str
    paciente_nombre: str
    medico: str
    estado: str
    detalles: List[RecetaDetalleItemSchema]