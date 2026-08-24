import secrets
from datetime import date, time, datetime, timedelta
from typing import List, Optional, Union

from fastapi import APIRouter, Depends, Query, status

from app.api.v1.deps import exigir_paciente_o_staff
from app.api.v1.errors import db_fail, fail, not_found
from app.core.database import supabase
from app.core.mail import enviar_welcome
from app.core.security import hash_secreto
from app.schemas.schemas import (
    CitaConPacienteCreate,
    CitaCreate,
    CitaDetalleResponse,
    CitaResponse,
    HistoriaClinicaBase,
)

router = APIRouter(tags=["Citas Médicas"])

# Fase piloto: reservas en línea solo para el CITAB.
CITAB_CENTER_ID = 2

# Ventana horaria por centro (horas) para generar slots de 30 minutos.
HORARIOS_CENTRO: dict[int, tuple[str, str]] = {
    1: ("07:00", "17:00"),  # Clínica del Niño
    2: ("07:00", "17:30"),  # CITAB
    3: ("07:00", "16:30"),  # Clínica de la Mujer
    4: ("08:00", "16:00"),  # Centro Oncológico
    5: ("08:00", "14:00"),  # Jornadas de Salud
}
PREFIJOS_CONFIRMACION: dict[int, str] = {
    1: "NINO",
    2: "CITAB",
    3: "MUJER",
    4: "ONCO",
    5: "JORNADAS",
}


def _get_db():
    yield None


def _generar_slots(centro_id: int, fecha: date, especialidad_id: Optional[int]) -> List[str]:
    """Slots libres de 30 min para un centro/fecha, excluyendo los ya reservados."""
    try:
        res = (
            supabase.table("citas")
            .select("hora_inicio")
            .eq("centro_id", centro_id)
            .eq("fecha_cita", fecha.isoformat())
            .not_.eq("estado", "cancelada")
            .execute()
        )
    except Exception:
        db_fail("consultar la disponibilidad")
    ocupados = {str(r["hora_inicio"])[:5] for r in (res.data or [])}

    apertura, cierre = HORARIOS_CENTRO.get(centro_id, ("08:00", "16:00"))
    inicio = datetime.strptime(apertura, "%H:%M")
    fin = datetime.strptime(cierre, "%H:%M")
    slots: List[str] = []
    while inicio <= fin:
        etiqueta = inicio.strftime("%H:%M")
        if etiqueta not in ocupados:
            slots.append(etiqueta)
        inicio += timedelta(minutes=30)
    return slots


def _upsert_paciente(paciente: HistoriaClinicaBase) -> tuple[str, Optional[str], bool]:
    """Busca o crea un paciente en historias_clinicas por cédula.

    Devuelve (paciente_id, pin_inicial, pin_enviado_por_correo): el PIN se
    genera solo al registrar un paciente nuevo (primer acceso del portal).
    """
    cedula = paciente.cedula.strip()
    if not cedula.isdigit():
        fail("La cédula debe contener solo dígitos.")
    try:
        existe = (
            supabase.table("historias_clinicas")
            .select("id, cedula, numero_historia")
            .eq("cedula", cedula)
            .execute()
            .data
        )
    except Exception:
        db_fail("verificar el paciente")

    datos = paciente.model_dump(exclude_unset=True, mode="json")
    if existe:
        fila = existe[0]
        actualizables = {
            k: v
            for k, v in datos.items()
            if v is not None and k not in {"cedula", "tipo_cedula"}
        }
        if actualizables:
            try:
                supabase.table("historias_clinicas").update(actualizables).eq(
                    "id", fila["id"]
                ).execute()
            except Exception:
                db_fail("actualizar los datos del paciente")
        return fila["id"], None, False

    registro = dict(datos)
    registro["numero_historia"] = f"HIS-{paciente.tipo_cedula.value}{cedula}"
    # Generación de PIN Secreto de 6 dígitos para acceso del paciente al portal
    pin_inicial = f"{secrets.randbelow(900000) + 100000:06d}"
    registro["pin_hash"] = hash_secreto(pin_inicial)
    try:
        creado = supabase.table("historias_clinicas").insert(registro).execute()
    except Exception:
        db_fail("registrar al paciente")

    enviado = False
    email = (registro.get("email") or "").strip()
    if email:
        enviado = enviar_welcome(
            registro.get("nombre_completo") or f"Paciente {cedula}",
            cedula,
            pin_inicial,
            email,
        )
    return creado.data[0]["id"], pin_inicial, enviado


def _generar_codigo(centro_id: int) -> str:
    prefijo = PREFIJOS_CONFIRMACION.get(centro_id, "BNA")
    anio = date.today().year
    for _ in range(5):
        codigo = f"{prefijo}-{anio}-{secrets.token_hex(2).upper()}"
        ocupado = (
            supabase.table("citas")
            .select("id")
            .eq("codigo_confirmacion", codigo)
            .execute()
            .data
        )
        if not ocupado:
            return codigo
    fail("No se pudo generar un código de confirmación único.", status.HTTP_409_CONFLICT)


@router.post("", response_model=CitaResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=CitaResponse, status_code=status.HTTP_201_CREATED)
def crear_cita(
    payload: Union[CitaConPacienteCreate, CitaCreate],
    db=Depends(_get_db),
) -> CitaResponse:
    """Crea una cita médica (registra al paciente si no existe)."""
    if payload.centro_id != CITAB_CENTER_ID:
        fail(
            "La reserva de citas en línea actualmente solo está disponible para el CITAB durante esta fase.",
            status.HTTP_400_BAD_REQUEST,
        )

    try:
        centro = (
            supabase.table("clinicas")
            .select("id, nombre, activo")
            .eq("id", payload.centro_id)
            .execute()
            .data
        )
    except Exception:
        db_fail("validar el centro de salud")
    if not centro:
        not_found("Centro de salud")
    if not centro[0].get("activo", True):
        fail("Este centro de salud aún no está operativo.", status.HTTP_409_CONFLICT)

    try:
        esp = (
            supabase.table("especialidades")
            .select("id, nombre")
            .eq("id", payload.especialidad_id)
            .execute()
            .data
        )
    except Exception:
        db_fail("validar la especialidad")
    if not esp:
        not_found("Especialidad")

    if payload.fecha_cita < date.today():
        fail("La fecha de la cita no puede estar en el pasado.")

    hora_str = payload.hora_inicio.strftime("%H:%M:%S")
    try:
        ocupada = (
            supabase.table("citas")
            .select("id")
            .eq("centro_id", payload.centro_id)
            .eq("fecha_cita", payload.fecha_cita.isoformat())
            .eq("hora_inicio", hora_str)
            .not_.eq("estado", "cancelada")
            .execute()
            .data
        )
    except Exception:
        db_fail("verificar la disponibilidad del horario")
    if ocupada:
        fail(
            "Ese horario ya fue reservado. Seleccione otro.",
            status.HTTP_409_CONFLICT,
        )

    if isinstance(payload, CitaConPacienteCreate):
        paciente_id, pin_inicial, pin_enviado_correo = _upsert_paciente(payload.paciente)
    else:
        paciente_id = payload.paciente_id
        pin_inicial = None
        pin_enviado_correo = False
        try:
            existe_paciente = (
                supabase.table("historias_clinicas")
                .select("id")
                .eq("id", paciente_id)
                .execute()
                .data
            )
        except Exception:
            db_fail("validar al paciente")
        if not existe_paciente:
            not_found("Paciente")

    cita = {
        "paciente_id": paciente_id,
        "centro_id": payload.centro_id,
        "centro_salud": centro[0]["nombre"],
        "especialidad_id": payload.especialidad_id,
        "especialidad": esp[0]["nombre"],
        "fecha_cita": payload.fecha_cita.isoformat(),
        "hora_inicio": hora_str,
        "motivo": payload.motivo,
        "origen": "cita_web",
        "estado": "pendiente",
        "codigo_confirmacion": _generar_codigo(payload.centro_id),
    }
    try:
        creado = supabase.table("citas").insert(cita).execute()
    except Exception:
        db_fail("registrar la cita")

    fila = creado.data[0]
    return CitaResponse(
        id=fila["id"],
        codigo_confirmacion=fila["codigo_confirmacion"],
        paciente_id=paciente_id,
        centro_id=fila["centro_id"],
        especialidad_id=fila["especialidad_id"],
        fecha_cita=fila["fecha_cita"],
        hora_inicio=fila["hora_inicio"],
        motivo=fila.get("motivo"),
        origen=fila.get("origen", "cita_web"),
        estado=fila.get("estado", "pendiente"),
        created_at=fila.get("created_at", datetime.now()),
        pin_inicial=pin_inicial,
        pin_enviado_correo=pin_enviado_correo,
    )


@router.get("/disponibilidad")
def obtener_disponibilidad(
    centro_id: int,
    especialidad_id: int,
    fecha: date,
    db=Depends(_get_db),
) -> dict:
    """Devuelve los slots libres de 30 minutos para un centro y fecha."""
    if centro_id != CITAB_CENTER_ID:
        return {
            "disponible": False,
            "mensaje": "Centro no disponible para agenda digital actualmente.",
            "slots": [],
        }
    try:
        existe = (
            supabase.table("clinicas").select("id").eq("id", centro_id).execute().data
        )
    except Exception:
        db_fail("validar el centro de salud")
    if not existe:
        not_found("Centro de salud")

    slots = _generar_slots(centro_id, fecha, especialidad_id)
    return {
        "disponible": bool(slots),
        "centro_id": centro_id,
        "especialidad_id": especialidad_id,
        "fecha": fecha.isoformat(),
        "slots": slots,
        "mensaje": "No hay horarios disponibles para esta fecha." if not slots else "",
    }


def _a_cita_detalle(fila: dict) -> CitaDetalleResponse:
    return CitaDetalleResponse(
        id=fila["id"],
        codigo_confirmacion=fila.get("codigo_confirmacion", ""),
        centro_id=fila.get("centro_id"),
        centro_salud=fila.get("centro_salud", ""),
        especialidad_id=fila.get("especialidad_id"),
        especialidad=fila.get("especialidad", ""),
        fecha_cita=fila.get("fecha_cita"),
        hora_inicio=fila.get("hora_inicio"),
        motivo=fila.get("motivo"),
        estado=fila.get("estado", "pendiente"),
        origen=fila.get("origen", "cita_web"),
        paciente_id=fila.get("paciente_id", ""),
        paciente_nombre=fila.get("paciente_nombre", ""),
        created_at=fila.get("created_at"),
    )


@router.get("/{codigo}", response_model=CitaDetalleResponse)
def buscar_cita(codigo: str) -> CitaDetalleResponse:
    """Busca una cita por su código de confirmación."""
    try:
        fila = (
            supabase.table("citas")
            .select("*, historias_clinicas(nombre_completo)")
            .eq("codigo_confirmacion", codigo.strip().upper())
            .limit(1)
            .execute()
            .data
        )
    except Exception:
        db_fail("buscar la cita")
    if not fila:
        not_found("Cita")
    fila = dict(fila[0])
    relacion = fila.get("historias_clinicas") or {}
    fila["paciente_nombre"] = relacion.get("nombre_completo", "") if relacion else ""
    fila.pop("historias_clinicas", None)
    return _a_cita_detalle(fila)


@router.get("", response_model=List[CitaDetalleResponse])
@router.get("/", response_model=List[CitaDetalleResponse])
def listar_citas_por_cedula(
    cedula: str = Query(..., description="Cédula del paciente (solo dígitos)"),
    _: dict = Depends(exigir_paciente_o_staff),
) -> List[CitaDetalleResponse]:
    """Lista las citas de un paciente por su cédula."""
    try:
        paciente = (
            supabase.table("historias_clinicas")
            .select("id, nombre_completo")
            .eq("cedula", cedula)
            .limit(1)
            .execute()
            .data
        )
    except Exception:
        db_fail("buscar al paciente")
    if not paciente:
        return []
    try:
        filas = (
            supabase.table("citas")
            .select("*")
            .eq("paciente_id", paciente[0]["id"])
            .order("fecha_cita", desc=True)
            .execute()
            .data
            or []
        )
    except Exception:
        db_fail("listar las citas")
    for f in filas:
        f["paciente_nombre"] = paciente[0]["nombre_completo"]
    return [_a_cita_detalle(f) for f in filas]
