"""Farmacia: dashboard, CRUD de medicamentos/insumos, lotes y movimientos de inventario."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.farmacia import (
    DashboardResponse,
    InventarioItemSchema,
    InsumoCatalogoCreate,
    InsumoCatalogoResponse,
    InsumoCatalogoUpdate,
    LoteCreate,
    LoteResponse,
    LoteUpdate,
    MedicamentoFarmaciaCreate,
    MedicamentoFarmaciaResponse,
    MedicamentoFarmaciaUpdate,
    MovimientoInventarioCreate,
    MovimientoInventarioResponse,
    StockCentroRequest,
    StockCentroResponse,
)

from app.core.security import get_current_user, require_roles

router = APIRouter(tags=["Farmacia"])

_ROLES_INVENTARIO = ("jefe_farmacia", "farmaceutico", "admin_sistemas", "director")


def _resolver_centro(user: dict, clinica_id: int | None = None) -> int:
    """Centro de operación: admin elige (`clinica_id`), farmacéuta su propio centro."""
    if user.get("rol") in ("admin_sistemas", "director"):
        if not clinica_id:
            raise HTTPException(400, "admin_sistemas/director debe indicar clinica_id")
        return clinica_id
    centro = user.get("clinica_id")
    if not centro:
        raise HTTPException(400, "Su usuario no tiene centro asignado")
    return centro


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fmt(valor) -> str | None:
    return str(valor)[:16] if valor else None


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(db: AsyncSession = Depends(get_db)):
    """KPIs: total meds, total supplies, low stock, expiring soon, expired."""
    total_meds = (await db.execute(
        text("SELECT COUNT(*) FROM medicamentos_catalogo WHERE activo = TRUE")
    )).scalar() or 0

    total_ins = (await db.execute(
        text("SELECT COUNT(*) FROM insumos_catalogo WHERE activo = TRUE")
    )).scalar() or 0

    stock_bajo = (await db.execute(
        text("SELECT COUNT(*) FROM medicamentos_catalogo "
             "WHERE activo = TRUE AND stock_actual < stock_minimo")
    )).scalar() or 0

    stock_bajo_ins = (await db.execute(
        text("SELECT COUNT(*) FROM insumos_catalogo "
             "WHERE activo = TRUE AND stock_actual < stock_minimo")
    )).scalar() or 0

    today = date.today()
    soon = today.replace(day=today.day + 30) if today.day + 30 <= 28 else date(
        today.year + (today.month // 12), (today.month % 12) + 1, min(today.day, 28)
    )

    por_vencer = (await db.execute(
        text("SELECT COUNT(*) FROM lotes "
             "WHERE activo = TRUE AND fecha_vencimiento > :today "
             "AND fecha_vencimiento <= :soon"),
        {"today": today, "soon": soon},
    )).scalar() or 0

    vencidos = (await db.execute(
        text("SELECT COUNT(*) FROM lotes WHERE activo = TRUE AND fecha_vencimiento < :today"),
        {"today": today},
    )).scalar() or 0

    return DashboardResponse(
        total_medicamentos=total_meds,
        total_insumos=total_ins,
        stock_bajo=stock_bajo + stock_bajo_ins,
        por_vencer=por_vencer,
        vencidos=vencidos,
    )


@router.get("/dashboard/top-stock-bajo")
async def top_stock_bajo(db: AsyncSession = Depends(get_db)):
    """Top 10 products with lowest stock ratio (actual/minimo)."""
    result = await db.execute(
        text(
            "SELECT nombre, 'MEDICAMENTO' as tipo, stock_actual, stock_minimo "
            "FROM medicamentos_catalogo WHERE activo = TRUE AND stock_minimo > 0 "
            "UNION ALL "
            "SELECT nombre, 'INSUMO' as tipo, stock_actual, stock_minimo "
            "FROM insumos_catalogo WHERE activo = TRUE AND stock_minimo > 0 "
            "ORDER BY CAST(stock_actual AS FLOAT) / stock_minimo ASC "
            "LIMIT 10"
        )
    )
    return [dict(r) for r in result.mappings()]


# ---------------------------------------------------------------------------
# Medicamentos CRUD
# ---------------------------------------------------------------------------

@router.get("/medicamentos")
async def listar_medicamentos(
    q: str = Query(default=""),
    stock_status: str = Query(default="", description="bajo, normal, vencido"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=8, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    conditions = ["activo = TRUE"]
    params: dict = {}

    if q:
        conditions.append("nombre ILIKE :q")
        params["q"] = f"%{q}%"

    if stock_status == "bajo":
        conditions.append("stock_actual < stock_minimo")

    where = " AND ".join(conditions)

    total = (await db.execute(
        text(f"SELECT COUNT(*) FROM medicamentos_catalogo WHERE {where}"),
        params,
    )).scalar() or 0

    offset = (page - 1) * per_page
    params["limit"] = per_page
    params["offset"] = offset

    result = await db.execute(
        text(f"SELECT * FROM medicamentos_catalogo WHERE {where} ORDER BY nombre LIMIT :limit OFFSET :offset"),
        params,
    )
    items = [MedicamentoFarmaciaResponse(**dict(r)) for r in result.mappings()]
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.post("/medicamentos", response_model=MedicamentoFarmaciaResponse,
             status_code=status.HTTP_201_CREATED)
async def crear_medicamento(
    payload: MedicamentoFarmaciaCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            "INSERT INTO medicamentos_catalogo "
            "(nombre, presentacion, concentracion, categoria, stock_actual, stock_minimo, activo) "
            "VALUES (:n, :p, :c, :cat, :s, :sm, TRUE) "
            "RETURNING *"
        ),
        {
            "n": payload.nombre,
            "p": payload.presentacion,
            "c": payload.concentracion,
            "cat": payload.categoria,
            "s": payload.stock_actual,
            "sm": payload.stock_minimo,
        },
    )
    await db.commit()
    return MedicamentoFarmaciaResponse(**dict(result.mappings().first()))


@router.put("/medicamentos/{med_id}", response_model=MedicamentoFarmaciaResponse)
async def actualizar_medicamento(
    med_id: int,
    payload: MedicamentoFarmaciaUpdate,
    db: AsyncSession = Depends(get_db),
):
    existing = (await db.execute(
        text("SELECT * FROM medicamentos_catalogo WHERE id = :id"), {"id": med_id}
    )).first()
    if not existing:
        raise HTTPException(404, "Medicamento no encontrado")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        return MedicamentoFarmaciaResponse(**dict(existing))

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = med_id
    result = await db.execute(
        text(f"UPDATE medicamentos_catalogo SET {set_clause} WHERE id = :id RETURNING *"),
        updates,
    )
    await db.commit()
    return MedicamentoFarmaciaResponse(**dict(result.mappings().first()))


@router.delete("/medicamentos/{med_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_medicamento(med_id: int, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(
        text("SELECT id FROM medicamentos_catalogo WHERE id = :id"), {"id": med_id}
    )).first()
    if not existing:
        raise HTTPException(404, "Medicamento no encontrado")

    await db.execute(
        text("UPDATE medicamentos_catalogo SET activo = FALSE WHERE id = :id"),
        {"id": med_id},
    )
    await db.commit()


# ---------------------------------------------------------------------------
# Insumos CRUD
# ---------------------------------------------------------------------------

@router.get("/insumos")
async def listar_insumos(
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=8, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    conditions = ["activo = TRUE"]
    params: dict = {}
    if q:
        conditions.append("nombre ILIKE :q")
        params["q"] = f"%{q}%"
    where = " AND ".join(conditions)

    total = (await db.execute(
        text(f"SELECT COUNT(*) FROM insumos_catalogo WHERE {where}"),
        params,
    )).scalar() or 0

    offset = (page - 1) * per_page
    params["limit"] = per_page
    params["offset"] = offset

    result = await db.execute(
        text(f"SELECT * FROM insumos_catalogo WHERE {where} ORDER BY nombre LIMIT :limit OFFSET :offset"),
        params,
    )
    items = [InsumoCatalogoResponse(**dict(r)) for r in result.mappings()]
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.post("/insumos", response_model=InsumoCatalogoResponse,
             status_code=status.HTTP_201_CREATED)
async def crear_insumo(
    payload: InsumoCatalogoCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            "INSERT INTO insumos_catalogo "
            "(nombre, descripcion, categoria, unidad, stock_actual, stock_minimo, activo) "
            "VALUES (:n, :d, :cat, :u, :s, :sm, TRUE) "
            "RETURNING *"
        ),
        {
            "n": payload.nombre,
            "d": payload.descripcion,
            "cat": payload.categoria,
            "u": payload.unidad,
            "s": payload.stock_actual,
            "sm": payload.stock_minimo,
        },
    )
    await db.commit()
    return InsumoCatalogoResponse(**dict(result.mappings().first()))


@router.put("/insumos/{insumo_id}", response_model=InsumoCatalogoResponse)
async def actualizar_insumo(
    insumo_id: int,
    payload: InsumoCatalogoUpdate,
    db: AsyncSession = Depends(get_db),
):
    existing = (await db.execute(
        text("SELECT * FROM insumos_catalogo WHERE id = :id"), {"id": insumo_id}
    )).first()
    if not existing:
        raise HTTPException(404, "Insumo no encontrado")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        return InsumoCatalogoResponse(**dict(existing))

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = insumo_id
    result = await db.execute(
        text(f"UPDATE insumos_catalogo SET {set_clause} WHERE id = :id RETURNING *"),
        updates,
    )
    await db.commit()
    return InsumoCatalogoResponse(**dict(result.mappings().first()))


@router.delete("/insumos/{insumo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_insumo(insumo_id: int, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(
        text("SELECT id FROM insumos_catalogo WHERE id = :id"), {"id": insumo_id}
    )).first()
    if not existing:
        raise HTTPException(404, "Insumo no encontrado")

    await db.execute(
        text("UPDATE insumos_catalogo SET activo = FALSE WHERE id = :id"),
        {"id": insumo_id},
    )
    await db.commit()


# ---------------------------------------------------------------------------
# Lotes CRUD
# ---------------------------------------------------------------------------

@router.get("/lotes", response_model=list[LoteResponse])
async def listar_lotes(
    medicamento_id: int | None = Query(default=None),
    insumo_id: int | None = Query(default=None),
    vencimiento: str = Query(default="", description="vencido, proximo, ok"),
    db: AsyncSession = Depends(get_db),
):
    conditions = ["l.activo = TRUE"]
    params: dict = {}
    if medicamento_id is not None:
        conditions.append("l.medicamento_id = :med_id")
        params["med_id"] = medicamento_id
    if insumo_id is not None:
        conditions.append("l.insumo_id = :ins_id")
        params["ins_id"] = insumo_id

    today = date.today()
    soon = date(today.year + (today.month // 12), (today.month % 12) + 1, min(today.day, 28))

    if vencimiento == "vencido":
        conditions.append("l.fecha_vencimiento < :today")
        params["today"] = today
    elif vencimiento == "proximo":
        conditions.append("l.fecha_vencimiento >= :today AND l.fecha_vencimiento <= :soon")
        params["today"] = today
        params["soon"] = soon

    where = " AND ".join(conditions)
    result = await db.execute(
        text(f"SELECT l.* FROM lotes l WHERE {where} ORDER BY l.fecha_vencimiento"),
        params,
    )
    return [LoteResponse(**{**dict(r), "fecha_entrada": str(r.fecha_entrada),
                            "fecha_vencimiento": str(r.fecha_vencimiento)})
            for r in result.mappings()]


@router.get("/lotes/proximos-vencer", response_model=list[LoteResponse])
async def lotes_proximos_vencer(
    dias: int = Query(default=30, ge=1, le=180),
    db: AsyncSession = Depends(get_db),
):
    """Lotes que vencen dentro de N días."""
    today = date.today()
    limit = date(
        today.year + ((today.month + (dias // 30)) // 12),
        ((today.month - 1 + (dias // 30)) % 12) + 1,
        min(today.day + (dias % 30), 28),
    )
    result = await db.execute(
        text(
            "SELECT * FROM lotes "
            "WHERE activo = TRUE AND fecha_vencimiento >= :today AND fecha_vencimiento <= :limit "
            "ORDER BY fecha_vencimiento"
        ),
        {"today": today, "limit": limit},
    )
    return [LoteResponse(**{**dict(r), "fecha_entrada": str(r.fecha_entrada),
                            "fecha_vencimiento": str(r.fecha_vencimiento)})
            for r in result.mappings()]


@router.post("/lotes", response_model=LoteResponse, status_code=status.HTTP_201_CREATED)
async def crear_lote(
    payload: LoteCreate,
    db: AsyncSession = Depends(get_db),
):
    """Crear lote y actualizar stock del producto asociado."""
    qty_init = payload.cantidad_inicial or payload.cantidad

    result = await db.execute(
        text(
            "INSERT INTO lotes "
            "(codigo_lote, medicamento_id, insumo_id, cantidad, cantidad_inicial, "
            "fecha_entrada, fecha_vencimiento, activo) "
            "VALUES (:codigo, :med_id, :ins_id, :qty, :qty_init, :f_entrada, :f_venc, TRUE) "
            "RETURNING *"
        ),
        {
            "codigo": payload.codigo_lote,
            "med_id": payload.medicamento_id,
            "ins_id": payload.insumo_id,
            "qty": payload.cantidad,
            "qty_init": qty_init,
            "f_entrada": payload.fecha_entrada,
            "f_venc": payload.fecha_vencimiento,
        },
    )
    fila = result.mappings().first()

    # Actualizar stock del producto
    if payload.medicamento_id and payload.cantidad:
        await db.execute(
            text("UPDATE medicamentos_catalogo SET stock_actual = stock_actual + :qty "
                 "WHERE id = :id"),
            {"qty": payload.cantidad, "id": payload.medicamento_id},
        )
    elif payload.insumo_id and payload.cantidad:
        await db.execute(
            text("UPDATE insumos_catalogo SET stock_actual = stock_actual + :qty "
                 "WHERE id = :id"),
            {"qty": payload.cantidad, "id": payload.insumo_id},
        )

    await db.commit()
    return LoteResponse(**{**dict(fila), "fecha_entrada": str(fila["fecha_entrada"]),
                           "fecha_vencimiento": str(fila["fecha_vencimiento"])})


@router.put("/lotes/{lote_id}", response_model=LoteResponse)
async def actualizar_lote(
    lote_id: int,
    payload: LoteUpdate,
    db: AsyncSession = Depends(get_db),
):
    existing = (await db.execute(
        text("SELECT * FROM lotes WHERE id = :id"), {"id": lote_id}
    )).first()
    if not existing:
        raise HTTPException(404, "Lote no encontrado")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        return LoteResponse(**{**dict(existing), "fecha_entrada": str(existing.fecha_entrada),
                               "fecha_vencimiento": str(existing.fecha_vencimiento)})

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = lote_id
    result = await db.execute(
        text(f"UPDATE lotes SET {set_clause} WHERE id = :id RETURNING *"),
        updates,
    )
    await db.commit()
    fila = result.mappings().first()
    return LoteResponse(**{**dict(fila), "fecha_entrada": str(fila["fecha_entrada"]),
                           "fecha_vencimiento": str(fila["fecha_vencimiento"])})


# ---------------------------------------------------------------------------
# Movimientos de Inventario
# ---------------------------------------------------------------------------

@router.get("/movimientos", response_model=list[MovimientoInventarioResponse])
async def listar_movimientos(
    lote_id: int | None = Query(default=None),
    tipo: str = Query(default=""),
    desde: str = Query(default="", description="YYYY-MM-DD"),
    hasta: str = Query(default="", description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
):
    conditions = ["1=1"]
    params: dict = {}
    if lote_id is not None:
        conditions.append("m.lote_id = :lote_id")
        params["lote_id"] = lote_id
    if tipo:
        conditions.append("m.tipo = :tipo")
        params["tipo"] = tipo
    if desde:
        conditions.append("m.created_at >= :desde::date")
        params["desde"] = desde
    if hasta:
        conditions.append("m.created_at <= :hasta::date + INTERVAL '1 day'")
        params["hasta"] = hasta

    where = " AND ".join(conditions)
    result = await db.execute(
        text(f"SELECT m.* FROM movimientos_inventario m WHERE {where} "
             "ORDER BY m.created_at DESC LIMIT 200"),
        params,
    )
    return [MovimientoInventarioResponse(
        **{**dict(r), "created_at": _fmt(r.created_at)}
    ) for r in result.mappings()]


@router.post("/movimientos", response_model=MovimientoInventarioResponse,
             status_code=status.HTTP_201_CREATED)
async def registrar_movimiento(
    payload: MovimientoInventarioCreate,
    db: AsyncSession = Depends(get_db),
):
    """Registrar movimiento y actualizar stock del lote y producto."""
    lote = (await db.execute(
        text("SELECT * FROM lotes WHERE id = :id AND activo = TRUE"),
        {"id": payload.lote_id},
    )).first()
    if not lote:
        raise HTTPException(404, "Lote no encontrado o inactivo")

    tipo = payload.tipo.upper()
    cant = payload.cantidad

    if tipo == "SALIDA":
        if lote.cantidad < cant:
            raise HTTPException(
                409, f"Stock insuficiente en lote {lote.codigo_lote}: "
                     f"disponible {lote.cantidad}, solicitado {cant}."
            )
        await db.execute(
            text("UPDATE lotes SET cantidad = cantidad - :qty WHERE id = :id"),
            {"qty": cant, "id": payload.lote_id},
        )
        if lote.medicamento_id:
            await db.execute(
                text("UPDATE medicamentos_catalogo SET stock_actual = GREATEST(0, stock_actual - :qty) "
                     "WHERE id = :id"),
                {"qty": cant, "id": lote.medicamento_id},
            )
        elif lote.insumo_id:
            await db.execute(
                text("UPDATE insumos_catalogo SET stock_actual = GREATEST(0, stock_actual - :qty) "
                     "WHERE id = :id"),
                {"qty": cant, "id": lote.insumo_id},
            )
    elif tipo == "ENTRADA":
        await db.execute(
            text("UPDATE lotes SET cantidad = cantidad + :qty WHERE id = :id"),
            {"qty": cant, "id": payload.lote_id},
        )
        if lote.medicamento_id:
            await db.execute(
                text("UPDATE medicamentos_catalogo SET stock_actual = stock_actual + :qty "
                     "WHERE id = :id"),
                {"qty": cant, "id": lote.medicamento_id},
            )
        elif lote.insumo_id:
            await db.execute(
                text("UPDATE insumos_catalogo SET stock_actual = stock_actual + :qty "
                     "WHERE id = :id"),
                {"qty": cant, "id": lote.insumo_id},
            )
    elif tipo == "AJUSTE":
        await db.execute(
            text("UPDATE lotes SET cantidad = :qty WHERE id = :id"),
            {"qty": cant, "id": payload.lote_id},
        )
        if lote.medicamento_id:
            total_lotes = (await db.execute(
                text("SELECT COALESCE(SUM(cantidad), 0) FROM lotes "
                     "WHERE medicamento_id = :med_id AND activo = TRUE"),
                {"med_id": lote.medicamento_id},
            )).scalar()
            await db.execute(
                text("UPDATE medicamentos_catalogo SET stock_actual = :total WHERE id = :id"),
                {"total": total_lotes, "id": lote.medicamento_id},
            )
        elif lote.insumo_id:
            total_lotes = (await db.execute(
                text("SELECT COALESCE(SUM(cantidad), 0) FROM lotes "
                     "WHERE insumo_id = :ins_id AND activo = TRUE"),
                {"ins_id": lote.insumo_id},
            )).scalar()
            await db.execute(
                text("UPDATE insumos_catalogo SET stock_actual = :total WHERE id = :id"),
                {"total": total_lotes, "id": lote.insumo_id},
            )
    else:
        raise HTTPException(400, f"Tipo de movimiento inválido: {tipo}")

    result = await db.execute(
        text(
            "INSERT INTO movimientos_inventario (lote_id, tipo, cantidad, observacion, creado_por) "
            "VALUES (:lote_id, :tipo, :cant, :obs, :cp) RETURNING *"
        ),
        {
            "lote_id": payload.lote_id,
            "tipo": tipo,
            "cant": cant,
            "obs": payload.observacion,
            "cp": payload.creado_por,
        },
    )
    await db.commit()
    return MovimientoInventarioResponse(**{**dict(result.mappings().first()),
                                           "created_at": _fmt(result.mappings().first()["created_at"])})


# ─── INVENTARIO UNIFICADO (para doctores) ──────────────────────────────
@router.get("/inventario")
async def inventario_unificado(
    clinica_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Catálogo unificado marcó/insumos. Sin `clinica_id`: stock global (vista actual).
    Con `clinica_id`: agrega `stock_centro` (per-centro) para insumos; medicamentos siguen globales."""
    if clinica_id is None:
        result = await db.execute(text("""
            SELECT
                id, nombre, presentacion, concentracion, categoria,
                stock_actual, stock_minimo, 'MEDICAMENTO' as tipo,
                'medicamentos_catalogo' as tabla_origen,
                NULL as descripcion, NULL as unidad,
                NULL as stock_centro
            FROM medicamentos_catalogo
            WHERE activo = TRUE
            UNION ALL
            SELECT
                id, nombre, NULL as presentacion, NULL as concentracion, categoria,
                stock_actual, stock_minimo, 'INSUMO' as tipo,
                'insumos_catalogo' as tabla_origen,
                descripcion, unidad,
                NULL as stock_centro
            FROM insumos_catalogo
            WHERE activo = TRUE
            ORDER BY nombre
        """))
        return [dict(r) for r in result.mappings()]

    result = await db.execute(text("""
        SELECT
            m.id, m.nombre, m.presentacion, m.concentracion, m.categoria,
            m.stock_actual, m.stock_minimo, 'MEDICAMENTO' as tipo,
            'medicamentos_catalogo' as tabla_origen,
            NULL as descripcion, NULL as unidad,
            NULL as stock_centro
        FROM medicamentos_catalogo m
        WHERE m.activo = TRUE
        UNION ALL
        SELECT
            i.id, i.nombre, NULL, NULL, i.categoria,
            i.stock_actual, i.stock_minimo, 'INSUMO' as tipo,
            'insumos_catalogo' as tabla_origen,
            i.descripcion, i.unidad,
            COALESCE(s.stock_actual, 0) as stock_centro
        FROM insumos_catalogo i
        LEFT JOIN stock_por_centro s
          ON s.insumo_id = i.id AND s.clinica_id = :cid
        WHERE i.activo = TRUE
        ORDER BY nombre
    """), {"cid": clinica_id})
    return [dict(r) for r in result.mappings()]


async def _stock_centro_actual(insumo_id: int, centro: int, db: AsyncSession) -> int:
    row = (await db.execute(
        text("SELECT stock_actual FROM stock_por_centro WHERE insumo_id = :i AND clinica_id = :c"),
        {"i": insumo_id, "c": centro},
    )).first()
    return row[0] if row else 0


@router.post("/insumos/{insumo_id}/stock", response_model=StockCentroResponse,
             status_code=status.HTTP_201_CREATED)
async def ingresar_stock_centro(
    insumo_id: int,
    payload: StockCentroRequest,
    user: dict = Depends(require_roles(*_ROLES_INVENTARIO)),
    db: AsyncSession = Depends(get_db),
):
    """Ingreso de stock a un centro: suma a stock_por_centro y al global (doble libro)."""
    if payload.cantidad <= 0:
        raise HTTPException(400, "cantidad debe ser mayor a 0")
    centro = _resolver_centro(user, payload.clinica_id)
    insumo = (await db.execute(
        text("SELECT id, stock_actual FROM insumos_catalogo WHERE id = :id AND activo = TRUE"),
        {"id": insumo_id},
    )).first()
    if not insumo:
        raise HTTPException(404, "Insumo no encontrado o inactivo")

    await db.execute(
        text("""
            INSERT INTO stock_por_centro (insumo_id, clinica_id, stock_actual)
            VALUES (:i, :c, :cant)
            ON CONFLICT (insumo_id, clinica_id)
            DO UPDATE SET stock_actual = stock_por_centro.stock_actual + EXCLUDED.stock_actual
        """),
        {"i": insumo_id, "c": centro, "cant": payload.cantidad},
    )
    await db.execute(
        text("UPDATE insumos_catalogo SET stock_actual = stock_actual + :cant WHERE id = :id"),
        {"cant": payload.cantidad, "id": insumo_id},
    )
    await db.commit()
    nuevo_centro = await _stock_centro_actual(insumo_id, centro, db)
    global_row = (await db.execute(
        text("SELECT stock_actual FROM insumos_catalogo WHERE id = :id"), {"id": insumo_id},
    )).first()
    return StockCentroResponse(
        insumo_id=insumo_id, clinica_id=centro,
        stock_centro=nuevo_centro, stock_global=global_row[0],
    )


@router.post("/insumos/{insumo_id}/descontar", response_model=StockCentroResponse,
             status_code=status.HTTP_200_OK)
async def descontar_stock_centro(
    insumo_id: int,
    payload: StockCentroRequest,
    user: dict = Depends(require_roles(*_ROLES_INVENTARIO)),
    db: AsyncSession = Depends(get_db),
):
    """Descuento de stock de un centro: resta de stock_por_centro y del global (doble libro)."""
    if payload.cantidad <= 0:
        raise HTTPException(400, "cantidad debe ser mayor a 0")
    centro = _resolver_centro(user, payload.clinica_id)
    insumo = (await db.execute(
        text("SELECT id FROM insumos_catalogo WHERE id = :id AND activo = TRUE"),
        {"id": insumo_id},
    )).first()
    if not insumo:
        raise HTTPException(404, "Insumo no encontrado o inactivo")

    disponible = await _stock_centro_actual(insumo_id, centro, db)
    if disponible < payload.cantidad:
        raise HTTPException(
            409, f"Stock insuficiente en el centro: disponible {disponible}, solicitado {payload.cantidad}.")

    await db.execute(
        text("UPDATE stock_por_centro SET stock_actual = stock_actual - :cant "
             "WHERE insumo_id = :i AND clinica_id = :c"),
        {"cant": payload.cantidad, "i": insumo_id, "c": centro},
    )
    await db.execute(
        text("UPDATE insumos_catalogo SET stock_actual = GREATEST(0, stock_actual - :cant) WHERE id = :id"),
        {"cant": payload.cantidad, "id": insumo_id},
    )
    await db.commit()
    nuevo_centro = await _stock_centro_actual(insumo_id, centro, db)
    global_row = (await db.execute(
        text("SELECT stock_actual FROM insumos_catalogo WHERE id = :id"), {"id": insumo_id},
    )).first()
    return StockCentroResponse(
        insumo_id=insumo_id, clinica_id=centro,
        stock_centro=nuevo_centro, stock_global=global_row[0],
    )


# ─── RECETAS APLICADAS ────────────────────────────────────────────────
@router.get("/recetas-aplicadas")
async def recetas_aplicadas(
    q: str = Query(default="", description="Busqueda por medicamento, doctor, fecha o paciente"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=8, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Retorna medicamentos recetados en consultas, con datos del paciente y doctor."""
    import json

    result = await db.execute(text("""
        SELECT
            c.id AS consulta_id,
            c.created_at AS fecha,
            hc.cedula AS paciente_cedula,
            hc.nombre_completo AS paciente_nombre,
            c.medico_nombre,
            c.especialidad,
            c.recetas
        FROM consultas c
        LEFT JOIN historias_clinicas hc ON hc.id = c.paciente_id
        WHERE c.recetas IS NOT NULL AND c.recetas != '[]'::jsonb
        ORDER BY c.created_at DESC
    """))
    rows = result.fetchall()

    all_items = []
    for row in rows:
        recetas_raw = row.recetas
        if isinstance(recetas_raw, str):
            try:
                recetas_raw = json.loads(recetas_raw)
            except (json.JSONDecodeError, TypeError):
                continue
        if not isinstance(recetas_raw, list):
            continue

        for receta in recetas_raw:
            if not isinstance(receta, dict):
                continue
            item = {
                "consulta_id": str(row.consulta_id) if row.consulta_id else None,
                "fecha": row.fecha.isoformat() if row.fecha else None,
                "paciente_cedula": row.paciente_cedula,
                "paciente_nombre": row.paciente_nombre,
                "medico_nombre": row.medico_nombre,
                "especialidad": row.especialidad,
                "medicamento_nombre": receta.get("medicamento") or receta.get("nombre") or receta.get("medicamento_nombre"),
                "cantidad_prescrita": receta.get("cantidad") or receta.get("cantidad_prescrita"),
                "cantidad_despachada": receta.get("cantidad_despachada"),
                "posologia": receta.get("posologia") or receta.get("dosis"),
            }
            all_items.append(item)

    # Busqueda unica: busca en medicamento, doctor, fecha, paciente
    if q:
        ql = q.lower()
        filtered = [i for i in all_items if
                    ql in (i["medicamento_nombre"] or "").lower() or
                    ql in (i["medico_nombre"] or "").lower() or
                    ql in (i["fecha"] or "") or
                    ql in (i["paciente_nombre"] or "").lower() or
                    ql in (i["paciente_cedula"] or "")]
    else:
        filtered = all_items

    total = len(filtered)
    offset = (page - 1) * per_page
    items = filtered[offset:offset + per_page]

    return {"items": items, "total": total, "page": page, "per_page": per_page}
