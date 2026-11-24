"""Catálogo maestro de insumos y medicamentos (panel del Director).

Un solo catálogo (`catalogo_insumos`) alimenta el buscador de las órdenes de
entrega y el inventario normalizado por centro (`inventario_centro`). Las
órdenes escriben además `tipo`/`item_key`/`nombre`/`unidad`/`cantidad` en
`ordenes_entrega_items` para que el sistema interno las reciba sin cambios.
"""
from __future__ import annotations

import re
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.api.v1.deps import exigir_rol_global
from app.api.v1.errors import db_fail, fail, not_found
from app.core.bitacora import registrar_accion
from app.core.database import supabase

router = APIRouter(tags=["Catálogo de insumos"])

Categoria = Literal["Medicamento", "Insumo Médico", "Material Quirúrgico", "Otro"]
CATEGORIAS = ("Medicamento", "Insumo Médico", "Material Quirúrgico", "Otro")
CAMPOS = "id, codigo, nombre, categoria, presentacion, unidad_medida, activo, created_at"


# ─── Schemas ───────────────────────────────────────────────────────

class CatalogoCreate(BaseModel):
    codigo: Optional[str] = Field(default=None, max_length=40)
    nombre: str = Field(..., min_length=2, max_length=200)
    categoria: Categoria = "Medicamento"
    presentacion: Optional[str] = Field(default=None, max_length=120)
    unidad_medida: Optional[str] = Field(default=None, max_length=40)


class CatalogoUpdate(BaseModel):
    codigo: Optional[str] = Field(default=None, max_length=40)
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=200)
    categoria: Optional[Categoria] = None
    presentacion: Optional[str] = Field(default=None, max_length=120)
    unidad_medida: Optional[str] = Field(default=None, max_length=40)
    activo: Optional[bool] = None


# ─── Utilidades ────────────────────────────────────────────────────

def _texto(valor: Optional[str]) -> Optional[str]:
    limpio = (valor or "").strip()
    return limpio or None


def _busqueda(q: Optional[str]) -> str:
    """Quita los caracteres que rompen la sintaxis de filtros de PostgREST."""
    return re.sub(r"[(),.*%]", " ", q or "").strip()[:80]


def _duplicado(error: Exception) -> bool:
    texto = str(error).lower()
    return "23505" in texto or "duplicate key" in texto


# ─── Endpoints ─────────────────────────────────────────────────────

@router.get("")
def listar_catalogo(
    q: Optional[str] = Query(default=None, max_length=80),
    categoria: Optional[str] = Query(default=None),
    activo: Optional[bool] = Query(default=None),
    limite: int = Query(default=50, ge=1, le=200),
    _: dict = Depends(exigir_rol_global),
) -> dict:
    """Busca por nombre o código, con filtros de categoría y estado."""
    if categoria and categoria not in CATEGORIAS:
        fail("Categoría no válida.")

    try:
        consulta = supabase.table("catalogo_insumos").select(CAMPOS)
        if categoria:
            consulta = consulta.eq("categoria", categoria)
        if activo is not None:
            consulta = consulta.eq("activo", activo)
        texto = _busqueda(q)
        if texto:
            patron = f"%{texto}%"
            consulta = consulta.or_(f"nombre.ilike.{patron},codigo.ilike.{patron}")
        filas = consulta.order("nombre").limit(limite).execute().data or []
    except Exception:
        db_fail("consultar el catálogo")
    return {"items": filas}


@router.post("", status_code=status.HTTP_201_CREATED)
def crear_insumo(
    payload: CatalogoCreate,
    actor: dict = Depends(exigir_rol_global),
) -> dict:
    """Agrega un medicamento o insumo al catálogo maestro."""
    datos = {
        "codigo": _texto(payload.codigo),
        "nombre": payload.nombre.strip(),
        "categoria": payload.categoria,
        "presentacion": _texto(payload.presentacion),
        "unidad_medida": _texto(payload.unidad_medida),
    }
    if not datos["nombre"]:
        fail("El nombre no puede quedar vacío.")
    try:
        creado = supabase.table("catalogo_insumos").insert(datos).execute().data
    except Exception as error:
        if _duplicado(error):
            fail("Ya existe un ítem con ese código.", status.HTTP_409_CONFLICT)
        db_fail("crear el ítem del catálogo")
    if not creado:
        db_fail("crear el ítem del catálogo")

    registrar_accion(
        actor, "crear_insumo_catalogo", "catalogo_insumos", creado[0]["id"],
        detalle=f"{datos['nombre']} ({datos['categoria']})",
    )
    return {"mensaje": "Ítem agregado al catálogo.", "item": creado[0]}


@router.put("/{insumo_id}")
def actualizar_insumo(
    insumo_id: str,
    payload: CatalogoUpdate,
    actor: dict = Depends(exigir_rol_global),
) -> dict:
    """Edita datos o activa/desactiva un ítem (borrado lógico)."""
    cambios = payload.model_dump(exclude_unset=True)
    # Los textos opcionales se pueden limpiar con null; el resto no.
    cambios = {
        campo: valor
        for campo, valor in cambios.items()
        if valor is not None or campo in ("codigo", "presentacion", "unidad_medida")
    }
    for campo in ("codigo", "presentacion", "unidad_medida"):
        if campo in cambios:
            cambios[campo] = _texto(cambios[campo])
    if "nombre" in cambios:
        cambios["nombre"] = _texto(cambios["nombre"])
        if not cambios["nombre"]:
            fail("El nombre no puede quedar vacío.")
    if not cambios:
        fail("Indique al menos un campo a modificar.")

    try:
        actualizado = (
            supabase.table("catalogo_insumos")
            .update(cambios)
            .eq("id", insumo_id)
            .execute()
            .data
            or []
        )
    except Exception as error:
        if _duplicado(error):
            fail("Ya existe un ítem con ese código.", status.HTTP_409_CONFLICT)
        db_fail("actualizar el ítem del catálogo")
    if not actualizado:
        not_found("Ítem del catálogo")

    registrar_accion(
        actor, "actualizar_insumo_catalogo", "catalogo_insumos", insumo_id,
        detalle=", ".join(f"{c}={v}" for c, v in cambios.items()),
    )
    return {"mensaje": "Ítem actualizado.", "item": actualizado[0]}


# Insumos y medicamentos de atención primaria más comunes. `codigo` es la
# clave del upsert, así que re-ejecutar la semilla no duplica ni pisa los
# ítems ya editados por el Director.
SEED = [
    {"codigo": "MED-001", "nombre": "Paracetamol 500mg", "categoria": "Medicamento", "presentacion": "Caja x 20 tabletas", "unidad_medida": "tabletas"},
    {"codigo": "MED-002", "nombre": "Ibuprofeno 400mg", "categoria": "Medicamento", "presentacion": "Caja x 20 tabletas", "unidad_medida": "tabletas"},
    {"codigo": "MED-003", "nombre": "Amoxicilina 500mg", "categoria": "Medicamento", "presentacion": "Caja x 21 cápsulas", "unidad_medida": "cápsulas"},
    {"codigo": "MED-004", "nombre": "Azitromicina 500mg", "categoria": "Medicamento", "presentacion": "Caja x 3 tabletas", "unidad_medida": "tabletas"},
    {"codigo": "MED-005", "nombre": "Metformina 850mg", "categoria": "Medicamento", "presentacion": "Caja x 30 tabletas", "unidad_medida": "tabletas"},
    {"codigo": "MED-006", "nombre": "Losartán 50mg", "categoria": "Medicamento", "presentacion": "Caja x 30 tabletas", "unidad_medida": "tabletas"},
    {"codigo": "MED-007", "nombre": "Amlodipina 5mg", "categoria": "Medicamento", "presentacion": "Caja x 30 tabletas", "unidad_medida": "tabletas"},
    {"codigo": "MED-008", "nombre": "Omeprazol 20mg", "categoria": "Medicamento", "presentacion": "Caja x 14 cápsulas", "unidad_medida": "cápsulas"},
    {"codigo": "MED-009", "nombre": "Loratadina 10mg", "categoria": "Medicamento", "presentacion": "Caja x 10 tabletas", "unidad_medida": "tabletas"},
    {"codigo": "MED-010", "nombre": "Diclofenaco 75mg IM", "categoria": "Medicamento", "presentacion": "Ampolla 3ml", "unidad_medida": "ampollas"},
    {"codigo": "MED-011", "nombre": "Dexametasona 4mg IM", "categoria": "Medicamento", "presentacion": "Ampolla 2ml", "unidad_medida": "ampollas"},
    {"codigo": "MED-012", "nombre": "Suero fisiológico 0.9%", "categoria": "Medicamento", "presentacion": "Frasco 500ml", "unidad_medida": "frascos"},
    {"codigo": "MED-013", "nombre": "Salbutamol aerosol 100mcg", "categoria": "Medicamento", "presentacion": "Inhalador 200 dosis", "unidad_medida": "inhaladores"},
    {"codigo": "MED-014", "nombre": "Sulfato ferroso 200mg", "categoria": "Medicamento", "presentacion": "Caja x 30 tabletas", "unidad_medida": "tabletas"},
    {"codigo": "INS-001", "nombre": "Jeringa 5ml", "categoria": "Insumo Médico", "presentacion": "Unidad", "unidad_medida": "unidades"},
    {"codigo": "INS-002", "nombre": "Jeringa 10ml", "categoria": "Insumo Médico", "presentacion": "Unidad", "unidad_medida": "unidades"},
    {"codigo": "INS-003", "nombre": "Aguja hipodérmica 21G", "categoria": "Insumo Médico", "presentacion": "Unidad", "unidad_medida": "unidades"},
    {"codigo": "INS-004", "nombre": "Gasas estériles 10x10cm", "categoria": "Insumo Médico", "presentacion": "Sobre x 5 unidades", "unidad_medida": "sobres"},
    {"codigo": "INS-005", "nombre": "Guantes de examen (M)", "categoria": "Insumo Médico", "presentacion": "Caja x 100 unidades", "unidad_medida": "guantes"},
    {"codigo": "INS-006", "nombre": "Tiras reactivas de glucosa", "categoria": "Insumo Médico", "presentacion": "Frasco x 50 tiras", "unidad_medida": "tiras"},
    {"codigo": "INS-007", "nombre": "Tensiómetro aneroide", "categoria": "Insumo Médico", "presentacion": "Unidad", "unidad_medida": "unidades"},
    {"codigo": "INS-008", "nombre": "Termómetro digital", "categoria": "Insumo Médico", "presentacion": "Unidad", "unidad_medida": "unidades"},
    {"codigo": "CIR-001", "nombre": "Sutura Vicryl 3-0", "categoria": "Material Quirúrgico", "presentacion": "Sobre con aguja", "unidad_medida": "sobres"},
    {"codigo": "CIR-002", "nombre": "Hoja de bisturí N° 15", "categoria": "Material Quirúrgico", "presentacion": "Caja x 100 unidades", "unidad_medida": "hojas"},
    {"codigo": "CIR-003", "nombre": "Alcohol isopropílico 70%", "categoria": "Material Quirúrgico", "presentacion": "Frasco 500ml", "unidad_medida": "frascos"},
]


@router.post("/seed")
def sembrar_catalogo(actor: dict = Depends(exigir_rol_global)) -> dict:
    """Carga los medicamentos e insumos base de atención primaria."""
    try:
        supabase.table("catalogo_insumos").upsert(
            SEED, on_conflict="codigo", ignore_duplicates=True
        ).execute()
    except Exception:
        db_fail("cargar el catálogo inicial")

    registrar_accion(
        actor, "sembrar_catalogo_insumos", "catalogo_insumos",
        detalle=f"{len(SEED)} ítems base",
    )
    return {"mensaje": f"{len(SEED)} ítems base verificados.", "items": len(SEED)}
