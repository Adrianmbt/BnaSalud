"""Cuentas globales del portal público (fase 2).

El panel de soporte (`admin_sistemas`) administra todas las cuentas
institucionales, tanto de sistemas como de dirección. Las cuentas no se
borran: se desactivan y el cambio queda en la bitácora. Nunca se puede
desactivar la propia cuenta ni la última activa de un rol.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, status

from app.api.v1.deps import ROLES_GLOBALES, exigir_admin_sistemas
from app.api.v1.errors import db_fail, fail, not_found
from app.core.bitacora import registrar_accion
from app.core.database import supabase
from app.core.security import hash_secreto
from app.schemas.schemas import (
    UsuarioGlobalCreate,
    UsuarioGlobalResponse,
    UsuarioGlobalUpdate,
)

router = APIRouter(tags=["Usuarios globales"])

CAMPOS = "id, username, rol, personal_id, activo, created_at"


def _nombres_personal(ids: List[int]) -> Dict[int, str]:
    if not ids:
        return {}
    try:
        filas = (
            supabase.table("personal")
            .select("id, nombre, apellido")
            .in_("id", ids)
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


def _a_respuesta(fila: Dict[str, Any], nombres: Dict[int, str]) -> UsuarioGlobalResponse:
    return UsuarioGlobalResponse(
        id=fila["id"],
        username=fila["username"],
        rol=fila["rol"],
        nombre=nombres.get(fila.get("personal_id"), "") or fila["username"],
        activo=bool(fila.get("activo", True)),
        personal_id=fila.get("personal_id"),
        created_at=fila.get("created_at"),
    )


def _validar_desactivacion(
    actor: Dict[str, Any],
    fila: Dict[str, Any],
    activo: bool,
    activos_del_rol: int,
) -> None:
    """Impide dejar el sistema sin acceso o quedarse fuera a uno mismo."""
    if activo or not bool(fila.get("activo", True)):
        return
    if fila["username"] == actor.get("username"):
        fail("No puede desactivar su propia cuenta.", status.HTTP_409_CONFLICT)
    if activos_del_rol <= 1:
        fail(
            f"No puede desactivar la última cuenta activa de {fila['rol']}.",
            status.HTTP_409_CONFLICT,
        )


def _buscar(usuario_id: str) -> Dict[str, Any]:
    try:
        filas = (
            supabase.table("usuarios")
            .select(CAMPOS)
            .eq("id", usuario_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except Exception:
        not_found("Cuenta")
    if not filas:
        not_found("Cuenta")
    return filas[0]


def _activos(rol: str) -> int:
    try:
        res = (
            supabase.table("usuarios")
            .select("id", count="exact", head=True)
            .eq("rol", rol)
            .eq("activo", True)
            .execute()
        )
        return res.count or 0
    except Exception:
        db_fail("verificar las cuentas activas")


@router.get("", response_model=List[UsuarioGlobalResponse])
def listar_usuarios(_: dict = Depends(exigir_admin_sistemas)) -> List[UsuarioGlobalResponse]:
    """Cuentas globales con su nombre real (si tienen ficha de personal)."""
    try:
        filas = (
            supabase.table("usuarios")
            .select(CAMPOS)
            .in_("rol", list(ROLES_GLOBALES))
            .order("username")
            .execute()
            .data
            or []
        )
    except Exception:
        db_fail("consultar las cuentas globales")
    nombres = _nombres_personal([f["personal_id"] for f in filas if f.get("personal_id")])
    return [_a_respuesta(f, nombres) for f in filas]


@router.post("", response_model=UsuarioGlobalResponse, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    payload: UsuarioGlobalCreate,
    actor: dict = Depends(exigir_admin_sistemas),
) -> UsuarioGlobalResponse:
    """Crea una cuenta institucional de sistemas o de dirección."""
    username = payload.username.strip().lower()
    try:
        existente = (
            supabase.table("usuarios").select("id").eq("username", username).limit(1).execute().data
            or []
        )
    except Exception:
        db_fail("verificar el nombre de usuario")
    if existente:
        fail("Ese nombre de usuario ya está en uso.", status.HTTP_409_CONFLICT)

    try:
        creada = (
            supabase.table("usuarios")
            .insert(
                {
                    "username": username,
                    "password_hash": hash_secreto(payload.password),
                    "rol": payload.rol,
                    "activo": True,
                }
            )
            .execute()
            .data[0]
        )
    except Exception:
        db_fail("crear la cuenta")
    registrar_accion(
        actor, "crear_usuario_global", "usuarios", creada["id"],
        detalle=f"{username} ({payload.rol})",
    )
    return _a_respuesta(creada, {})


@router.patch("/{usuario_id}", response_model=UsuarioGlobalResponse)
def actualizar_usuario(
    usuario_id: str,
    payload: UsuarioGlobalUpdate,
    actor: dict = Depends(exigir_admin_sistemas),
) -> UsuarioGlobalResponse:
    """Restablece la contraseña o activa/desactiva (borrado lógico) una cuenta."""
    fila = _buscar(usuario_id)

    cambios: Dict[str, Any] = {}
    detalle: List[str] = []
    if payload.password:
        cambios["password_hash"] = hash_secreto(payload.password)
        detalle.append("contraseña restablecida")
    if payload.activo is not None and payload.activo != bool(fila.get("activo", True)):
        _validar_desactivacion(actor, fila, payload.activo, _activos(fila["rol"]))
        cambios["activo"] = payload.activo
        detalle.append(f"activo={payload.activo}")
    if not cambios:
        fail("Indique una contraseña nueva o un cambio de estado.")

    try:
        actualizada = (
            supabase.table("usuarios")
            .update(cambios)
            .eq("id", usuario_id)
            .execute()
            .data[0]
        )
    except Exception:
        db_fail("actualizar la cuenta")
    registrar_accion(
        actor, "actualizar_usuario_global", "usuarios", usuario_id,
        detalle=f"{fila['username']}: {', '.join(detalle)}",
    )
    return _a_respuesta(actualizada, _nombres_personal(
        [actualizada["personal_id"]] if actualizada.get("personal_id") else []
    ))
