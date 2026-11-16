"""Panel de soporte técnico (rol `admin_sistemas`).

Solo datos de operación: bitácora, nómina y estado de las instalaciones.
Nada clínico. Lo del sistema interno llega a Supabase con el agente
`scripts/sincronizar_interno.py`; aquí solo se lee el espejo.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.v1.deps import exigir_admin_sistemas
from app.core.config import settings
from app.core.database import supabase

router = APIRouter(tags=["Soporte"])

MINUTOS_SIN_SENAL = 15
ORIGENES = ("web", "interno", "sistema")


def _fecha(valor: Any) -> Optional[datetime]:
    """Convierte un timestamp de Supabase/Postgres a datetime UTC."""
    if not valor:
        return None
    try:
        fecha = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
    except ValueError:
        return None
    return fecha if fecha.tzinfo else fecha.replace(tzinfo=timezone.utc)


def _contar(tabla: str) -> Optional[int]:
    """Cantidad de filas, o None si la tabla aún no existe."""
    try:
        res = supabase.table(tabla).select("id", count="exact", head=True).execute()
        return res.count or 0
    except Exception:
        return None


@router.get("/estado")
def estado_sistema(_: dict = Depends(exigir_admin_sistemas)) -> Dict[str, Any]:
    """Salud de la web, último latido de cada instalación y volumen de datos."""
    inicio = time.perf_counter()
    db_ok = True
    try:
        supabase.table("clinicas").select("id").limit(1).execute()
    except Exception:
        db_ok = False
    latencia = round((time.perf_counter() - inicio) * 1000)

    try:
        instalaciones = (
            supabase.table("estado_instalaciones")
            .select("*")
            .order("nombre")
            .execute()
            .data
            or []
        )
    except Exception:
        instalaciones = []

    ahora = datetime.now(timezone.utc)
    for instalacion in instalaciones:
        ultimo = _fecha(instalacion.get("ultimo_ping"))
        segundos = int((ahora - ultimo).total_seconds()) if ultimo else None
        instalacion["segundos_desde_ping"] = segundos
        instalacion["estado"] = (
            "en_linea"
            if segundos is not None and segundos <= MINUTOS_SIN_SENAL * 60
            else "sin_senal"
        )

    return {
        "web": {
            "ok": db_ok,
            "latencia_ms": latencia,
            "version": settings.VERSION,
            "entorno": settings.ENVIRONMENT,
            "hora": ahora.isoformat(),
        },
        "sincronizacion": {
            "personal": _contar("interno_personal"),
            "usuarios": _contar("interno_usuarios"),
            "bitacora": _contar("interno_bitacora"),
            "logs": _contar("interno_logs"),
            "portada": _contar("bitacora_acciones"),
        },
        "instalaciones": instalaciones,
    }


def _logs_web(limite: int) -> List[Dict[str, Any]]:
    try:
        filas = (
            supabase.table("bitacora_acciones")
            .select("id, username, rol, accion, entidad, entidad_id, detalle, creado_en")
            .order("creado_en", desc=True)
            .limit(limite)
            .execute()
            .data
            or []
        )
    except Exception:
        return []
    return [
        {
            "id": f"web-{f['id']}",
            "origen": "web",
            "nivel": "INFO",
            "username": f.get("username") or "",
            "rol": f.get("rol") or "",
            "accion": f.get("accion") or "",
            "mensaje": f.get("accion") or "",
            "entidad": f.get("entidad") or "",
            "detalle": f.get("detalle") or "",
            "fecha": _fecha(f.get("creado_en")),
        }
        for f in filas
    ]


def _logs_internos(limite: int) -> List[Dict[str, Any]]:
    try:
        filas = (
            supabase.table("interno_bitacora")
            .select("id, username, rol, accion, entidad, entidad_id, detalle, creado_en")
            .order("creado_en", desc=True)
            .limit(limite)
            .execute()
            .data
            or []
        )
    except Exception:
        return []
    return [
        {
            "id": f"interno-{f['id']}",
            "origen": "interno",
            "nivel": "INFO",
            "username": f.get("username") or "",
            "rol": f.get("rol") or "",
            "accion": f.get("accion") or "",
            "mensaje": f.get("accion") or "",
            "entidad": f.get("entidad") or "",
            "detalle": f.get("detalle") or "",
            "fecha": _fecha(f.get("creado_en")),
        }
        for f in filas
    ]


def _logs_sistema(limite: int) -> List[Dict[str, Any]]:
    try:
        filas = (
            supabase.table("interno_logs")
            .select("id, nivel, mensaje, fuente, detalle, creado_en")
            .order("creado_en", desc=True)
            .limit(limite)
            .execute()
            .data
            or []
        )
    except Exception:
        return []
    return [
        {
            "id": f"sistema-{f['id']}",
            "origen": "sistema",
            "nivel": (f.get("nivel") or "INFO").upper(),
            "username": "",
            "rol": "",
            "accion": f.get("fuente") or "",
            "mensaje": f.get("mensaje") or "",
            "entidad": "",
            "detalle": f.get("detalle") or "",
            "fecha": _fecha(f.get("creado_en")),
        }
        for f in filas
    ]


@router.get("/logs")
def consultar_logs(
    origen: str = Query("todo", description="todo | web | interno | sistema"),
    texto: str = Query("", max_length=80),
    limite: int = Query(100, ge=1, le=300),
    _: dict = Depends(exigir_admin_sistemas),
) -> Dict[str, Any]:
    """Bitácora unificada: web pública, acciones internas y logs del sistema."""
    if origen not in ORIGENES and origen != "todo":
        origen = "todo"

    fuentes = []
    if origen in ("todo", "web"):
        fuentes += _logs_web(limite)
    if origen in ("todo", "interno"):
        fuentes += _logs_internos(limite)
    if origen in ("todo", "sistema"):
        fuentes += _logs_sistema(limite)

    buscado = texto.strip().lower()
    if buscado:
        fuentes = [
            f
            for f in fuentes
            if buscado
            in " ".join(
                str(f.get(campo) or "")
                for campo in ("username", "accion", "mensaje", "entidad", "detalle")
            ).lower()
        ]

    fuentes.sort(
        key=lambda f: f.get("fecha") or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    registros = fuentes[:limite]

    return {
        "registros": [
            {**r, "fecha": r["fecha"].isoformat() if r.get("fecha") else ""}
            for r in registros
        ],
        "total_filtrado": len(fuentes),
        "disponible": {
            "web": True,
            "interno": _contar("interno_bitacora") is not None,
            "sistema": _contar("interno_logs") is not None,
        },
    }


@router.get("/nomina")
def consultar_nomina(
    texto: str = Query("", max_length=80),
    centro_id: Optional[int] = None,
    limite: int = Query(300, ge=1, le=500),
    _: dict = Depends(exigir_admin_sistemas),
) -> Dict[str, Any]:
    """Nómina sincronizada desde el Postgres del sistema interno (solo lectura)."""
    try:
        query = supabase.table("interno_personal").select(
            "id, cedula, nombre, apellido, cargo, clinica_id, email, especialidad, "
            "estado, status, telefono, actualizado_en"
        )
        if centro_id is not None:
            query = query.eq("clinica_id", centro_id)
        filas = query.order("apellido").limit(limite).execute().data or []
    except Exception:
        return {"disponible": False, "personal": [], "actualizado_en": ""}

    buscado = texto.strip().lower()
    if buscado:
        filas = [
            f
            for f in filas
            if buscado
            in " ".join(
                str(f.get(campo) or "")
                for campo in ("cedula", "nombre", "apellido", "cargo", "especialidad", "email")
            ).lower()
        ]

    fechas = [f.get("actualizado_en") for f in filas if f.get("actualizado_en")]
    return {
        "disponible": True,
        "personal": filas,
        "actualizado_en": max(fechas) if fechas else "",
    }


@router.get("/usuarios-internos")
def consultar_usuarios_internos(
    texto: str = Query("", max_length=80),
    limite: int = Query(300, ge=1, le=500),
    _: dict = Depends(exigir_admin_sistemas),
) -> Dict[str, Any]:
    """Directorio de cuentas del sistema interno (sin contraseñas)."""
    try:
        filas = (
            supabase.table("interno_usuarios")
            .select("username, rol, personal_id, clinica_id, activo, actualizado_en")
            .order("username")
            .limit(limite)
            .execute()
            .data
            or []
        )
    except Exception:
        return {"disponible": False, "usuarios": []}

    ids = [f["personal_id"] for f in filas if f.get("personal_id")]
    nombres: Dict[int, str] = {}
    if ids:
        try:
            personal = (
                supabase.table("interno_personal")
                .select("id, nombre, apellido")
                .in_("id", ids)
                .execute()
                .data
                or []
            )
            nombres = {
                p["id"]: f"{p.get('nombre', '')} {p.get('apellido', '')}".strip()
                for p in personal
            }
        except Exception:
            nombres = {}

    buscado = texto.strip().lower()
    usuarios = [
        {
            "username": f["username"],
            "rol": f["rol"],
            "nombre": nombres.get(f.get("personal_id"), "") or f["username"],
            "clinica_id": f.get("clinica_id"),
            "activo": bool(f.get("activo", True)),
            "actualizado_en": f.get("actualizado_en") or "",
        }
        for f in filas
    ]
    if buscado:
        usuarios = [
            u
            for u in usuarios
            if buscado in f"{u['username']} {u['nombre']} {u['rol']}".lower()
        ]

    return {"disponible": True, "usuarios": usuarios}
