"""Almacén del centro de salud: órdenes de entrega e inventario.

Acceso exclusivo del Jefe de Almacén (`jefe_almacen`) del sistema interno;
`admin_sistemas` y `director` pueden supervisar cualquier centro.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_roles
from app.services import almacen as svc

router = APIRouter(tags=["Almacén"])

_ROLES_ALMACEN = ("jefe_almacen", "admin_sistemas", "director")


class SalidaRequest(BaseModel):
    item_key: str = Field(..., min_length=1, max_length=180)
    cantidad: int = Field(..., gt=0, le=100000)
    motivo: Optional[str] = Field(None, max_length=200)


def _resolver_centro(user: dict, clinica_id: Optional[int] = None) -> int:
    """El Jefe de Almacén opera su centro; admin/director pueden indicar otro."""
    if user.get("rol") in ("admin_sistemas", "director"):
        centro = clinica_id or user.get("clinica_id")
        if not centro:
            raise HTTPException(400, "Indique clinica_id del centro a consultar.")
        return int(centro)
    centro = user.get("clinica_id")
    if not centro:
        raise HTTPException(
            400,
            "Su usuario no tiene un centro de salud asignado. "
            "Solicite a Administración de Sistemas que lo asigne.",
        )
    return int(centro)


# ─── Resumen ───────────────────────────────────────────────────────

@router.get("/resumen")
async def resumen_almacen(
    clinica_id: Optional[int] = Query(default=None),
    user: dict = Depends(require_roles(*_ROLES_ALMACEN)),
    db: AsyncSession = Depends(get_db),
):
    """KPIs del centro: órdenes pendientes, productos y sincronización."""
    await svc.asegurar_tablas(db)
    centro = _resolver_centro(user, clinica_id)
    ordenes = await svc.listar_ordenes(db, centro, "pendiente_recepcion")
    stock = await svc.listar_stock(db, centro)
    return {
        "clinica_id": centro,
        "ordenes_pendientes": len(ordenes),
        "productos": len(stock),
        "unidades": sum(int(s["cantidad"]) for s in stock),
        "bajo_minimo": sum(1 for s in stock if s["bajo_minimo"]),
        "sync": await svc.estado_sync(db),
    }


# ─── Órdenes de entrega ────────────────────────────────────────────

@router.get("/ordenes")
async def listar_ordenes(
    estado: Optional[str] = Query(default=None, pattern="^(pendiente_recepcion|recibida|cancelada)$"),
    clinica_id: Optional[int] = Query(default=None),
    sincronizar: bool = Query(default=False, description="Trae órdenes nuevas del portal antes de listar"),
    user: dict = Depends(require_roles(*_ROLES_ALMACEN)),
    db: AsyncSession = Depends(get_db),
):
    await svc.asegurar_tablas(db)
    centro = _resolver_centro(user, clinica_id)
    if sincronizar:
        try:
            await svc.sincronizar(db, centro)
        except Exception:  # el listado local sigue funcionando sin internet
            await db.rollback()
    return {"items": await svc.listar_ordenes(db, centro, estado), "clinica_id": centro}


@router.post("/ordenes/{orden_id}/recibir")
async def marcar_recibida(
    orden_id: str,
    user: dict = Depends(require_roles(*_ROLES_ALMACEN)),
    db: AsyncSession = Depends(get_db),
):
    """Suma las cantidades al inventario del centro y cierra la orden."""
    await svc.asegurar_tablas(db)
    try:
        resultado = await svc.recibir_orden(db, orden_id, user.get("username") or "almacen")
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return resultado


# ─── Inventario ────────────────────────────────────────────────────

@router.get("/stock")
async def listar_stock(
    clinica_id: Optional[int] = Query(default=None),
    user: dict = Depends(require_roles(*_ROLES_ALMACEN)),
    db: AsyncSession = Depends(get_db),
):
    await svc.asegurar_tablas(db)
    centro = _resolver_centro(user, clinica_id)
    return {"items": await svc.listar_stock(db, centro), "clinica_id": centro}


@router.post("/salidas", status_code=status.HTTP_201_CREATED)
async def registrar_salida(
    payload: SalidaRequest,
    user: dict = Depends(require_roles(*_ROLES_ALMACEN)),
    db: AsyncSession = Depends(get_db),
):
    """Salida rápida por consumo diario (descuenta del centro)."""
    await svc.asegurar_tablas(db)
    centro = _resolver_centro(user)
    try:
        return await svc.registrar_salida(
            db,
            centro_id=centro,
            clave=payload.item_key,
            cantidad=payload.cantidad,
            motivo=payload.motivo,
            usuario=user.get("username") or "almacen",
        )
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc


@router.get("/movimientos")
async def listar_movimientos(
    limite: int = Query(default=60, ge=1, le=300),
    clinica_id: Optional[int] = Query(default=None),
    user: dict = Depends(require_roles(*_ROLES_ALMACEN)),
    db: AsyncSession = Depends(get_db),
):
    await svc.asegurar_tablas(db)
    centro = _resolver_centro(user, clinica_id)
    return {"items": await svc.listar_movimientos(db, centro, limite), "clinica_id": centro}


# ─── Sincronización ────────────────────────────────────────────────

@router.post("/sincronizar")
async def sincronizar(
    clinica_id: Optional[int] = Query(default=None),
    user: dict = Depends(require_roles(*_ROLES_ALMACEN)),
    db: AsyncSession = Depends(get_db),
):
    await svc.asegurar_tablas(db)
    centro = _resolver_centro(user, clinica_id)
    return await svc.sincronizar(db, centro)


@router.get("/estado-sync")
async def estado_sync(
    user: dict = Depends(require_roles(*_ROLES_ALMACEN)),
    db: AsyncSession = Depends(get_db),
):
    await svc.asegurar_tablas(db)
    return await svc.estado_sync(db)
