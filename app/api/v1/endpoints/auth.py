"""Autenticación de BnaSalud.

Tres vías de acceso:
  • /auth/login        → personal (médicos, farmacia, enfermería): usuario + clave.
  • /auth/institucional → cuentas globales: admin_sistemas y director.
  • /auth/paciente     → portal del paciente: cédula + contraseña.
  • /auth/paciente/recuperar → genera un código de 6 dígitos por correo.
  • /auth/paciente/reset     → restablece la contraseña con ese código.

Los tokens son JWT con expiración (ver app/core/security.py) y las rutas
sensibles de la API los validan mediante app/api/v1/deps.py.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, status

import time
from collections import defaultdict
from threading import Lock

from app.api.v1.deps import ROLES_GLOBALES
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
    verificar_secreto,
)
from app.schemas.schemas import (
    HistoriaClinicaResponse,
    LoginRequest,
    LoginResponse,
    LoginUsuarioResponse,
    PacienteLoginRequest,
    PacienteLoginResponse,
    RecuperarPasswordRequest,
    RecuperarPasswordResponse,
    ResetPasswordRequest,
)

router = APIRouter(tags=["Autenticación"])

ERROR_CREDENCIALES = "Usuario o contraseña incorrectos."

# Rate limit simple en memoria para endpoints de autenticación.
# Ventana deslizante: máximo `maximo` intentos por IP en `ventana` segundos.
_intentos_auth: dict[str, list[float]] = defaultdict(list)
_lock_auth = Lock()


def _rate_limit_auth(clave: str, maximo: int = 5, ventana: int = 60) -> bool:
    """Devuelve True si la petición puede pasar; False si se excede el límite."""
    ahora = time.time()
    with _lock_auth:
        # Tope de memoria: si llegan muchísimas IPs, se reinicia la ventana.
        if len(_intentos_auth) > 5_000:
            _intentos_auth.clear()
        tiempos = [t for t in _intentos_auth.get(clave, []) if ahora - t < ventana]
        if len(tiempos) >= maximo:
            return False
        tiempos.append(ahora)
        _intentos_auth[clave] = tiempos
        return True


def _login_con_password(
    credenciales: LoginRequest,
    roles_permitidos: tuple[str, ...] | None = None,
) -> LoginResponse:
    """Valida usuario + contraseña y emite el token de personal.

    Si `roles_permitidos` se indica, la cuenta debe tener uno de esos roles.
    """
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
        fail("Esta cuenta usa el portal del paciente (cédula y contraseña).", 403)
    # El Jefe de Almacén es una cuenta exclusiva del sistema interno (local):
    # recibe órdenes y lleva el inventario del centro; no usa el portal web.
    if cuenta.get("rol") == "jefe_almacen":
        fail(
            "Las cuentas de Jefe de Almacén son exclusivas del sistema interno "
            "y no tienen acceso al portal web.",
            403,
        )
    if roles_permitidos is not None and cuenta.get("rol") not in roles_permitidos:
        fail("Esta cuenta no tiene acceso al panel institucional.", 403)

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


@router.post("/login", response_model=LoginResponse)
def login(
    credenciales: LoginRequest,
    request: Request,
) -> LoginResponse:
    """Inicia sesión del personal (rol: medico, farmaceutico, enfermero, superusuario)."""
    if not _rate_limit_auth(f"auth:{request.client.host}"):
        fail("Demasiados intentos. Intente nuevamente más tarde.", status.HTTP_429_TOO_MANY_REQUESTS)
    return _login_con_password(credenciales)


@router.post("/institucional", response_model=LoginResponse)
def login_institucional(
    credenciales: LoginRequest,
    request: Request,
) -> LoginResponse:
    """Acceso al panel institucional: solo admin_sistemas y director."""
    if not _rate_limit_auth(f"auth:{request.client.host}"):
        fail("Demasiados intentos. Intente nuevamente más tarde.", status.HTTP_429_TOO_MANY_REQUESTS)
    return _login_con_password(credenciales, roles_permitidos=ROLES_GLOBALES)


@router.post("/paciente", response_model=PacienteLoginResponse)
def login_paciente(
    datos: PacienteLoginRequest,
    request: Request,
) -> PacienteLoginResponse:
    """Acceso al portal del paciente: cédula + contraseña."""
    if not _rate_limit_auth(f"auth:{request.client.host}"):
        fail("Demasiados intentos. Intente nuevamente más tarde.", status.HTTP_429_TOO_MANY_REQUESTS)
    secreto = datos.password.strip()
    if not secreto:
        fail("Ingrese su contraseña.", 400)

    cedula = datos.cedula.strip()
    try:
        fila = _buscar_paciente(cedula)
    except HTTPException:
        fila = None
    if not fila or not verificar_secreto(secreto, fila.get("pin_hash")):
        fail("Cédula o contraseña incorrectas.", 401)

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


@router.post("/paciente/recuperar", response_model=RecuperarPasswordResponse)
def recuperar_password(
    datos: RecuperarPasswordRequest,
    request: Request,
) -> RecuperarPasswordResponse:
    """Genera un código de 6 dígitos si la cédula y el correo coinciden.

    Sin SMTP configurado el código se envía igualmente por la respuesta solo
    en desarrollo (ENVIRONMENT != production); en producción va por correo.
    """
    if not _rate_limit_auth(f"auth:{request.client.host}"):
        fail("Demasiados intentos. Intente nuevamente más tarde.", status.HTTP_429_TOO_MANY_REQUESTS)

    minutos = settings.RECUPERACION_EXPIRACION_MINUTOS
    mensaje_generico = (
        "Si la cédula y el correo coinciden con una cuenta registrada, "
        f"recibirá un código de 6 dígitos válido por {minutos} minutos."
    )
    try:
        fila = _buscar_paciente(datos.cedula.strip())
    except HTTPException:
        fila = None
    email_registrado = ((fila or {}).get("email") or "").strip().lower()
    if not fila or not email_registrado or email_registrado != datos.email.strip().lower():
        return RecuperarPasswordResponse(
            mensaje=mensaje_generico,
            expira_minutos=minutos,
            codigo_desarrollo=None,
        )

    codigo = generar_codigo()
    expira = datetime.now(timezone.utc) + timedelta(minutes=minutos)
    try:
        # Solo un código válido por paciente: los anteriores quedan invalidados.
        supabase.table("recuperacion_pacientes").update(
            {"usado": True}
        ).eq("paciente_id", fila["id"]).eq("usado", False).execute()
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
        minutos,
        fila["email"],
    )
    return RecuperarPasswordResponse(
        mensaje=mensaje_generico,
        expira_minutos=minutos,
        codigo_desarrollo=None if (settings.es_produccion or enviado) else codigo,
    )


@router.post("/paciente/reset", response_model=HistoriaClinicaResponse)
def reset_password(
    datos: ResetPasswordRequest,
    request: Request,
) -> HistoriaClinicaResponse:
    """Valida el código recibido y restablece la contraseña del paciente."""
    if not _rate_limit_auth(f"auth:{request.client.host}"):
        fail("Demasiados intentos. Intente nuevamente más tarde.", status.HTTP_429_TOO_MANY_REQUESTS)
    secreto = datos.password.strip()
    if not secreto:
        fail("Indique la nueva contraseña.")
    if not (6 <= len(secreto) <= 64):
        fail("La contraseña debe tener entre 6 y 64 caracteres.")

    try:
        fila = _buscar_paciente(datos.cedula.strip())
    except HTTPException:
        fail("Código inválido o expirado. Solicite uno nuevo.")
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

    try:
        supabase.table("recuperacion_pacientes").update({"usado": True}).eq(
            "id", valido["id"]
        ).execute()
        supabase.table("historias_clinicas").update(
            {"pin_hash": hash_secreto(secreto)}
        ).eq("id", fila["id"]).execute()
    except Exception:
        db_fail("restablecer la contraseña")

    return _a_historia(fila)