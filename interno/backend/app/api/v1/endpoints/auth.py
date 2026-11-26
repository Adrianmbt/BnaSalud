"""Autenticación interna: login por usuario y contraseña (bcrypt) con emisión de JWT.

Solo permite el ingreso a los módulos habilitados del sistema interno:
`recepcionista` -> Módulo de Recepción
`medico_emergencia` -> Módulo de Medicina de Emergencias
`medico` -> Módulo de Especialista
`historias_medicas` -> Módulo de Historia Clínica Integral (CITAB)
`jefe_farmacia` / `farmaceutico` -> Módulo de Farmacia e Insumos
`jefe_almacen` -> Módulo de Almacén del centro (uso exclusivo del sistema
interno: esta cuenta no puede iniciar sesión en el portal web público)
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.clinica import Clinica
from app.models.guardia import Guardia
from app.models.usuario import Personal, Usuario
from app.schemas.auth import LoginRequest, LoginResponse

router = APIRouter()

# Módulos internos disponibles y su rol en la base de datos.
MODULOS_INTERNOS = {
    "recepcionista": "recepcion",
    "medico_emergencia": "emergency",
    "medico": "especialista",
    "historias_medicas": "historias_medicas",
    "jefe_farmacia": "farmacia",
    "jefe_almacen": "almacen",
    "farmaceutico": "farmacia",
    "admin_sistemas": "admin_sistemas",
    "recursos_humanos": "recursos_humanos",
    "director": "director",
}


def _crear_token(
    username: str,
    rol: str,
    personal_id: Optional[int],
    clinica_id: Optional[int] = None,
    clinica_nombre: Optional[str] = None,
) -> str:
    """Genera un JWT firmado con la expiración configurada."""
    exp = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_EXPIRACION_MINUTOS
    )
    payload = {
        "sub": username,
        "rol": rol,
        "personal_id": personal_id,
        "clinica_id": clinica_id,
        "clinica_nombre": clinica_nombre,
        "exp": exp,
    }
    return jwt.encode(
        payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
    )


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Autentica al usuario y devuelve el rol para enrutar la interfaz",
)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    username = payload.username.strip().lower()
    password = payload.password

    stmt = select(Usuario).where(Usuario.username == username)
    result = await db.execute(stmt)
    usuario = result.scalar_one_or_none()

    if not usuario or not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas o usuario inactivo.",
        )

    if usuario.rol not in MODULOS_INTERNOS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este rol no tiene acceso al módulo interno.",
        )

    # Verificar contraseña (hash bcrypt almacenado en la tabla usuarios)
    try:
        valida = bcrypt.checkpw(password.encode("utf-8"), usuario.password_hash.encode("utf-8"))
    except ValueError:
        valida = False

    if not valida:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas o usuario inactivo.",
        )

    await _verificar_guardia_emergencia(db, usuario)
    return await _armar_sesion(db, usuario)


async def _verificar_guardia_emergencia(db: AsyncSession, usuario: Usuario) -> None:
    """Solo el médico de emergencia con guardia ACTIVA que cubra HOY puede
    ingresar al módulo de emergencia (la guardia la gestiona recepción).
    La guardia puede haberse iniciado ayer (turno nocturno/24h que cruza medianoche)."""
    if usuario.rol != "medico_emergencia":
        return
    guardia = (
        await db.execute(
            select(func.count()).select_from(Guardia).where(
                Guardia.medico_id == usuario.personal_id,
                Guardia.fecha.in_([func.current_date(), func.current_date() - 1]),
                Guardia.estado == "ACTIVA",
            )
        )
    ).scalar_one()
    if not guardia:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene una guardia activa asignada para hoy. "
                   "Solo el médico de emergencia de guardia puede ingresar. "
                   "Solicite a recepción que inicie su guardia.",
        )


async def _armar_sesion(db: AsyncSession, usuario: Usuario) -> LoginResponse:
    """Datos de sesión que consume la interfaz (rol ya mapeado, nombre y centro)."""
    # Nombre de la persona vinculada (tabla personal) para mostrar en la UI.
    nombre = f"Usuario: {usuario.username}"
    especialidad = None
    clinica_id = None
    clinica_code = None
    clinica_nombre = None

    # 1) Intentar resolver clinica_id desde personal_id (usuarios con vínculo a personal)
    if usuario.personal_id is not None:
        try:
            fila = (await db.execute(
                select(
                    Personal.nombre,
                    Personal.apellido,
                    Personal.especialidad,
                    Personal.clinica_id,
                ).where(Personal.id == usuario.personal_id)
            )).first()
            if fila and fila[0]:
                nombre = (fila[0] + (" " + fila[1] if fila[1] else "")).strip()
            especialidad = fila[2] if fila else None
            clinica_id = fila[3] if fila else None
        except Exception:
            nombre = f"Usuario: {usuario.username}"
            especialidad = None
            clinica_id = None

    # 2) Si no se obtuvo clinica_id de personal, usar el de usuarios (usuarios locales)
    if clinica_id is None and usuario.clinica_id is not None:
        clinica_id = usuario.clinica_id

    # 3) Fallback: usar el CLINICA_ID / CENTRO_ID configurado en el entorno para esta sede
    if clinica_id is None and settings.id_centro is not None:
        clinica_id = settings.id_centro

    # 4) Resolver nombre del centro y código
    if clinica_id is not None:
        try:
            clinica = (await db.execute(
                select(Clinica).where(Clinica.id == clinica_id)
            )).scalar_one_or_none()
            if clinica:
                clinica_nombre = clinica.nombre
                clinica_code = clinica.codigo
        except Exception:
            pass

    token = _crear_token(
        usuario.username,
        usuario.rol,
        usuario.personal_id,
        clinica_id,
        clinica_nombre,
    )

    return LoginResponse(
        access_token=token,
        rol=MODULOS_INTERNOS[usuario.rol],
        username=usuario.username,
        nombre=nombre,
        personal_id=usuario.personal_id,
        especialidad=especialidad,
        clinica_id=clinica_id,
        clinica_code=clinica_code,
        clinica_nombre=clinica_nombre,
    )


@router.get(
    "/sesion",
    response_model=LoginResponse,
    summary="Revalida el token guardado y devuelve el rol vigente",
)
async def sesion_actual(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> LoginResponse:
    """La app restauraba el rol guardado en el dispositivo y nunca lo revalidaba:
    si Administración cambiaba el rol del usuario (o se cerraba su guardia), la
    sesión abierta seguía mostrando la interfaz anterior. Al arrancar se consulta
    aquí para pintar el módulo correcto o volver al login."""
    usuario = (
        await db.execute(select(Usuario).where(Usuario.username == user.get("sub", "")))
    ).scalar_one_or_none()
    if not usuario or not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión ya no es válida: el usuario fue desactivado o eliminado.",
        )
    if usuario.rol not in MODULOS_INTERNOS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este rol no tiene acceso al módulo interno.",
        )
    await _verificar_guardia_emergencia(db, usuario)
    return await _armar_sesion(db, usuario)
