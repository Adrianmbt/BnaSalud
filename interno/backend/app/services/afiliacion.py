"""Tipo de afiliación de un paciente según la nómina institucional.

`empleados` (trabajadores) y `beneficiarios` (cargas familiares) guardan la
cédula como texto libre: puede venir con puntos, espacios o prefijo `V-`/`E-`.
La comparación se hace sobre dígitos y siempre valiéndose de `activo = TRUE`,
así que dar de baja a un trabajador le quita la prioridad automáticamente.
"""
import re
from typing import Iterable

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

TRABAJADOR = "trabajador"
BENEFICIARIO = "beneficiario"
GENERAL = "general"

# Se evalúa en este orden: un beneficiario que además es trabajador activo
# cuenta como trabajador (mismo criterio que la cola de emergencia).
_TABLAS = ((BENEFICIARIO, "beneficiarios"), (TRABAJADOR, "empleados"))


def normalizar_cedula(valor) -> str:
    """Cédula solo con dígitos ('V-12.345.678' -> '12345678')."""
    return re.sub(r"\D", "", str(valor or ""))


async def categorias_por_cedula(
    db: AsyncSession, cedulas: Iterable[str]
) -> dict[str, str]:
    """Devuelve {cedula_normalizada: trabajador|beneficiario|general}."""
    limpias = {normalizar_cedula(c) for c in cedulas}
    limpias.discard("")
    categorias = {c: GENERAL for c in limpias}
    if not limpias:
        return categorias

    for categoria, tabla in _TABLAS:
        consulta = text(
            f"SELECT DISTINCT regexp_replace(cedula, '\\D', '', 'g') AS ced "
            f"FROM {tabla} "
            "WHERE activo = TRUE "
            "  AND regexp_replace(cedula, '\\D', '', 'g') IN :cedulas"
        ).bindparams(bindparam("cedulas", expanding=True))
        for (cedula,) in (await db.execute(consulta, {"cedulas": list(limpias)})).all():
            if cedula:
                categorias[cedula] = categoria

    return categorias
