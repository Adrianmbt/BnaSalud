"""Almacén central: órdenes de entrega del Director y stock por centro.

El Director (o Administración General) despacha medicamentos e insumos del
catálogo maestro hacia un centro de salud; la orden queda en
`pendiente_recepcion` hasta que el Jefe de Almacén la recibe. Puede recibirla
en el sistema interno (que suma a su `almacen_stock` local y lo empuja aquí) o
confirmarla por API (`POST /ordenes-entrega/{id}/confirmar-recepcion`), que
ejecuta `recibir_orden_entrega()` en Supabase: estado, `inventario_centro`,
`almacen_stock` y movimiento ENTRADA en una sola transacción.
"""
from __future__ import annotations

import re
import unicodedata
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.v1.deps import exigir_rol_global
from app.api.v1.errors import db_fail, fail, not_found
from app.core.bitacora import registrar_accion
from app.core.database import supabase

router = APIRouter(tags=["Almacén"])
router_ordenes = APIRouter(tags=["Órdenes de entrega"])


# ─── Utilidades ────────────────────────────────────────────────────

def _slug(texto: str) -> str:
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFKD", texto or "")
        if not unicodedata.combining(c)
    )
    limpio = re.sub(r"[^a-z0-9]+", "-", sin_tildes.lower()).strip("-")
    return limpio or "sin-nombre"


def _item_key(tipo: str, nombre: str) -> str:
    """Misma clave que el sistema interno: `tipo:slug-del-nombre`."""
    return f"{(tipo or 'medicamento').lower()}:{_slug(nombre)}"


def _consultar(tabla: str, select: str = "*", **filtros) -> list[dict]:
    try:
        consulta = supabase.table(tabla).select(select)
        for campo, valor in filtros.items():
            consulta = consulta.eq(campo, valor)
        return consulta.execute().data or []
    except Exception:
        db_fail("consultar el almacén")


# ─── Schemas ───────────────────────────────────────────────────────

class OrdenItemCreate(BaseModel):
    insumo_id: UUID
    cantidad: int = Field(..., gt=0, le=100000)
    lote: Optional[str] = Field(default=None, max_length=60)
    fecha_vencimiento: Optional[date] = None


class OrdenCreate(BaseModel):
    centro_id: int = Field(..., ge=1)
    observacion: Optional[str] = Field(None, max_length=300)
    items: list[OrdenItemCreate] = Field(..., min_length=1)


# ─── Stock ─────────────────────────────────────────────────────────

@router.get("/stock")
def stock_por_centro(
    centro_id: Optional[int] = Query(default=None, ge=1),
    _: dict = Depends(exigir_rol_global),
) -> dict:
    """Existencias consolidadas por centro (las escribe el sistema interno)."""
    filtros = {"clinica_id": centro_id} if centro_id else {}
    filas = _consultar("almacen_stock", "*", **filtros)
    filas.sort(key=lambda f: (f.get("nombre") or "").lower())
    for fila in filas:
        fila["bajo_minimo"] = int(fila.get("cantidad") or 0) <= 5
    return {"items": filas, "centro_id": centro_id}


@router.get("/ordenes")
def listar_ordenes(
    centro_id: Optional[int] = Query(default=None, ge=1),
    estado: Optional[str] = Query(default=None, pattern="^(pendiente_recepcion|recibida|cancelada)$"),
    _: dict = Depends(exigir_rol_global),
) -> dict:
    filtros: dict = {}
    if centro_id:
        filtros["centro_id"] = centro_id
    if estado:
        filtros["estado"] = estado
    ordenes = _consultar("ordenes_entrega", "*", **filtros)
    ordenes.sort(key=lambda o: o.get("creada_en") or "", reverse=True)

    ids = [o["id"] for o in ordenes]
    items: list[dict] = []
    if ids:
        try:
            items = (
                supabase.table("ordenes_entrega_items")
                .select("*")
                .in_("orden_id", ids)
                .execute()
                .data
                or []
            )
        except Exception:
            db_fail("consultar las órdenes de entrega")
    por_orden: dict[str, list[dict]] = {}
    for it in items:
        por_orden.setdefault(it["orden_id"], []).append(it)
    for orden in ordenes:
        orden["items"] = sorted(por_orden.get(orden["id"], []), key=lambda i: i.get("nombre") or "")
    return {"items": ordenes}


def _tipo_de(categoria: str) -> str:
    """El sistema interno solo distingue medicamento/insumo."""
    return "medicamento" if categoria == "Medicamento" else "insumo"


def _productos(ids: list[str]) -> dict[str, dict]:
    """Catálogo de los IDs pedidos; falla si falta alguno o está inactivo."""
    try:
        filas = (
            supabase.table("catalogo_insumos")
            .select("id, nombre, categoria, unidad_medida, activo")
            .in_("id", ids)
            .execute()
            .data
            or []
        )
    except Exception:
        db_fail("consultar el catálogo")
    por_id = {f["id"]: f for f in filas}
    if len(por_id) != len(ids):
        fail("Uno de los productos ya no existe en el catálogo.")
    inactivos = [por_id[i]["nombre"] for i in ids if not por_id[i].get("activo", True)]
    if inactivos:
        fail(f"El producto «{inactivos[0]}» está inactivo en el catálogo.")
    return por_id


@router_ordenes.post("", status_code=status.HTTP_201_CREATED)
def crear_orden(
    payload: OrdenCreate,
    usuario: dict = Depends(exigir_rol_global),
) -> dict:
    """Genera una Orden de Entrega hacia un centro de salud."""
    centros = _consultar("clinicas", "id, nombre", id=payload.centro_id)
    if not centros:
        fail("El centro de salud indicado no existe.")

    ids = [str(item.insumo_id) for item in payload.items]
    if len(ids) != len(set(ids)):
        fail("Hay productos repetidos: sume las cantidades en una sola línea.")
    productos = _productos(ids)

    creado_por = (
        f"{usuario.get('username') or usuario.get('rol')} · {usuario.get('rol')}"
    )
    filas: list[dict] = []
    orden_id: Optional[str] = None
    try:
        orden = (
            supabase.table("ordenes_entrega")
            .insert(
                {
                    "centro_id": payload.centro_id,
                    "observacion": (payload.observacion or "").strip() or None,
                    "creado_por": creado_por,
                    "estado": "pendiente_recepcion",
                }
            )
            .execute()
            .data
            or []
        )
        if not orden:
            raise RuntimeError("sin respuesta")
        orden_id = orden[0]["id"]
        for item in payload.items:
            producto = productos[str(item.insumo_id)]
            tipo = _tipo_de(producto["categoria"])
            filas.append(
                {
                    "orden_id": orden_id,
                    "insumo_id": str(item.insumo_id),
                    "tipo": tipo,
                    "item_key": _item_key(tipo, producto["nombre"]),
                    "nombre": producto["nombre"],
                    "unidad": producto.get("unidad_medida"),
                    "cantidad": item.cantidad,
                    "lote": (item.lote or "").strip() or None,
                    "fecha_vencimiento": (
                        item.fecha_vencimiento.isoformat()
                        if item.fecha_vencimiento
                        else None
                    ),
                }
            )
        supabase.table("ordenes_entrega_items").insert(filas).execute()
    except HTTPException:
        raise
    except Exception:
        # Sin transacción en PostgREST: si falla el detalle, no dejar la
        # cabecera huérfana (el borrado en cascada limpia lo insertado).
        if orden_id:
            try:
                supabase.table("ordenes_entrega").delete().eq("id", orden_id).execute()
            except Exception:
                pass
        db_fail("crear la orden de entrega")

    orden[0]["items"] = filas
    registrar_accion(
        usuario, "crear_orden_entrega", "ordenes_entrega", orden_id,
        detalle=f"{len(filas)} producto(s) → centro {payload.centro_id}",
    )
    return {"mensaje": "Orden de entrega creada.", "orden": orden[0]}


@router_ordenes.post("/{orden_id}/confirmar-recepcion")
def confirmar_recepcion(
    orden_id: str,
    usuario: dict = Depends(exigir_rol_global),
) -> dict:
    """Recepciona la orden y carga el stock del centro en una transacción."""
    try:
        orden = (
            supabase.table("ordenes_entrega")
            .select("id, numero, estado")
            .eq("id", orden_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except Exception:
        db_fail("consultar la orden de entrega")
    if not orden:
        not_found("Orden de entrega")
    if orden[0]["estado"] != "pendiente_recepcion":
        fail(
            "La orden ya fue recibida o cancelada.",
            status.HTTP_409_CONFLICT,
        )

    receptor = (
        f"{usuario.get('username') or usuario.get('rol')} · {usuario.get('rol')}"
    )
    try:
        resultado = supabase.rpc(
            "recibir_orden_entrega",
            {"p_orden_id": orden_id, "p_usuario": receptor},
        ).execute().data
    except Exception as error:
        mensaje = str(error).lower()
        if "ya fue procesada" in mensaje:
            fail("La orden ya fue recibida o cancelada.", status.HTTP_409_CONFLICT)
        if "no encontrada" in mensaje:
            not_found("Orden de entrega")
        db_fail("confirmar la recepción de la orden")

    registrar_accion(
        usuario, "recibir_orden_entrega", "ordenes_entrega", orden_id,
        detalle=f"Orden {orden[0].get('numero') or orden_id[:8]}",
    )
    return {
        "mensaje": "Recepción confirmada: el inventario del centro quedó actualizado.",
        "resultado": resultado,
    }


@router.get("/movimientos")
def listar_movimientos(
    centro_id: Optional[int] = Query(default=None, ge=1),
    centro: Optional[int] = Query(default=None, ge=1, include_in_schema=False),
    limite: int = Query(default=50, ge=1, le=200),
    _: dict = Depends(exigir_rol_global),
) -> dict:
    """Entradas y consumos reportados por el sistema interno."""
    objetivo = centro_id or centro
    filtros = {"clinica_id": objetivo} if objetivo else {}
    filas = _consultar("almacen_movimientos", "*", **filtros)
    filas.sort(key=lambda f: f.get("creado_en") or "", reverse=True)
    return {"items": filas[:limite]}


@router.get("/resumen")
def resumen_almacen(_: dict = Depends(exigir_rol_global)) -> dict:
    """Totales de inventario por centro para el panel ejecutivo."""
    filas = _consultar("almacen_stock", "clinica_id, cantidad")
    totales: dict[str, int] = {}
    for fila in filas:
        clave = str(fila.get("clinica_id"))
        totales[clave] = totales.get(clave, 0) + int(fila.get("cantidad") or 0)
    pendientes = _consultar("ordenes_entrega", "id", estado="pendiente_recepcion")
    return {
        "unidades_por_centro": totales,
        "ordenes_pendientes": len(pendientes),
    }
