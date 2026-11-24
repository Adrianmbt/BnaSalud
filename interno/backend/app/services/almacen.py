"""Almacén del centro: órdenes de entrega del portal web e inventario local.

Réplica del patrón resiliente de `sincronizacion_portal.py`:

* El portal web (Supabase) es la fuente de las órdenes de entrega.
* El sistema interno guarda todo en PostgreSQL local y deja cada cambio de
  stock en `almacen_sync_outbox`. Esa cola se envía a Supabase cuando hay
  conexión, así que el centro puede seguir operando sin internet.
* El stock se identifica por `item_key` (`tipo:slug-del-nombre`), no por ID,
  porque los catálogos del portal y del interno son distintos.
"""
import json
import logging
import re
import unicodedata
from datetime import datetime
from typing import Iterable, Optional

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)

_TABLAS_ASEGURADAS = False


# ─── Utilidades ────────────────────────────────────────────────────

def _headers(prefer: str = "return=representation") -> dict:
    return {
        "apikey": settings.SUPABASE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


def _base_url() -> str:
    return settings.SUPABASE_URL.rstrip("/")


def supabase_configurado() -> bool:
    return bool(settings.SUPABASE_URL and settings.SUPABASE_KEY)


def slug(texto: str) -> str:
    """Normaliza un nombre de producto para usarlo como clave estable."""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFKD", texto or "") if not unicodedata.combining(c)
    )
    limpio = re.sub(r"[^a-z0-9]+", "-", sin_tildes.lower()).strip("-")
    return limpio or "sin-nombre"


def item_key(tipo: str, nombre: str) -> str:
    return f"{(tipo or 'medicamento').lower()}:{slug(nombre)}"


async def asegurar_tablas(db: AsyncSession) -> None:
    """Crea las tablas del almacén si la migración 022 no se aplicó aún."""
    global _TABLAS_ASEGURADAS
    if _TABLAS_ASEGURADAS:
        return
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS ordenes_entrega (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            remota_id text UNIQUE,
            numero text,
            centro_id integer NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
            estado text NOT NULL DEFAULT 'pendiente_recepcion'
                CHECK (estado IN ('pendiente_recepcion', 'recibida', 'cancelada')),
            observacion text,
            creada_por text,
            creada_en timestamptz,
            recibida_por text,
            recibida_en timestamptz,
            created_at timestamptz NOT NULL DEFAULT now()
        )
    """))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS ordenes_entrega_items (
            id serial PRIMARY KEY,
            orden_id uuid NOT NULL REFERENCES ordenes_entrega(id) ON DELETE CASCADE,
            tipo text NOT NULL DEFAULT 'medicamento'
                CHECK (tipo IN ('medicamento', 'insumo')),
            item_key text NOT NULL,
            nombre text NOT NULL,
            unidad text,
            cantidad integer NOT NULL CHECK (cantidad > 0),
            cantidad_recibida integer
        )
    """))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS almacen_stock (
            clinica_id integer NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
            item_key text NOT NULL,
            tipo text NOT NULL DEFAULT 'medicamento'
                CHECK (tipo IN ('medicamento', 'insumo')),
            nombre text NOT NULL,
            unidad text,
            cantidad integer NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
            stock_minimo integer NOT NULL DEFAULT 5,
            actualizado_en timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (clinica_id, item_key)
        )
    """))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS almacen_movimientos (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            clinica_id integer NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
            tipo text NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
            item_key text NOT NULL,
            nombre text NOT NULL,
            cantidad integer NOT NULL,
            referencia text,
            usuario text,
            origen text NOT NULL DEFAULT 'interno',
            sincronizado boolean NOT NULL DEFAULT false,
            created_at timestamptz NOT NULL DEFAULT now()
        )
    """))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS almacen_sync_outbox (
            id bigserial PRIMARY KEY,
            entidad text NOT NULL,
            operacion text NOT NULL,
            payload jsonb NOT NULL,
            intentos integer NOT NULL DEFAULT 0,
            ultimo_error text,
            enviado_en timestamptz,
            created_at timestamptz NOT NULL DEFAULT now()
        )
    """))
    await db.commit()
    _TABLAS_ASEGURADAS = True


# ─── Órdenes de entrega ────────────────────────────────────────────

async def _guardar_orden_remota(db: AsyncSession, orden: dict, centro_id: int) -> int:
    """Inserta (idempotente por `remota_id`) una orden traída de Supabase."""
    remota = str(orden.get("id"))
    items = orden.get("ordenes_entrega_items") or orden.get("items") or []

    local_id = (
        await db.execute(
            text(
                "INSERT INTO ordenes_entrega "
                "(remota_id, numero, centro_id, estado, observacion, creada_por, creada_en) "
                "VALUES (:remota, :numero, :centro, :estado, :obs, :por, :en) "
                "ON CONFLICT (remota_id) DO NOTHING RETURNING id"
            ),
            {
                "remota": remota,
                "numero": orden.get("numero"),
                "centro": centro_id,
                "estado": orden.get("estado") or "pendiente_recepcion",
                "obs": orden.get("observacion"),
                "por": orden.get("creado_por"),
                "en": orden.get("creada_en") or orden.get("created_at"),
            },
        )
    ).scalar()

    if local_id is None:  # ya existía
        return 0

    for it in items:
        tipo = (it.get("tipo") or "medicamento").lower()
        nombre = it.get("nombre") or "Producto"
        await db.execute(
            text(
                "INSERT INTO ordenes_entrega_items "
                "(orden_id, tipo, item_key, nombre, unidad, cantidad) "
                "VALUES (:orden, :tipo, :clave, :nombre, :unidad, :cantidad)"
            ),
            {
                "orden": local_id,
                "tipo": tipo,
                "clave": it.get("item_key") or item_key(tipo, nombre),
                "nombre": nombre,
                "unidad": it.get("unidad"),
                "cantidad": int(it.get("cantidad") or 0),
            },
        )
    return 1


async def traer_ordenes_pendientes(db: AsyncSession, centro_id: int) -> int:
    """Descarga las órdenes en `pendiente_recepcion` destinadas al centro."""
    if not supabase_configurado():
        return 0
    params = {
        "centro_id": f"eq.{centro_id}",
        "estado": "eq.pendiente_recepcion",
        "select": "*,ordenes_entrega_items(*)",
        "order": "creada_en.asc",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{_base_url()}/rest/v1/ordenes_entrega", params=params, headers=_headers()
            )
            if resp.status_code != 200:
                logger.warning("Supabase órdenes: HTTP %s - %s", resp.status_code, resp.text[:200])
                return 0
            ordenes = resp.json() or []
    except Exception as exc:  # sin internet: se reintenta luego
        logger.info("Supabase inalcanzable al traer órdenes: %s", exc)
        return 0

    nuevas = 0
    for orden in ordenes:
        nuevas += await _guardar_orden_remota(db, orden, centro_id)
    if nuevas:
        await db.commit()
    return nuevas


async def listar_ordenes(db: AsyncSession, centro_id: int, estado: Optional[str] = None) -> list[dict]:
    where = "WHERE o.centro_id = :centro"
    params: dict = {"centro": centro_id}
    if estado:
        where += " AND o.estado = :estado"
        params["estado"] = estado

    ordenes = (await db.execute(text(f"""
        SELECT o.id, o.numero, o.estado, o.observacion, o.creada_por, o.creada_en,
               o.recibida_por, o.recibida_en
        FROM ordenes_entrega o
        {where}
        ORDER BY o.creada_en DESC NULLS LAST, o.created_at DESC
    """), params)).mappings().all()

    if not ordenes:
        return []

    ids = [o["id"] for o in ordenes]
    items = (await db.execute(text("""
        SELECT orden_id, tipo, item_key, nombre, unidad, cantidad, cantidad_recibida
        FROM ordenes_entrega_items
        WHERE orden_id = ANY(:ids)
        ORDER BY nombre
    """), {"ids": ids})).mappings().all()

    por_orden: dict = {}
    for it in items:
        por_orden.setdefault(str(it["orden_id"]), []).append(dict(it))

    salida = []
    for o in ordenes:
        fila = dict(o)
        fila["id"] = str(o["id"])
        fila["creada_en"] = str(o["creada_en"]) if o["creada_en"] else None
        fila["recibida_en"] = str(o["recibida_en"]) if o["recibida_en"] else None
        fila["items"] = por_orden.get(fila["id"], [])
        salida.append(fila)
    return salida


# ─── Inventario ────────────────────────────────────────────────────

async def _stock_actual(db: AsyncSession, centro_id: int, clave: str) -> int:
    valor = (
        await db.execute(
            text("SELECT cantidad FROM almacen_stock WHERE clinica_id = :c AND item_key = :k"),
            {"c": centro_id, "k": clave},
        )
    ).scalar()
    return int(valor or 0)


async def _ajustar_stock(
    db: AsyncSession,
    *,
    centro_id: int,
    tipo: str,
    clave: str,
    nombre: str,
    unidad: Optional[str],
    delta: int,
) -> int:
    """Suma (o resta) unidades y devuelve el stock resultante."""
    fila = (
        await db.execute(
            text(
                "INSERT INTO almacen_stock "
                "(clinica_id, item_key, tipo, nombre, unidad, cantidad, actualizado_en) "
                "VALUES (:c, :k, :t, :n, :u, GREATEST(0, :delta), now()) "
                "ON CONFLICT (clinica_id, item_key) DO UPDATE SET "
                "cantidad = GREATEST(0, almacen_stock.cantidad + :delta), "
                "nombre = EXCLUDED.nombre, "
                "unidad = COALESCE(EXCLUDED.unidad, almacen_stock.unidad), "
                "actualizado_en = now() "
                "RETURNING cantidad"
            ),
            {
                "c": centro_id,
                "k": clave,
                "t": tipo,
                "n": nombre,
                "u": unidad,
                "delta": delta,
            },
        )
    ).scalar()
    return int(fila or 0)


async def _encolar_stock(db: AsyncSession, centro_id: int, clave: str, tipo: str,
                         nombre: str, unidad: Optional[str], cantidad: int) -> None:
    """Deja el stock resultante en la cola hacia el portal web."""
    payload = {
        "clinica_id": centro_id,
        "item_key": clave,
        "tipo": tipo,
        "nombre": nombre,
        "unidad": unidad,
        "cantidad": cantidad,
        "actualizado_en": datetime.now().isoformat(),
    }
    await db.execute(
        text(
            "INSERT INTO almacen_sync_outbox (entidad, operacion, payload) "
            "VALUES ('almacen_stock', 'upsert', CAST(:payload AS jsonb))"
        ),
        {"payload": json.dumps(payload)},
    )


async def _encolar_movimiento(db: AsyncSession, movimiento_id: str, centro_id: int, tipo: str,
                              clave: str, nombre: str, cantidad: int,
                              referencia: Optional[str], usuario: Optional[str]) -> None:
    payload = {
        "sync_id": movimiento_id,
        "clinica_id": centro_id,
        "tipo": tipo,
        "item_key": clave,
        "nombre": nombre,
        "cantidad": cantidad,
        "referencia": referencia,
        "creado_por": usuario,
    }
    await db.execute(
        text(
            "INSERT INTO almacen_sync_outbox (entidad, operacion, payload) "
            "VALUES ('almacen_movimiento', 'insert', CAST(:payload AS jsonb))"
        ),
        {"payload": json.dumps(payload)},
    )


async def _registrar_movimiento(
    db: AsyncSession,
    *,
    centro_id: int,
    tipo: str,
    clave: str,
    nombre: str,
    cantidad: int,
    referencia: Optional[str],
    usuario: Optional[str],
) -> None:
    mov_id = str(
        (
            await db.execute(
                text(
                    "INSERT INTO almacen_movimientos "
                    "(clinica_id, tipo, item_key, nombre, cantidad, referencia, usuario, sincronizado) "
                    "VALUES (:c, :t, :k, :n, :cant, :ref, :usr, FALSE) RETURNING id"
                ),
                {
                    "c": centro_id,
                    "t": tipo,
                    "k": clave,
                    "n": nombre,
                    "cant": cantidad,
                    "ref": referencia,
                    "usr": usuario,
                },
            )
        ).scalar()
    )
    await _encolar_movimiento(db, mov_id, centro_id, tipo, clave, nombre, cantidad, referencia, usuario)


async def recibir_orden(db: AsyncSession, orden_id: str, usuario: str) -> dict:
    """Marca la orden como recibida y suma sus cantidades al stock del centro."""
    orden = (
        await db.execute(
            text("SELECT id, centro_id, estado, remota_id, numero FROM ordenes_entrega WHERE id = :id"),
            {"id": orden_id},
        )
    ).mappings().first()
    if not orden:
        raise ValueError("Orden de entrega no encontrada.")
    if orden["estado"] != "pendiente_recepcion":
        raise ValueError("La orden ya fue procesada.")

    centro_id = int(orden["centro_id"])
    items = (await db.execute(
        text("SELECT tipo, item_key, nombre, unidad, cantidad FROM ordenes_entrega_items WHERE orden_id = :id"),
        {"id": orden_id},
    )).mappings().all()
    if not items:
        raise ValueError("La orden no tiene productos.")

    for it in items:
        nuevo = await _ajustar_stock(
            db,
            centro_id=centro_id,
            tipo=it["tipo"],
            clave=it["item_key"],
            nombre=it["nombre"],
            unidad=it["unidad"],
            delta=int(it["cantidad"]),
        )
        await _encolar_stock(db, centro_id, it["item_key"], it["tipo"], it["nombre"], it["unidad"], nuevo)
        await _registrar_movimiento(
            db,
            centro_id=centro_id,
            tipo="ENTRADA",
            clave=it["item_key"],
            nombre=it["nombre"],
            cantidad=int(it["cantidad"]),
            referencia=f"Orden {orden['numero'] or str(orden['id'])[:8]}",
            usuario=usuario,
        )
        await db.execute(
            text("UPDATE ordenes_entrega_items SET cantidad_recibida = :c WHERE orden_id = :o AND item_key = :k"),
            {"c": int(it["cantidad"]), "o": orden_id, "k": it["item_key"]},
        )

    await db.execute(
        text(
            "UPDATE ordenes_entrega SET estado = 'recibida', recibida_por = :usr, recibida_en = now() "
            "WHERE id = :id"
        ),
        {"usr": usuario, "id": orden_id},
    )
    if orden["remota_id"]:
        await db.execute(
            text(
                "INSERT INTO almacen_sync_outbox (entidad, operacion, payload) "
                "VALUES ('orden_entrega', 'update', CAST(:payload AS jsonb))"
            ),
            {
                "payload": json.dumps(
                    {
                        "id": orden["remota_id"],
                        "estado": "recibida",
                        "recibida_por": usuario,
                        "recibida_en": datetime.now().isoformat(),
                    }
                )
            },
        )
    await db.commit()
    return {"id": str(orden["id"]), "estado": "recibida", "items": len(items)}


async def registrar_salida(
    db: AsyncSession,
    *,
    centro_id: int,
    clave: str,
    cantidad: int,
    motivo: Optional[str],
    usuario: str,
) -> dict:
    """Descuenta insumos por consumo diario en el centro."""
    if cantidad <= 0:
        raise ValueError("La cantidad debe ser mayor a cero.")
    fila = (await db.execute(
        text("SELECT nombre, cantidad FROM almacen_stock WHERE clinica_id = :c AND item_key = :k"),
        {"c": centro_id, "k": clave},
    )).mappings().first()
    if not fila:
        raise ValueError("El producto no está en el inventario del centro.")
    disponible = int(fila["cantidad"] or 0)
    if cantidad > disponible:
        raise ValueError(f"Stock insuficiente: disponible {disponible}.")

    tipo = clave.split(":", 1)[0] if ":" in clave else "medicamento"
    nombre = fila["nombre"]
    nuevo = await _ajustar_stock(
        db,
        centro_id=centro_id,
        tipo=tipo,
        clave=clave,
        nombre=nombre,
        unidad=None,
        delta=-cantidad,
    )
    await _encolar_stock(db, centro_id, clave, tipo, nombre, None, nuevo)
    await _registrar_movimiento(
        db,
        centro_id=centro_id,
        tipo="SALIDA",
        clave=clave,
        nombre=nombre,
        cantidad=cantidad,
        referencia=motivo or "Consumo diario",
        usuario=usuario,
    )
    await db.commit()
    return {"item_key": clave, "cantidad": nuevo, "descontado": cantidad}


async def listar_stock(db: AsyncSession, centro_id: int) -> list[dict]:
    filas = (await db.execute(text("""
        SELECT item_key, tipo, nombre, unidad, cantidad, stock_minimo, actualizado_en
        FROM almacen_stock
        WHERE clinica_id = :c
        ORDER BY nombre
    """), {"c": centro_id})).mappings().all()
    salida = []
    for f in filas:
        fila = dict(f)
        fila["bajo_minimo"] = int(f["cantidad"]) <= int(f["stock_minimo"])
        fila["actualizado_en"] = str(f["actualizado_en"]) if f["actualizado_en"] else None
        salida.append(fila)
    return salida


async def listar_movimientos(db: AsyncSession, centro_id: int, limite: int = 60) -> list[dict]:
    filas = (await db.execute(text("""
        SELECT tipo, item_key, nombre, cantidad, referencia, usuario, sincronizado, created_at
        FROM almacen_movimientos
        WHERE clinica_id = :c
        ORDER BY created_at DESC
        LIMIT :lim
    """), {"c": centro_id, "lim": limite})).mappings().all()
    salida = []
    for f in filas:
        fila = dict(f)
        fila["created_at"] = str(f["created_at"]) if f["created_at"] else None
        salida.append(fila)
    return salida


# ─── Sincronización ────────────────────────────────────────────────

async def _enviar_outbox(db: AsyncSession) -> tuple[int, int]:
    """Empuja la cola pendiente a Supabase. Devuelve (enviados, fallidos)."""
    pendientes = (await db.execute(text("""
        SELECT id, entidad, operacion, payload
        FROM almacen_sync_outbox
        WHERE enviado_en IS NULL
        ORDER BY id
        LIMIT 200
    """))).mappings().all()

    enviados = fallidos = 0
    if not pendientes:
        return 0, 0

    if not supabase_configurado():
        return 0, 0

    async with httpx.AsyncClient(timeout=8.0) as client:
        for fila in pendientes:
            entidad = fila["entidad"]
            payload = fila["payload"]
            try:
                if entidad == "almacen_stock":
                    resp = await client.post(
                        f"{_base_url()}/rest/v1/almacen_stock?on_conflict=clinica_id,item_key",
                        json=payload,
                        headers=_headers("resolution=merge-duplicates,return=minimal"),
                    )
                elif entidad == "almacen_movimiento":
                    resp = await client.post(
                        f"{_base_url()}/rest/v1/almacen_movimientos?on_conflict=sync_id",
                        json=payload,
                        headers=_headers("resolution=ignore-duplicates,return=minimal"),
                    )
                elif entidad == "orden_entrega":
                    resp = await client.patch(
                        f"{_base_url()}/rest/v1/ordenes_entrega?id=eq.{payload['id']}",
                        json={k: v for k, v in payload.items() if k != "id"},
                        headers=_headers("return=minimal"),
                    )
                else:
                    resp = None

                if resp is not None and resp.status_code in (200, 201, 204):
                    await db.execute(
                        text(
                            "UPDATE almacen_sync_outbox SET enviado_en = now(), ultimo_error = NULL "
                            "WHERE id = :id"
                        ),
                        {"id": fila["id"]},
                    )
                    if entidad == "almacen_movimiento" and payload.get("sync_id"):
                        await db.execute(
                            text("UPDATE almacen_movimientos SET sincronizado = TRUE WHERE id = :id"),
                            {"id": payload["sync_id"]},
                        )
                    enviados += 1
                else:
                    detalle = (resp.text[:300] if resp is not None else "entidad desconocida")
                    await db.execute(
                        text(
                            "UPDATE almacen_sync_outbox SET intentos = intentos + 1, ultimo_error = :err "
                            "WHERE id = :id"
                        ),
                        {"err": detalle, "id": fila["id"]},
                    )
                    fallidos += 1
            except Exception as exc:
                await db.execute(
                    text(
                        "UPDATE almacen_sync_outbox SET intentos = intentos + 1, ultimo_error = :err "
                        "WHERE id = :id"
                    ),
                    {"err": str(exc)[:300], "id": fila["id"]},
                )
                fallidos += 1
    await db.commit()
    return enviados, fallidos


async def sincronizar(db: AsyncSession, centro_id: int) -> dict:
    """Trae órdenes nuevas y envía los cambios locales pendientes."""
    recibidas = await traer_ordenes_pendientes(db, centro_id)
    enviados, fallidos = await _enviar_outbox(db)
    return {
        "ordenes_nuevas": recibidas,
        "enviados": enviados,
        "fallidos": fallidos,
        "pendientes": await pendientes_sync(db),
        "conectado": supabase_configurado(),
    }


async def pendientes_sync(db: AsyncSession) -> int:
    valor = (
        await db.execute(
            text("SELECT COUNT(*) FROM almacen_sync_outbox WHERE enviado_en IS NULL")
        )
    ).scalar()
    return int(valor or 0)


async def estado_sync(db: AsyncSession) -> dict:
    ultimo = (
        await db.execute(
            text("SELECT MAX(enviado_en) FROM almacen_sync_outbox WHERE enviado_en IS NOT NULL")
        )
    ).scalar()
    ultimo_error = (
        await db.execute(
            text(
                "SELECT ultimo_error FROM almacen_sync_outbox "
                "WHERE enviado_en IS NULL AND ultimo_error IS NOT NULL "
                "ORDER BY id DESC LIMIT 1"
            )
        )
    ).scalar()
    return {
        "pendientes": await pendientes_sync(db),
        "ultimo_envio": str(ultimo) if ultimo else None,
        "ultimo_error": ultimo_error,
        "conectado": supabase_configurado(),
    }


def claves_de(items: Iterable[dict]) -> list[str]:
    return [it.get("item_key") or item_key(it.get("tipo", "medicamento"), it.get("nombre", "")) for it in items]
