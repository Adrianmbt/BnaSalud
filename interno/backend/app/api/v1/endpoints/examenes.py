"""Endpoints: Catálogo de exámenes y Órdenes médicas."""
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.examenes_orden import (
    CatalogoResponse,
    CatalogoExamenCategoria,
    CatalogoExamenGrupo,
    CatalogoExamenItem,
    OrdenCrearRequest,
    OrdenResponse,
    OrdenExamenItemResponse,
    OrdenItemListResponse,
    ItemActualizarRequest,
    ItemActualizarResponse,
)

router = APIRouter(tags=["Exámenes y Órdenes"])


# ─────────────────────────────────────────────
# GET /catalogo — Catálogo estructurado
# ─────────────────────────────────────────────
@router.get("/catalogo", response_model=CatalogoResponse)
async def obtener_catalogo(
    solo_activos: bool = Query(True, description="Solo exámenes activos"),
    db: AsyncSession = Depends(get_db),
):
    """Devuelve el catálogo de exámenes agrupado por categoría → grupo."""
    where = "WHERE activo = true" if solo_activos else ""
    rows = (await db.execute(
        text(f"""
            SELECT id, categoria, grupo, nombre_estudio, requiere_ayuno, activo
            FROM catalogo_examenes
            {where}
            ORDER BY categoria, grupo, nombre_estudio
        """)
    )).fetchall()

    # Construir árbol: categoría → grupo → estudios
    tree: dict[str, dict[str, list]] = {}
    for r in rows:
        cat = r.categoria
        grp = r.grupo
        if cat not in tree:
            tree[cat] = {}
        if grp not in tree[cat]:
            tree[cat][grp] = []
        tree[cat][grp].append(CatalogoExamenItem(
            id=str(r.id),
            categoria=r.categoria,
            grupo=r.grupo,
            nombre_estudio=r.nombre_estudio,
            requiere_ayuno=r.requiere_ayuno,
            activo=r.activo,
        ))

    categorias = []
    for cat, grupos in tree.items():
        grupos_list = []
        for grp, estudios in grupos.items():
            grupos_list.append(CatalogoExamenGrupo(grupo=grp, estudios=estudios))
        categorias.append(CatalogoExamenCategoria(categoria=cat, grupos=grupos_list))

    return CatalogoResponse(categorias=categorias)


# ─────────────────────────────────────────────
# GET /catalogo/buscar — Búsqueda de exámenes
# ─────────────────────────────────────────────
@router.get("/catalogo/buscar")
async def buscar_examenes(
    q: str = Query(..., min_length=1, description="Texto de búsqueda"),
    categoria: Optional[str] = Query(None, description="Filtrar por categoría"),
    db: AsyncSession = Depends(get_db),
):
    """Busca exámenes por nombre (parcial, case-insensitive)."""
    params: dict = {"q": f"%{q}%"}
    where = "WHERE activo = true AND LOWER(nombre_estudio) LIKE LOWER(:q)"
    if categoria:
        where += " AND categoria = :categoria"
        params["categoria"] = categoria

    rows = (await db.execute(
        text(f"""
            SELECT id, categoria, grupo, nombre_estudio, requiere_ayuno
            FROM catalogo_examenes
            {where}
            ORDER BY nombre_estudio
            LIMIT 50
        """),
        params,
    )).fetchall()

    return {
        "resultados": [
            {
                "id": str(r.id),
                "categoria": r.categoria,
                "grupo": r.grupo,
                "nombre_estudio": r.nombre_estudio,
                "requiere_ayuno": r.requiere_ayuno,
            }
            for r in rows
        ]
    }


# ─────────────────────────────────────────────
# POST /ordenes — Crear orden de exámenes
# ─────────────────────────────────────────────
@router.post("/ordenes", response_model=OrdenResponse, status_code=201)
async def crear_orden(
    payload: OrdenCrearRequest,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_current_user),
):
    """Crea una nueva orden de exámenes con sus items."""
    # Verificar que el paciente existe
    paciente = (await db.execute(
        text("SELECT id FROM historias_clinicas WHERE id = :pid"),
        {"pid": payload.paciente_id},
    )).first()
    if not paciente:
        raise HTTPException(404, "Paciente no encontrado.")

    # medico_id = id del usuario autenticado que emite la orden
    medico_id = "00000000-0000-0000-0000-000000000001"  # fallback si no hay vínculo
    fila_usuario = (await db.execute(
        text("SELECT id FROM usuarios WHERE username = :sub"),
        {"sub": usuario["sub"]},
    )).first()
    if fila_usuario:
        medico_id = str(fila_usuario[0])

    # Insertar orden
    orden_row = (await db.execute(
        text("""
            INSERT INTO ordenes_medicas (paciente_id, medico_id, origen_atencion, observaciones)
            VALUES (:pid, :mid, :origen, :obs)
            RETURNING id, created_at, updated_at
        """),
        {
            "pid": payload.paciente_id,
            "mid": medico_id,
            "origen": payload.origen_atencion,
            "obs": payload.observaciones,
        },
    )).first()
    orden_id = str(orden_row.id)

    # Buscar IDs del catálogo para cada examen
    items_insertados = []
    for item in payload.examenes:
        cat_row = (await db.execute(
            text("SELECT id FROM catalogo_examenes WHERE nombre_estudio = :nombre"),
            {"nombre": item.nombre_examen},
        )).first()
        examen_id = str(cat_row.id) if cat_row else None

        item_row = (await db.execute(
            text("""
                INSERT INTO orden_examenes_items (orden_id, examen_id, nombre_examen, categoria, grupo)
                VALUES (:oid, :eid, :nombre, :cat, :grp)
                RETURNING id, created_at
            """),
            {
                "oid": orden_id,
                "eid": examen_id,
                "nombre": item.nombre_examen,
                "cat": item.categoria,
                "grp": item.grupo,
            },
        )).first()

        items_insertados.append(OrdenExamenItemResponse(
            id=str(item_row.id),
            orden_id=orden_id,
            examen_id=examen_id,
            nombre_examen=item.nombre_examen,
            categoria=item.categoria,
            grupo=item.grupo,
            resultado=None,
            estado_item="pendiente",
            created_at=str(item_row.created_at),
        ))

    await db.commit()

    return OrdenResponse(
        id=orden_id,
        paciente_id=payload.paciente_id,
        medico_id="00000000-0000-0000-0000-000000000001",
        origen_atencion=payload.origen_atencion,
        estado="pendiente",
        observaciones=payload.observaciones,
        created_at=str(orden_row.created_at),
        updated_at=str(orden_row.updated_at),
        items=items_insertados,
    )


# ─────────────────────────────────────────────
# GET /ordenes/paciente/{paciente_id} — Órdenes de un paciente
# ─────────────────────────────────────────────
@router.get("/ordenes/paciente/{paciente_id}", response_model=OrdenItemListResponse)
async def ordenes_por_paciente(
    paciente_id: str,
    limite: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Lista las órdenes de exámenes de un paciente (más recientes primero)."""
    ordenes_rows = (await db.execute(
        text("""
            SELECT id, paciente_id, medico_id, origen_atencion, estado,
                   observaciones, created_at, updated_at
            FROM ordenes_medicas
            WHERE paciente_id = :pid
            ORDER BY created_at DESC
            LIMIT :limite
        """),
        {"pid": paciente_id, "limite": limite},
    )).fetchall()

    ordenes = []
    for o in ordenes_rows:
        orden_id = str(o.id)
        items_rows = (await db.execute(
            text("""
                SELECT id, orden_id, examen_id, nombre_examen, categoria, grupo,
                       resultado, estado_item, created_at
                FROM orden_examenes_items
                WHERE orden_id = :oid
                ORDER BY created_at
            """),
            {"oid": orden_id},
        )).fetchall()

        items = [
            OrdenExamenItemResponse(
                id=str(i.id),
                orden_id=str(i.orden_id),
                examen_id=str(i.examen_id) if i.examen_id else None,
                nombre_examen=i.nombre_examen,
                categoria=i.categoria,
                grupo=i.grupo,
                resultado=i.resultado,
                estado_item=i.estado_item,
                created_at=str(i.created_at),
            )
            for i in items_rows
        ]

        ordenes.append(OrdenResponse(
            id=orden_id,
            paciente_id=str(o.paciente_id),
            medico_id=str(o.medico_id),
            origen_atencion=o.origen_atencion,
            estado=o.estado,
            observaciones=o.observaciones,
            created_at=str(o.created_at),
            updated_at=str(o.updated_at),
            items=items,
        ))

    return OrdenItemListResponse(ordenes=ordenes)


# ─────────────────────────────────────────────
# GET /ordenes/{orden_id} — Detalle de una orden
# ─────────────────────────────────────────────
@router.get("/ordenes/{orden_id}", response_model=OrdenResponse)
async def obtener_orden(
    orden_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Obtiene el detalle completo de una orden."""
    o = (await db.execute(
        text("""
            SELECT id, paciente_id, medico_id, origen_atencion, estado,
                   observaciones, created_at, updated_at
            FROM ordenes_medicas
            WHERE id = :oid
        """),
        {"oid": orden_id},
    )).first()
    if not o:
        raise HTTPException(404, "Orden no encontrada.")

    items_rows = (await db.execute(
        text("""
            SELECT id, orden_id, examen_id, nombre_examen, categoria, grupo,
                   resultado, estado_item, created_at
            FROM orden_examenes_items
            WHERE orden_id = :oid
            ORDER BY created_at
        """),
        {"oid": orden_id},
    )).fetchall()

    items = [
        OrdenExamenItemResponse(
            id=str(i.id),
            orden_id=str(i.orden_id),
            examen_id=str(i.examen_id) if i.examen_id else None,
            nombre_examen=i.nombre_examen,
            categoria=i.categoria,
            grupo=i.grupo,
            resultado=i.resultado,
            estado_item=i.estado_item,
            created_at=str(i.created_at),
        )
        for i in items_rows
    ]

    return OrdenResponse(
        id=str(o.id),
        paciente_id=str(o.paciente_id),
        medico_id=str(o.medico_id),
        origen_atencion=o.origen_atencion,
        estado=o.estado,
        observaciones=o.observaciones,
        created_at=str(o.created_at),
        updated_at=str(o.updated_at),
        items=items,
    )


# ─────────────────────────────────────────────
# PATCH /ordenes/{orden_id}/item/{item_id}
# Actualizar resultado o estado de un item
# ─────────────────────────────────────────────
@router.patch("/ordenes/{orden_id}/item/{item_id}", response_model=ItemActualizarResponse)
async def actualizar_item(
    orden_id: str,
    item_id: str,
    payload: ItemActualizarRequest,
    db: AsyncSession = Depends(get_db),
):
    """Actualiza el resultado y/o estado de un item de examen."""
    # Verificar que el item pertenece a la orden
    item = (await db.execute(
        text("""
            SELECT id, nombre_examen, resultado, estado_item
            FROM orden_examenes_items
            WHERE id = :iid AND orden_id = :oid
        """),
        {"iid": item_id, "oid": orden_id},
    )).first()
    if not item:
        raise HTTPException(404, "Item no encontrado en esta orden.")

    updates = []
    params: dict = {"iid": item_id}
    if payload.resultado is not None:
        updates.append("resultado = :resultado")
        params["resultado"] = payload.resultado
    if payload.estado_item is not None:
        updates.append("estado_item = :estado")
        params["estado"] = payload.estado_item

    if not updates:
        raise HTTPException(400, "No hay campos para actualizar.")

    await db.execute(
        text(f"UPDATE orden_examenes_items SET {', '.join(updates)} WHERE id = :iid"),
        params,
    )

    # Recalcular estado de la orden
    await db.execute(
        text("""
            UPDATE ordenes_medicas
            SET estado = CASE
                WHEN EXISTS (
                    SELECT 1 FROM orden_examenes_items
                    WHERE orden_id = :oid AND estado_item = 'pendiente'
                ) THEN 'en_proceso'
                WHEN NOT EXISTS (
                    SELECT 1 FROM orden_examenes_items
                    WHERE orden_id = :oid AND estado_item != 'completado'
                ) THEN 'completado'
                ELSE 'en_proceso'
            END
            WHERE id = :oid
        """),
        {"oid": orden_id},
    )

    await db.commit()

    # Obtener estado actualizado de la orden
    orden_estado = (await db.execute(
        text("SELECT estado FROM ordenes_medicas WHERE id = :oid"),
        {"oid": orden_id},
    )).first()

    return ItemActualizarResponse(
        id=str(item_id),
        nombre_examen=item.nombre_examen,
        resultado=payload.resultado if payload.resultado is not None else item.resultado,
        estado_item=payload.estado_item or item.estado_item,
        orden_estado=orden_estado.estado if orden_estado else "pendiente",
        updated_at="now()",
    )
