"""Cola de pacientes: check-in, asignación al médico de turno y cierre."""
import re
import secrets
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, status

from app.api.v1.deps import exigir_roles, exigir_staff
from app.api.v1.errors import db_fail, fail, not_found
from app.core.bitacora import registrar_accion
from app.core.database import supabase
from app.schemas.schemas import CheckInRequest, ColaItemSchema, ColaListaResponse

router = APIRouter(tags=["Cola de Pacientes"])


def _solo_digitos(valor) -> str:
    return re.sub(r"\D", "", str(valor or ""))


def _clinica_por_defecto(usuario: Dict) -> Optional[int]:
    """Clínica del staff autenticado (para filtrar la cola de su centro)."""
    personal_id = usuario.get("personal_id")
    if not personal_id:
        return None
    try:
        fila = (
            supabase.table("personal")
            .select("clinica_id")
            .eq("id", personal_id)
            .limit(1)
            .execute()
            .data
        )
    except Exception:
        return None
    return fila[0].get("clinica_id") if fila else None


def _nombres_personal(ids: List[int]) -> Dict[int, str]:
    ids_validos = [i for i in ids if i]
    if not ids_validos:
        return {}
    try:
        filas = (
            supabase.table("personal")
            .select("id, nombre, apellido")
            .in_("id", ids_validos)
            .execute()
            .data
            or []
        )
    except Exception:
        return {}
    return {
        p["id"]: f"{p.get('nombre', '')} {p.get('apellido', '')}".strip()
        for p in filas
    }


def _a_item(fila: dict, nombres: Optional[Dict[int, str]] = None) -> ColaItemSchema:
    nombres = nombres or {}
    medico_id = fila.get("medico_id")
    return ColaItemSchema(
        id=fila["id"],
        token=fila.get("token", ""),
        paciente_cedula=fila.get("paciente_cedula", ""),
        paciente_nombre=fila.get("paciente_nombre", ""),
        especialidad=fila.get("especialidad"),
        motivo=fila.get("motivo"),
        prioridad=fila.get("prioridad", 3),
        estado=fila.get("estado", "EN_ESPERA"),
        medico_id=medico_id,
        medico_nombre=nombres.get(medico_id, "") if medico_id else "",
        creado_en=str(fila.get("creado_en") or "")[:19],
        iniciado_en=str(fila.get("iniciado_en") or "")[:19] or None,
        atendido_en=str(fila.get("atendido_en") or "")[:19] or None,
    )


def _a_lista(filas: List[dict]) -> List[ColaItemSchema]:
    nombres = _nombres_personal([f.get("medico_id") for f in filas])
    return [_a_item(f, nombres) for f in filas]


def _leer_fila(cola_id: int) -> dict:
    try:
        filas = (
            supabase.table("cola_pacientes")
            .select("*")
            .eq("id", cola_id)
            .limit(1)
            .execute()
            .data
        )
    except Exception:
        db_fail("consultar el turno")
    if not filas:
        not_found("Turno")
    return filas[0]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ColaItemSchema)
def registrar_checkin(
    payload: CheckInRequest,
    usuario: dict = Depends(exigir_staff),
) -> ColaItemSchema:
    """Check-in del paciente en la cola de consulta del centro."""
    paciente = None
    try:
        paciente = (
            supabase.table("historias_clinicas")
            .select("id, nombre_completo, cedula, tipo_cedula, email")
            .ilike("cedula", f"%{_solo_digitos(payload.cedula)}")
            .limit(1)
            .execute()
            .data
        )
    except Exception:
        paciente = None
    paciente = paciente[0] if paciente else None

    nombre = (payload.nombre or "").strip()
    if not paciente and not nombre:
        fail(
            "No hay un paciente registrado con esa cédula. Indique el nombre para "
            "registrarlo en la cola.",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    if not paciente:
        tipo = "V"
        cedula = _solo_digitos(payload.cedula)
    else:
        nombre = nombre or paciente.get("nombre_completo", "Paciente")
        tipo = (paciente.get("tipo_cedula") or "V").upper()
        cedula = paciente.get("cedula", _solo_digitos(payload.cedula))

    token = f"C-{secrets.randbelow(90000) + 10000}"
    for _ in range(5):
        try:
            duplicado = (
                supabase.table("cola_pacientes")
                .select("id")
                .eq("token", token)
                .limit(1)
                .execute()
                .data
            )
        except Exception:
            break
        if not duplicado:
            break
        token = f"C-{secrets.randbelow(90000) + 10000}"

    registro = {
        "token": token,
        "paciente_id": paciente["id"] if paciente else None,
        "paciente_cedula": f"{tipo}-{cedula}",
        "paciente_nombre": nombre,
        "clinica_id": payload.clinica_id or _clinica_por_defecto(usuario),
        "motivo": payload.motivo or "consulta",
        "prioridad": payload.prioridad,
        "estado": "EN_ESPERA",
    }
    try:
        creado = supabase.table("cola_pacientes").insert(registro).execute()
    except Exception:
        db_fail("registrar el check-in en la cola")
    registrar_accion(
        usuario,
        "checkin_cola",
        "cola_pacientes",
        creado.data[0]["id"],
        detalle=f"Turno {registro['token']} · {registro['paciente_nombre']}",
    )
    return _a_item(creado.data[0])


@router.get("", response_model=ColaListaResponse)
def listar_cola(
    clinica_id: Optional[int] = None,
    usuario: dict = Depends(exigir_staff),
) -> ColaListaResponse:
    """Cola de la clínica agrupada: espera (por prioridad), consulta y atendidos."""
    clinica = clinica_id or _clinica_por_defecto(usuario)
    try:
        query = supabase.table("cola_pacientes").select("*")
        if clinica:
            query = query.eq("clinica_id", clinica)
        filas = query.order("creado_en", desc=False).limit(300).execute().data or []
    except Exception:
        db_fail("consultar la cola")

    espera = sorted(
        [f for f in filas if f.get("estado") == "EN_ESPERA"],
        key=lambda f: (f.get("prioridad") or 3, f.get("creado_en") or ""),
    )
    consulta = [f for f in filas if f.get("estado") == "EN_CONSULTA"]
    finalizado = sorted(
        [f for f in filas if f.get("estado") == "ATENDIDO"],
        key=lambda f: f.get("atendido_en") or "",
        reverse=True,
    )[:20]
    return ColaListaResponse(
        espera=_a_lista(espera),
        consulta=_a_lista(consulta),
        finalizado=_a_lista(finalizado),
    )


@router.post("/{cola_id}/asignar", response_model=ColaItemSchema)
def asignar_paciente(
    cola_id: int,
    usuario: dict = Depends(exigir_roles("medico", "enfermero", "superusuario")),
) -> ColaItemSchema:
    """El médico de turno toma al paciente: pasa a EN_CONSULTA."""
    fila = _leer_fila(cola_id)
    if fila.get("estado") != "EN_ESPERA":
        fail("Ese turno ya fue tomado por otro profesional.", status.HTTP_409_CONFLICT)
    try:
        supabase.table("cola_pacientes").update(
            {
                "estado": "EN_CONSULTA",
                "medico_id": usuario.get("personal_id"),
                "iniciado_en": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", cola_id).execute()
    except Exception:
        db_fail("asignar el paciente al médico")
    registrar_accion(usuario, "cola_asignar", "cola_pacientes", cola_id)
    return _a_item(_leer_fila(cola_id))


@router.post("/{cola_id}/finalizar", response_model=ColaItemSchema)
def finalizar_paciente(
    cola_id: int,
    usuario: dict = Depends(exigir_roles("medico", "enfermero", "superusuario")),
) -> ColaItemSchema:
    """Cierra la consulta: el paciente pasa a ATENDIDO."""
    fila = _leer_fila(cola_id)
    if fila.get("estado") != "EN_CONSULTA":
        fail("Solo se finalizan pacientes en consulta.", status.HTTP_409_CONFLICT)
    if usuario.get("rol") != "superusuario" and fila.get("medico_id") != usuario.get(
        "personal_id"
    ):
        fail("Solo el profesional que lo atiende puede finalizar el turno.", 403)
    try:
        supabase.table("cola_pacientes").update(
            {
                "estado": "ATENDIDO",
                "atendido_en": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", cola_id).execute()
    except Exception:
        db_fail("finalizar el turno")
    registrar_accion(usuario, "cola_finalizar", "cola_pacientes", cola_id)
    return _a_item(_leer_fila(cola_id))


@router.post("/{cola_id}/cancelar", response_model=ColaItemSchema)
def cancelar_paciente(
    cola_id: int,
    usuario: dict = Depends(exigir_staff),
) -> ColaItemSchema:
    """Cancela el turno de un paciente que aún espera."""
    fila = _leer_fila(cola_id)
    if fila.get("estado") != "EN_ESPERA":
        fail("Solo se cancelan turnos en espera.", status.HTTP_409_CONFLICT)
    try:
        supabase.table("cola_pacientes").update({"estado": "CANCELADO"}).eq(
            "id", cola_id
        ).execute()
    except Exception:
        db_fail("cancelar el turno")
    registrar_accion(usuario, "cola_cancelar", "cola_pacientes", cola_id)
    return _a_item(_leer_fila(cola_id))
