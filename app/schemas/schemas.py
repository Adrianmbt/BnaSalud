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


class ParametroResultado(BaseModel):
    parametro: str = Field(default="", json_schema_extra={"example": "Hemoglobina"})
    valor: str = Field(default="", json_schema_extra={"example": "14.2"})
    unidad: Optional[str] = Field(None, json_schema_extra={"example": "g/dL"})
    rango: Optional[str] = Field(None, json_schema_extra={"example": "12.0 - 16.0"})


class EstudioResultado(BaseModel):
    """Estudio médico clasificado: laboratorio, imagen o funcional."""
    tipo: str = Field(default="laboratorio", description="laboratorio | imagen | funcional")
    nombre: str = Field(default="", json_schema_extra={"example": "Hemograma completo"})
    parametros: List[ParametroResultado] = Field(default_factory=list)
    descripcion: Optional[str] = Field(None, description="Hallazgos (imagen)")
    conclusion: Optional[str] = Field(None, description="Impresión diagnóstica o interpretación")


class ProcesarEstudioRequest(BaseModel):
    """Imagen en base64 para extracción automática de resultados."""
    imagen_base64: str = Field(..., json_schema_extra={"example": "/9j/4AAQSkZJRg..."})
    tipo_estudio: str = Field(default="laboratorio", description="laboratorio | imagen | funcional")


class EstudioProcesadoResponse(BaseModel):
    tipo_estudio: str
    nombre: str = Field(default="")
    parametros: List[ParametroResultado] = Field(default_factory=list)
    descripcion: Optional[str] = None
    conclusion: Optional[str] = None


class OrdenEstudiosCreate(BaseModel):
    """Solicitud formal de estudios médicos para un paciente."""
    paciente_id: str = Field(..., json_schema_extra={"example": "hc-maria-gonzalez"})
    consulta_id: Optional[str] = None
    cita_id: Optional[str] = None
    origen: str = Field(default="consulta", description="consulta | emergencia | jornada")
    prioridad: str = Field(default="normal", description="normal | urgente")
    medico_id: Optional[int] = None
    medico_nombre: Optional[str] = None
    especialidad: Optional[str] = None
    estudios: List[EstudioResultado] = Field(default_factory=list)


class OrdenEstudiosItem(BaseModel):
    tipo: str = Field(default="laboratorio")
    nombre: str = Field(default="")
    parametros: List[ParametroResultado] = Field(default_factory=list)
    descripcion: Optional[str] = None
    conclusion: Optional[str] = None
    estado: str = Field(default="solicitado", description="solicitado | completado")


class OrdenEstudiosResponse(BaseModel):
    id: str
    comprobante_orden: str = Field(..., json_schema_extra={"example": "ORD-2026-4821"})
    paciente_id: str
    paciente_cedula: Optional[str] = None
    paciente_nombre: Optional[str] = None
    consulta_id: Optional[str] = None
    cita_id: Optional[str] = None
    origen: str = "consulta"
    estado: str = "solicitada"
    prioridad: str = "normal"
    medico_nombre: str = ""
    especialidad: str = ""
    estudios: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    resultados_at: Optional[datetime] = None


class OrdenResultadosUpdate(BaseModel):
    """Registro de resultados de una orden emitida previamente."""
    estudios: List[OrdenEstudiosItem] = Field(default_factory=list)
    medico_nombre: Optional[str] = None
    especialidad: Optional[str] = None


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

class HistoriaClinicaUpdate(BaseModel):
    """Actualización parcial de los datos del paciente (perfil editable)."""
    nombre_completo: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    tipo_sangre: Optional[str] = None
    antecedentes_medicos: Optional[List[str]] = None
    alergias: Optional[List[str]] = None

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
    medico_id: Optional[int] = Field(None, json_schema_extra={"example": 127}, description="ID del médico (personal)")
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
    pin_inicial: Optional[str] = Field(
        default=None,
        description="PIN de acceso generado al registrar al paciente por primera vez (solo primera cita)",
    )
    pin_enviado_correo: bool = Field(
        default=False,
        description="True si el PIN se envió por correo (tarjeta de bienvenida)",
    )
    pin_enviado_whatsapp: bool = Field(
        default=False,
        description="True si el PIN se envió por WhatsApp (Green API)",
    )
    created_at: datetime

    class Config:
        from_attributes = True

class CitaDetalleResponse(BaseModel):
    id: str
    codigo_confirmacion: str
    centro_id: int
    centro_salud: str
    especialidad_id: int
    especialidad: str
    fecha_cita: date
    hora_inicio: time
    motivo: Optional[str] = None
    estado: EstadoCita = Field(default=EstadoCita.PENDIENTE)
    origen: OrigenAtencion = Field(default=OrigenAtencion.CITA_WEB)
    paciente_id: str
    paciente_nombre: str = Field(default="", description="Nombre del paciente (unido desde historias_clinicas)")
    created_at: datetime

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
    medico_id: Optional[int] = Field(None, description="ID del personal médico que atiende")
    medico_nombre: Optional[str] = Field(None, description="Nombre del médico (si no se envía medico_id)")
    especialidad: Optional[str] = Field(None, description="Especialidad de la consulta")
    motivo_consulta: str = Field(..., json_schema_extra={"example": "Cefalea constante de 3 días"})
    examen_fisico: str = Field(..., json_schema_extra={"example": "Presión arterial 130/85. Paciente consciente."})
    cie10_codigo: str = Field(..., json_schema_extra={"example": "I10"})
    cie10_descripcion: str = Field(..., json_schema_extra={"example": "Hipertensión esencial (primaria)"})
    tratamiento: str = Field(..., json_schema_extra={"example": "Enalapril 10mg cada 12 hrs"})
    recomendaciones: Optional[str] = Field(None, json_schema_extra={"example": "Reposo por 48 hrs y baja ingesta de sal"})
    comprobante_ref: Optional[str] = Field(None, description="Comprobante de referencia (ABH-XXXXX)")
    recetas: List[MedicamentoItem] = Field(default_factory=list)
    laboratorios: List[LaboratorioResultado] = Field(default_factory=list)
    estudios: List[EstudioResultado] = Field(default_factory=list)
    ordenes_ids: List[str] = Field(default_factory=list, description="IDs de órdenes de estudios emitidas en esta consulta")

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
    estudios: List[EstudioResultado] = Field(default_factory=list)
    ordenes_ids: List[str] = Field(default_factory=list)
    comprobante_ref: str = Field(..., json_schema_extra={"example": "ABH-99281"})

    class Config:
        from_attributes = True

class ProgresoPacienteResponse(BaseModel):
    paciente: HistoriaClinicaResponse
    total_consultas: int
    historial: List[ConsultaDetalleResponse] = Field(default_factory=list)


class MedicoPacienteResponse(BaseModel):
    """Médico tratante (principal) vinculado al paciente."""
    medico_id: Optional[int] = None
    nombre: Optional[str] = None
    especialidad: Optional[str] = None
    tipo: Optional[str] = None
    estado: Optional[str] = None


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
    fondoColor: str = Field(default="#00677d", description="Color dominante del fondo de la identidad visual (hex)")
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
    medicamento_id: Optional[int] = None
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
    fecha_emision: Optional[str] = None
    entregada_por_id: Optional[int] = None
    entregada_por: Optional[str] = None
    entregada_at: Optional[str] = None
    recibida_at: Optional[str] = None
    recibida_paciente_id: Optional[str] = None
    detalles: List[RecetaDetalleItemSchema]

class RecetaEntregarRequestSchema(BaseModel):
    """Conformidad de entrega registrada por el farmacéutico."""
    cedula_paciente: str = Field(
        ..., min_length=4, json_schema_extra={"example": "0912345678"}
    )

class InventarioItemSchema(BaseModel):
    id: int
    nombre: str
    presentacion: Optional[str] = None
    concentracion: Optional[str] = None
    stock_actual: int = 0
    stock_minimo: Optional[int] = None
    unidad: str = "unidad"
    categoria: Optional[str] = None
    vencimiento: Optional[str] = None


# ==========================================
# ESQUEMAS: NOTIFICACIONES AL PACIENTE (Fase 5)
# ==========================================

class NotificacionItem(BaseModel):
    id: int
    tipo: str
    canal: str = "correo"
    asunto: str
    destinatario: Optional[str] = None
    estado: str = "pendiente"
    detalle: Optional[str] = None
    referencia: Optional[str] = None
    enviado_en: Optional[str] = None
    creado_en: Optional[str] = None

class NotificarPacienteRequest(BaseModel):
    """Aviso manual enviado por el personal autorizado (superusuario)."""
    asunto: str = Field(min_length=3, max_length=150)
    mensaje: str = Field(min_length=3, max_length=4000)


# ==========================================
# ESQUEMAS: AUTENTICACIÓN Y ACCESO SEGURO
# ==========================================

class LoginRequest(BaseModel):
    """Credenciales del personal (médicos, farmacia, enfermería...)."""
    username: str = Field(..., min_length=2, json_schema_extra={"example": "lfernandez"})
    password: str = Field(..., min_length=4, json_schema_extra={"example": "BnaSalud2026!"})

class LoginUsuarioResponse(BaseModel):
    """Identidad del personal autenticado (para la sesión del módulo)."""
    username: str
    rol: str
    nombre: str
    especialidad: Optional[str] = None
    clinica_id: Optional[int] = None
    personal_id: Optional[int] = None

class LoginResponse(BaseModel):
    token: str
    usuario: LoginUsuarioResponse

class PacienteLoginRequest(BaseModel):
    """Acceso al portal del paciente: cédula + PIN (4-8 dígitos)."""
    cedula: str = Field(..., json_schema_extra={"example": "12345678"})
    pin: str = Field(..., min_length=4, max_length=8, json_schema_extra={"example": "1234"})

class PacienteLoginResponse(BaseModel):
    token: str
    paciente: HistoriaClinicaResponse

class RecuperarPinRequest(BaseModel):
    """Solicitud de recuperación de PIN: verifica la cédula contra el correo."""
    cedula: str = Field(..., json_schema_extra={"example": "12345678"})
    email: EmailStr = Field(..., json_schema_extra={"example": "maria@example.com"})

class RecuperarPinResponse(BaseModel):
    mensaje: str
    expira_minutos: int
    codigo_demo: Optional[str] = Field(
        None, description="Código devuelto solo en modo demo (sin envío por correo)"
    )

class ResetPinRequest(BaseModel):
    """Restablece el PIN con el código recibido por correo."""
    cedula: str = Field(..., json_schema_extra={"example": "12345678"})
    codigo: str = Field(..., min_length=6, max_length=6, json_schema_extra={"example": "482913"})
    pin_nuevo: str = Field(..., min_length=4, max_length=8, json_schema_extra={"example": "9876"})


# ==========================================
# ESQUEMAS: COLA DE PACIENTES (FASE 2)
# ==========================================

class CheckInRequest(BaseModel):
    """Check-in del paciente en la cola de consulta de la clínica."""
    cedula: str = Field(..., json_schema_extra={"example": "18234567"})
    nombre: Optional[str] = Field(
        None, description="Obligatorio solo si la cédula no está registrada"
    )
    motivo: Optional[str] = Field(None, description="consulta | emergencia | control ...")
    prioridad: int = Field(3, ge=1, le=5, description="Triaje: 1 = crítico, 5 = leve")
    clinica_id: Optional[int] = None

class ColaItemSchema(BaseModel):
    id: int
    token: str
    paciente_cedula: str
    paciente_nombre: str
    especialidad: Optional[str] = None
    motivo: Optional[str] = None
    prioridad: int = 3
    estado: str = "EN_ESPERA"
    medico_id: Optional[int] = None
    medico_nombre: str = ""
    creado_en: str = ""
    iniciado_en: Optional[str] = None
    atendido_en: Optional[str] = None

class ColaListaResponse(BaseModel):
    espera: List[ColaItemSchema]
    consulta: List[ColaItemSchema]
    finalizado: List[ColaItemSchema]