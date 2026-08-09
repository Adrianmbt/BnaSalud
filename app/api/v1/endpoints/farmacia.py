from typing import List, Optional

from fastapi import APIRouter, Query, status

from app.api.v1.errors import db_fail, fail, not_found
from app.core.database import supabase
from app.schemas.schemas import (
    DespacharRecetaRequestSchema,
    InventarioItemSchema,
    RecetaDetalleItemSchema,
    RecetaResponseSchema,
)

router = APIRouter(tags=["Farmacia"])


def _a_receta(fila: dict) -> RecetaResponseSchema:
    return RecetaResponseSchema(
        id=fila["id"],
        codigo_receta=fila.get("codigo_receta", ""),
        paciente_cedula=fila.get("paciente_cedula", ""),
        paciente_nombre=fila.get("paciente_nombre", ""),
        medico=fila.get("medico", ""),
        estado=fila.get("estado", "PENDIENTE"),
        fecha_emision=str(fila.get("created_at") or "")[:16],
        detalles=_detalles_receta(fila["id"]),
    )


def _detalles_receta(receta_id: int) -> List[RecetaDetalleItemSchema]:
    try:
        detalles = (
            supabase.table("receta_detalles")
            .select("medicamento_id, cantidad_prescrita, cantidad_despachada, posologia")
            .eq("receta_id", receta_id)
            .execute()
            .data
            or []
        )
    except Exception:
        db_fail("consultar los detalles de la receta")
    if not detalles:
        return []
    try:
        inventario = (
            supabase.table("inventario_medicamentos")
            .select("id, nombre")
            .in_("id", [d["medicamento_id"] for d in detalles])
            .execute()
            .data
            or []
        )
    except Exception:
        db_fail("consultar el inventario de medicamentos")
    nombres = {m["id"]: m.get("nombre", "") for m in inventario}

    return [
        RecetaDetalleItemSchema(
            medicamento_id=d["medicamento_id"],
            nombre_medicamento=nombres.get(d["medicamento_id"], "Desconocido"),
            cantidad_prescrita=d.get("cantidad_prescrita", 0),
            cantidad_despachada=d.get("cantidad_despachada", 0),
            posologia=d.get("posologia", ""),
        )
        for d in detalles
    ]


@router.get("/recetas/{codigo_o_cedula}", response_model=RecetaResponseSchema)
def buscar_receta(codigo_o_cedula: str) -> RecetaResponseSchema:
    """Busca una receta por código (RX-2026-XXXX) o por cédula del paciente."""
    texto = codigo_o_cedula.strip().replace("#", "").upper()
    if not texto:
        not_found("Receta")

    try:
        if texto.startswith("RX-"):
            filas = (
                supabase.table("recetas")
                .select("*")
                .eq("codigo_receta", texto)
                .execute()
                .data
            )
        else:
            filas = (
                supabase.table("recetas")
                .select("*")
                .ilike("paciente_cedula", f"%{texto}")
                .order("id", desc=True)
                .limit(5)
                .execute()
                .data
            )
    except Exception:
        db_fail("buscar la receta")

    if not filas:
        not_found("Receta")

    fila = filas[0]
    return _a_receta(fila)


@router.get("/recetas/pendientes", response_model=List[RecetaResponseSchema])
def listar_recetas_pendientes(
    limite: int = Query(default=20, ge=1, le=50),
    centro_id: Optional[int] = None,
) -> List[RecetaResponseSchema]:
    """Recetas emitidas por los médicos pendientes de despacho en la farmacia."""
    try:
        query = (
            supabase.table("recetas")
            .select("*")
            .neq("estado", "DESPACHADA")
            .order("id", desc=True)
            .limit(limite)
        )
        filas = query.execute().data or []
    except Exception:
        db_fail("consultar las recetas pendientes")

    return [_a_receta(f) for f in filas]


@router.get("/inventario", response_model=List[InventarioItemSchema])
def listar_inventario(
    q: str = Query(default="", description="Filtra por nombre del medicamento"),
    solo_alertas: bool = Query(default=False, description="Solo medicamentos bajo o sin stock"),
) -> List[InventarioItemSchema]:
    """Inventario de la farmacia para verificar disponibilidad de lo recetado."""
    try:
        query = supabase.table("inventario_medicamentos").select("*").eq("activo", True)
        if q:
            query = query.ilike("nombre", f"%{q}%")
        filas = query.order("nombre").execute().data or []
    except Exception:
        db_fail("consultar el inventario")

    resultado: List[InventarioItemSchema] = []
    for m in filas:
        stock = m.get("stock_actual") or 0
        minimo = m.get("stock_minimo")
        if solo_alertas and (minimo is None or stock > minimo):
            continue
        resultado.append(
            InventarioItemSchema(
                id=m["id"],
                nombre=m.get("nombre", ""),
                presentacion=m.get("presentacion"),
                concentracion=m.get("concentracion"),
                stock_actual=stock,
                stock_minimo=minimo,
                unidad=m.get("unidad", "unidad"),
                categoria=m.get("categoria"),
                vencimiento=m.get("vencimiento"),
            )
        )
    return resultado


@router.post("/despachar", status_code=status.HTTP_200_OK)
def despachar_receta(payload: DespacharRecetaRequestSchema) -> dict:
    """Despacha una receta: valida existencias, descuenta inventario y actualiza estados."""
    try:
        receta = (
            supabase.table("recetas")
            .select("id, estado")
            .eq("id", payload.receta_id)
            .execute()
            .data
        )
    except Exception:
        db_fail("validar la receta")
    if not receta:
        not_found("Receta")
    if receta[0].get("estado", "PENDIENTE").upper() == "DESPACHADA":
        fail("La receta ya fue despachada.", status.HTTP_409_CONFLICT)

    detalles = {
        d["medicamento_id"]: d
        for d in (
            supabase.table("receta_detalles")
            .select("medicamento_id, cantidad_prescrita, cantidad_despachada, id")
            .eq("receta_id", payload.receta_id)
            .execute()
            .data
            or []
        )
    }

    # 1. Validar cantidades contra la receta
    for item in payload.items:
        detalle = detalles.get(item.medicamento_id)
        if not detalle:
            fail(f"El medicamento {item.medicamento_id} no pertenece a esta receta.")
        restante = detalle.get("cantidad_prescrita", 0) - detalle.get(
            "cantidad_despachada", 0
        )
        if item.cantidad_despachada > restante:
            fail(
                f"Cantidad a despachar excede lo prescrito para el medicamento {item.medicamento_id}."
            )

    # 2. Validar existencias en inventario
    ids = [i.medicamento_id for i in payload.items]
    try:
        inventario = {
            m["id"]: m
            for m in (
                supabase.table("inventario_medicamentos")
                .select("id, nombre, stock_actual")
                .in_("id", ids)
                .execute()
                .data
                or []
            )
        }
    except Exception:
        db_fail("consultar el inventario")
    for item in payload.items:
        med = inventario.get(item.medicamento_id)
        if not med:
            fail(f"Medicamento {item.medicamento_id} no existe en el inventario.")
        if (med.get("stock_actual") or 0) < item.cantidad_despachada:
            fail(
                f"Stock insuficiente de {med.get('nombre', '')}: disponible {med.get('stock_actual', 0)}.",
                status.HTTP_409_CONFLICT,
            )

    # 3. Aplicar despacho
    try:
        for item in payload.items:
            detalle = detalles[item.medicamento_id]
            supabase.table("inventario_medicamentos").update(
                {"stock_actual": (inventario[item.medicamento_id].get("stock_actual") or 0) - item.cantidad_despachada}
            ).eq("id", item.medicamento_id).execute()
            supabase.table("receta_detalles").update(
                {"cantidad_despachada": detalle.get("cantidad_despachada", 0) + item.cantidad_despachada}
            ).eq("id", detalle["id"]).execute()
        supabase.table("recetas").update({"estado": "DESPACHADA"}).eq(
            "id", payload.receta_id
        ).execute()
    except Exception:
        db_fail("procesar el despacho")

    total_despachado = sum(i.cantidad_despachada for i in payload.items)
    return {
        "status": "success",
        "message": "Despacho procesado e inventario actualizado con éxito",
        "receta_id": payload.receta_id,
        "medicamentos_despachados": total_despachado,
    }
