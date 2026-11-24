"""Schemas del flujo de ausencias y reprogramación de citas."""

from typing import List, Optional

from pydantic import BaseModel, Field


class CitaSolicitudItem(BaseModel):
    id: str
    paciente_id: Optional[str] = None
    paciente_nombre: Optional[str] = None
    paciente_cedula: Optional[str] = None
    paciente_telefono: Optional[str] = None
    tipo_afiliacion: Optional[str] = None  # trabajador | beneficiario | general
    medico_id: Optional[int] = None
    medico_nombre: Optional[str] = None
    especialidad: Optional[str] = None
    centro_id: Optional[int] = None
    centro_salud: Optional[str] = None
    fecha_cita: Optional[str] = None
    hora_inicio: Optional[str] = None
    motivo: Optional[str] = None
    origen: Optional[str] = None
    estado: str
    codigo_confirmacion: Optional[str] = None
    created_at: Optional[str] = None
    mensaje_whatsapp: Optional[str] = None
    link_whatsapp: Optional[str] = None


class CitasSolicitudResponse(BaseModel):
    items: List[CitaSolicitudItem]
    total: int
    page: int
    limit: int


class AusenciaCrearRequest(BaseModel):
    medico_id: int = Field(..., description="ID del médico en personal")
    fecha_desde: str = Field(..., description="Primer día de ausencia (YYYY-MM-DD)")
    fecha_hasta: str = Field(..., description="Último día de ausencia (YYYY-MM-DD)")
    motivo: Optional[str] = None


class AusenciaItem(BaseModel):
    id: int
    medico_id: int
    medico_nombre: str
    especialidad: Optional[str] = None
    fecha_desde: str
    fecha_hasta: str
    motivo: Optional[str] = None
    estado: str
    afectadas: int = 0
    propuestas_pendientes: int = 0
    created_at: Optional[str] = None
    resuelta_en: Optional[str] = None


class AusenciasResponse(BaseModel):
    items: List[AusenciaItem]


class AfectadaItem(BaseModel):
    id: str
    fecha_cita: str
    hora_inicio: str
    paciente_id: Optional[str] = None
    paciente_nombre: Optional[str] = None
    paciente_cedula: Optional[str] = None
    paciente_telefono: Optional[str] = None
    especialidad: Optional[str] = None
    centro_salud: Optional[str] = None


class AfectadasResponse(BaseModel):
    items: List[AfectadaItem]


class PlanRequest(BaseModel):
    desde: Optional[str] = Field(None, description="Fecha desde la que se busca cupo")
    estrategia: str = Field(
        "primer_hueco",
        description="mismo_dia_semana | primer_hueco | fecha_objetivo",
    )
    fecha_objetivo: Optional[str] = Field(
        None, description="Fecha concreta cuando estrategia=fecha_objetivo"
    )
    reemplazar: bool = False


class PropuestaItem(BaseModel):
    id: str
    cita_id: str
    ausencia_id: Optional[int] = None
    paciente_nombre: Optional[str] = None
    paciente_cedula: Optional[str] = None
    paciente_telefono: Optional[str] = None
    medico_id: Optional[int] = None
    medico_nombre: Optional[str] = None
    especialidad: Optional[str] = None
    centro_salud: Optional[str] = None
    fecha_anterior: str
    hora_anterior: str
    fecha_nueva: Optional[str] = None
    hora_nueva: Optional[str] = None
    estado: str
    contacto: str
    notas: Optional[str] = None
    confirmada_en: Optional[str] = None
    created_at: Optional[str] = None


class PlanResumen(BaseModel):
    total: int
    con_cupo: int
    sin_cupo: int
    sin_telefono: int


class PlanResponse(BaseModel):
    ausencia_id: int
    propuestas: List[PropuestaItem]
    resumen: PlanResumen


class PropuestasResponse(BaseModel):
    items: List[PropuestaItem]


class ConfirmarPropuestaResponse(BaseModel):
    propuesta: PropuestaItem
    ausencia_resuelta: bool = False


class RechazarPropuestaRequest(BaseModel):
    notas: Optional[str] = None


class ReproponerRequest(BaseModel):
    fecha: str = Field(..., description="Nueva fecha (YYYY-MM-DD)")
    hora_inicio: str = Field(..., description="Nueva hora (HH:MM)")
    notas: Optional[str] = None


class ContactoRequest(BaseModel):
    contacto: str = Field(..., description="pendiente | contactado | no_contesta | confirmado | rechazado")
    notas: Optional[str] = None


class MoverJornadaRequest(BaseModel):
    medico_id: int
    fecha_origen: str = Field(..., description="Fecha de las citas a trasladar (YYYY-MM-DD)")
    fecha_destino: str = Field(..., description="Nueva fecha fijada (YYYY-MM-DD)")
    ajustar_horas: bool = Field(False, description="Si es True, recalcula horas según hora_inicio_base")
    hora_inicio_base: Optional[str] = Field(None, description="Nueva hora base si ajustar_horas=True (HH:MM)")
    intervalo_minutos: int = Field(30, description="Minutos entre citas si se recalculan")
    citas_ids: Optional[List[str]] = Field(None, description="Lista opcional de IDs de citas específicas a mover")


class TurnoJornadaItem(BaseModel):
    turno_id: int
    nombre: str
    hora_inicio: str
    hora_fin: str
    citas: int = 0


class TurnosJornadaResponse(BaseModel):
    items: List[TurnoJornadaItem]
    total: int


class CitaTrasladadaItem(BaseModel):
    id: str
    cita_id: str
    paciente_nombre: str
    paciente_cedula: Optional[str] = None
    paciente_telefono: Optional[str] = None
    medico_nombre: str
    especialidad: str
    centro_salud: Optional[str] = None
    fecha_anterior: str
    hora_anterior: str
    fecha_nueva: str
    hora_nueva: str
    contacto: str = "pendiente"
    mensaje_whatsapp: str
    link_whatsapp: Optional[str] = None


class MoverJornadaResponse(BaseModel):
    total_movidas: int
    fecha_origen: str
    fecha_destino: str
    medico_nombre: str
    citas: List[CitaTrasladadaItem]
