"""Catálogo de medicamentos para recetas médicas.

Lista los medicamentos disponibles para recetar y permite a los médicos
(emergencias y especialistas) agregar nuevos medicamentos a la data.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.medicamentos import (
    MedicamentoCreadoResponse,
    MedicamentoCrearRequest,
    MedicamentoItem,
    MedicamentoListaResponse,
)

router = APIRouter(tags=["Medicamentos"])


def _normalizar(s: str) -> str:
    return (s or "").strip().lower()


def _a_item(fila) -> MedicamentoItem:
    return MedicamentoItem(
        id=fila["id"],
        nombre=fila["nombre"],
        presentacion=fila["presentacion"] or "",
        concentracion=fila["concentracion"] or "",
        posologia_sugerida=fila["posologia_sugerida"] or "",
        creado_por=fila.get("creado_por"),
    )


def _buscar_duplicado(db: AsyncSession, nombre: str, presentacion: str, concentracion: str):
    return db.execute(
        text(
            "SELECT id FROM medicamentos_catalogo "
            "WHERE activo = TRUE "
            "  AND nombre ILIKE :n "
            "  AND COALESCE(presentacion, '') ILIKE :p "
            "  AND COALESCE(concentracion, '') ILIKE :c "
            "LIMIT 1"
        ),
        {"n": nombre, "p": presentacion, "c": concentracion},
    )


@router.get("", response_model=MedicamentoListaResponse, summary="Lista el catálogo de medicamentos activos")
async def listar_medicamentos(
    q: str = "",
    db: AsyncSession = Depends(get_db),
) -> MedicamentoListaResponse:
    """Catálogo de medicamentos (activos), opcionalmente filtrado por texto."""
    q = q.strip()
    if q:
        r = await db.execute(
            text(
                "SELECT id, nombre, presentacion, concentracion, posologia_sugerida, creado_por "
                "FROM medicamentos_catalogo "
                "WHERE activo = TRUE AND nombre ILIKE :q "
                "ORDER BY nombre, concentracion NULLS LAST"
            ),
            {"q": f"%{q}%"},
        )
    else:
        r = await db.execute(
            text(
                "SELECT id, nombre, presentacion, concentracion, posologia_sugerida, creado_por "
                "FROM medicamentos_catalogo "
                "WHERE activo = TRUE "
                "ORDER BY nombre, concentracion NULLS LAST"
            )
        )
    filas = r.mappings().all()
    items = [_a_item(f) for f in filas]
    return MedicamentoListaResponse(items=items, total=len(items))


@router.post(
    "",
    response_model=MedicamentoCreadoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registra un nuevo medicamento en el catálogo",
)
async def crear_medicamento(
    payload: MedicamentoCrearRequest,
    db: AsyncSession = Depends(get_db),
) -> MedicamentoCreadoResponse:
    """Agrega un medicamento al catálogo (evita duplicados por nombre/presentación/concentración)."""
    nombre = payload.nombre.strip()
    presentacion = (payload.presentacion or "").strip()
    concentracion = (payload.concentracion or "").strip()
    posologia = (payload.posologia_sugerida or "").strip()

    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre del medicamento es obligatorio.")

    r = await _buscar_duplicado(db, nombre, presentacion, concentracion)
    if r.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El medicamento '{nombre}' ya existe en el catálogo.",
        )

    try:
        r = await db.execute(
            text(
                "INSERT INTO medicamentos_catalogo "
                "(nombre, presentacion, concentracion, posologia_sugerida, creado_por, activo) "
                "VALUES (:n, :p, :c, :pos, :cp, TRUE) "
                "RETURNING id, nombre, presentacion, concentracion, posologia_sugerida, creado_por, created_at"
            ),
            {
                "n": nombre,
                "p": presentacion or None,
                "c": concentracion or None,
                "pos": posologia or None,
                "cp": payload.creado_por or None,
            },
        )
        await db.commit()
    except Exception as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al registrar el medicamento: {err}",
        )

    fila = r.mappings().first()
    return MedicamentoCreadoResponse(
        id=fila["id"],
        nombre=fila["nombre"],
        presentacion=fila["presentacion"] or "",
        concentracion=fila["concentracion"] or "",
        posologia_sugerida=fila["posologia_sugerida"] or "",
        creado_por=fila.get("creado_por"),
        created_at=fila["created_at"],
    )