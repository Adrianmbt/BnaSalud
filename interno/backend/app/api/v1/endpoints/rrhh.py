"""Recursos Humanos: carga masiva de la nómina consolidada en Excel.

Sincroniza `empleados` por cédula (upsert) y da de baja por inactivación a
quien no venga en el archivo. Nunca borra filas: la tabla `beneficiarios`
cuelga de `empleados` con `ON DELETE CASCADE`.
"""
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.services import nomina

router = APIRouter(tags=["Recursos Humanos"])

MAX_BYTES = 40 * 1024 * 1024


async def _leer(file: UploadFile):
    """Lee el Excel subido y devuelve (registros, errores, advertencias, cédulas, resumen)."""
    datos = await file.read()
    if len(datos) > MAX_BYTES:
        raise HTTPException(400, "El archivo supera el tamaño máximo (40 MB).")
    try:
        return nomina.leer_nomina(datos, file.filename or "")
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/nomina/previsualizar")
async def previsualizar_nomina(
    file: UploadFile = File(...),
    inactivar_no_presentes: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Valida el Excel y devuelve el resumen sin tocar la base de datos."""
    registros, errores, advertencias, cedulas_presentes, resumen = await _leer(file)
    try:
        vista = await nomina.previsualizar(
            db, registros, cedulas_presentes, inactivar_no_presentes
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {
        **vista,
        "resumen": resumen,
        "errores_fila": errores,
        "advertencias": advertencias,
    }


@router.post("/nomina/importar")
async def importar_nomina(
    file: UploadFile = File(...),
    inactivar_no_presentes: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Aplica la nómina en una sola transacción y la registra en la bitácora."""
    registros, errores, advertencias, cedulas_presentes, resumen = await _leer(file)
    try:
        resultado = await nomina.sincronizar(
            db,
            registros,
            cedulas_presentes,
            inactivar_no_presentes=inactivar_no_presentes,
            archivo=resumen.get("archivo") or (file.filename or ""),
            usuario=user,
            resumen=resumen,
            errores_fila=len(errores),
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {
        **resultado,
        "resumen": resumen,
        "errores_fila": errores,
        "advertencias": advertencias,
    }
