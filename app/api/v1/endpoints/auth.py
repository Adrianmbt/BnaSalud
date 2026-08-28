"""Autenticación de BnaSalud.

Dos vías de acceso:
  • /auth/login        → personal (médicos, farmacia, enfermería): usuario + clave.
  • /auth/paciente     → portal del paciente: cédula + PIN (4-8 dígitos).
  • /auth/paciente/recuperar → genera un código de 6 dígitos por correo.
  • /auth/paciente/reset     → restablece el PIN con ese código.

Los tokens son JWT con expiración (ver app/core/security.py) y las rutas
sensibles de la API los validan mediante app/api/v1/deps.py.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, status

from app.api.v1.errors import db_fail, fail
from app.api.v1.endpoints.pacientes import _a_historia, _buscar_paciente
from app.core.bitacora import registrar_accion
from app.core.config import settings
from app.core.database import supabase
from app.core.mail import enviar_codigo_recuperacion
from app.core.security import (
    crear_token,
    generar_codigo,
    hash_secreto,
    pin_ya_utilizado,
    verificar_secreto,
)
from app.schemas.schemas import (
    HistoriaClinicaResponse,
    LoginRequest,
    LoginResponse,
    LoginUsuarioResponse,
    PacienteLoginRequest,
    PacienteLoginResponse,
    RecuperarPinRequest,
    RecuperarPinResponse,
    ResetPinRequest,
)

router = APIRouter(tags=["Autenticación"])

ERROR_CREDENCIALES = "Usuario o contraseña incorrectos."


@router.post("/login", response_model=LoginResponse)
def login(credenciales: LoginRequest) -> LoginResponse:
    """Inicia sesión del personal (rol: medico, farmaceutico, enfermero, superusuario)."""
    username = credenciales.username.strip().lower()
    try:
        filas = (
            supabase.table("usuarios")
            .select("*")
            .eq("username", username)
            .limit(1)
            .execute()
            .data
            or []
        )
    except Exception:
        db_fail("verificar las credenciales")

    if not filas or not filas[0].get("activo", True):
        fail(ERROR_CREDENCIALES, 401)
    cuenta = filas[0]
    if not verificar_secreto(credenciales.password, cuenta.get("password_hash")):
        fail(ERROR_CREDENCIALES, 401)
    if cuenta.get("rol") == "paciente":
        fail("Esta cuenta usa el portal del paciente (cédula y PIN).", 403)

    nombre = cuenta.get("username")
    especialidad = None
    clinica_id = None
    personal_id = cuenta.get("personal_id")
    if personal_id:
        try:
            p = (
                supabase.table("personal")
                .select("id, nombre, apellido, especialidad, clinica_id")
                .eq("id", personal_id)
                .limit(1)
                .execute()
                .data
                or [{}]
            )[0]
            nombre = f"{p.get('nombre', '')} {p.get('apellido', '')}".strip() or nombre
            especialidad = p.get("especialidad")
            clinica_id = p.get("clinica_id")
        except Exception:
            pass

    token = crear_token(
        {
            "tipo": "staff",
            "rol": cuenta["rol"],
            "username": cuenta["username"],
            "personal_id": personal_id,
            "paciente_id": None,
            "cedula": "",
        }
    )
    registrar_accion(
        {"rol": cuenta["rol"], "username": cuenta["username"], "personal_id": personal_id},
        "login_staff",
        "usuarios",
        cuenta.get("id"),
        detalle=f"Rol {cuenta['rol']}",
    )
    return LoginResponse(
        token=token,
        usuario=LoginUsuarioResponse(
            username=cuenta["username"],
            rol=cuenta["rol"],
            nombre=nombre,
            especialidad=especialidad,
            clinica_id=clinica_id,
            personal_id=personal_id,
        ),
    )


@router.post("/paciente", response_model=PacienteLoginResponse)
def login_paciente(datos: PacienteLoginRequest) -> PacienteLoginResponse:
    """Acceso al portal del paciente: cédula + PIN."""
    cedula = datos.cedula.strip()
    fila = _buscar_paciente(cedula)
    if not verificar_secreto(datos.pin, fila.get("pin_hash")):
        fail("PIN incorrecto. Verifique su cédula y su PIN.", 401)

    token = crear_token(
        {
            "tipo": "paciente",
            "rol": "paciente",
            "username": "",
            "personal_id": None,
            "paciente_id": fila["id"],
            "cedula": cedula,
        }
    )
    registrar_accion(
        {"rol": "paciente", "username": cedula, "personal_id": None},
        "login_paciente",
        "historias_clinicas",
        fila["id"],
    )
    return PacienteLoginResponse(token=token, paciente=_a_historia(fila))


@router.post("/paciente/recuperar", response_model=RecuperarPinResponse)
def recuperar_pin(datos: RecuperarPinRequest) -> RecuperarPinResponse:
    """Genera un código de 6 dígitos si la cédula y el correo coinciden.

    En modo demo (sin SMTP configurado) el código se devuelve en la
    respuesta para poder probar el flujo; en producción se envía por correo.
    """
    fila = _buscar_paciente(datos.cedula.strip())
    email_registrado = (fila.get("email") or "").strip().lower()
    if not email_registrado or email_registrado != datos.email.strip().lower():
        fail("El correo no coincide con el registrado para esta cédula.")

    codigo = generar_codigo()
    expira = datetime.now(timezone.utc) + timedelta(minutes=settings.PIN_EXPIRACION_MINUTOS)
    try:
        supabase.table("recuperacion_pacientes").insert(
            {
                "paciente_id": fila["id"],
                "codigo_hash": hash_secreto(codigo),
                "expira_en": expira.isoformat(),
            }
        ).execute()
    except Exception:
        db_fail("generar el código de recuperación")

    enviado = enviar_codigo_recuperacion(
        fila.get("nombre_completo", "Paciente"),
        codigo,
        settings.PIN_EXPIRACION_MINUTOS,
        fila["email"],
    )
    return RecuperarPinResponse(
        mensaje=(
            "Hemos enviado un código de 6 dígitos a su correo. "
            f"Válido por {settings.PIN_EXPIRACION_MINUTOS} minutos."
            if enviado
            else "Si el correo coincide con el registrado, recibirá un código "
            f"de 6 dígitos válido por {settings.PIN_EXPIRACION_MINUTOS} minutos."
        ),
        expira_minutos=settings.PIN_EXPIRACION_MINUTOS,
        codigo_demo=codigo if (settings.PIN_EMITIR_DEMO and not enviado) else None,
    )


@router.post("/paciente/reset", response_model=HistoriaClinicaResponse)
def reset_pin(datos: ResetPinRequest) -> HistoriaClinicaResponse:
    """Valida el código recibido y restablece el PIN del paciente."""
    fila = _buscar_paciente(datos.cedula.strip())
    ahora = datetime.now(timezone.utc)
    try:
        registros = (
            supabase.table("recuperacion_pacientes")
            .select("id, codigo_hash, expira_en")
            .eq("paciente_id", fila["id"])
            .eq("usado", False)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
            .data
            or []
        )
    except Exception:
        db_fail("validar el código de recuperación")

    valido = None
    for registro in registros:
        try:
            expira = datetime.fromisoformat(str(registro["expira_en"]).replace("Z", "+00:00"))
        except Exception:
            continue
        if expira >= ahora and verificar_secreto(datos.codigo, registro.get("codigo_hash")):
            valido = registro
            break
    if not valido:
        fail("Código inválido o expirado. Solicite uno nuevo.")

    if pin_ya_utilizado(datos.pin_nuevo):
        fail(
            "El PIN elegido ya está en uso por otro paciente. Elija otro.",
            status.HTTP_409_CONFLICT,
        )

    try:
        supabase.table("recuperacion_pacientes").update({"usado": True}).eq(
            "id", valido["id"]
        ).execute()
        supabase.table("historias_clinicas").update(
            {"pin_hash": hash_secreto(datos.pin_nuevo)}
        ).eq("id", fila["id"]).execute()
    except Exception:
        db_fail("restablecer el PIN")

    fila["pin_hash"] = None
    return _a_historia(fila)