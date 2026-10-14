"""Semilla del catálogo de medicamentos para recetas médicas (idempotente).

Crea la tabla `medicamentos_catalogo` si no existe y carga un conjunto
básico de medicamentos comunes de emergencias con su posología sugerida.
Los médicos (emergencias y especialistas) pueden agregar más medicamentos
vía `POST /api/v1/medicamentos`, que quedan persistidos aquí.

La tabla NO es el inventario de farmacia (`inventario_medicamentos`); es
solo el catálogo de nombres/presentaciones usados al recetar.

Uso:
    python -m app.seed_medicamentos
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings

DDL_CATALOGO = """
CREATE TABLE IF NOT EXISTS medicamentos_catalogo (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL,
    presentacion TEXT,
    concentracion TEXT,
    posologia_sugerida TEXT,
    creado_por TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

DDL_INDICE = """
CREATE UNIQUE INDEX IF NOT EXISTS uq_medicamentos_nombre
    ON medicamentos_catalogo (nombre, COALESCE(presentacion, ''), COALESCE(concentracion, ''));
"""

# (nombre, presentacion, concentracion, posologia_sugerida)
SEMILLA = [
    ("Paracetamol", "tableta", "500 mg", "1 tableta c/8 h × 5 días"),
    ("Ibuprofeno", "tableta", "400 mg", "1 tableta c/8 h × 5 días"),
    ("Amoxicilina", "cápsula", "500 mg", "1 cápsula c/8 h × 7 días"),
    ("Omeprazol", "cápsula", "20 mg", "1 cápsula c/24 h en ayunas × 7 días"),
    ("Metoclopramida", "tableta", "10 mg", "1 tableta c/8 h × 3 días"),
    ("Dipirona", "tableta", "500 mg", "1 tableta c/8 h c/necesidad × 3 días"),
    ("Losartán", "tableta", "50 mg", "1 tableta c/24 h × 30 días"),
    ("Salbutamol", "inhalador", "100 mcg/dosis", "2 inhalaciones c/6-8 h SOS"),
    ("Hidrocortisona", "tableta", "20 mg", "1 tableta c/12 h × 5 días"),
    ("Ketorolaco", "tableta", "10 mg", "1 tableta c/8 h × 3 días"),
    ("Clorfenamina", "tableta", "4 mg", "1 tableta c/12 h × 5 días"),
    ("Dexametasona", "tableta", "4 mg", "1 tableta c/12 h × 5 días"),
    ("Azitromicina", "cápsula", "500 mg", "1 cápsula c/24 h × 3 días"),
    ("Ipratropio", "inhalador", "20 mcg/dosis", "2 inhalaciones c/8 h SOS"),
    ("Tramadol", "gota", "100 mg/ml", "20 gotas c/12 h × 5 días"),
]


def _clave(nombre: str, presentacion: str = "", concentracion: str = "") -> str:
    return "|".join(
        (
            (nombre or "").strip().lower(),
            (presentacion or "").strip().lower(),
            (concentracion or "").strip().lower(),
        )
    )


async def seed():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as db:
        await db.execute(text(DDL_CATALOGO))
        await db.execute(text(DDL_INDICE))
        print("[ok] tabla medicamentos_catalogo asegurada")

        # Prevent embedded quotes/duplicados por clave normalizada.
        fila = await db.execute(text("SELECT nombre, presentacion, concentracion FROM medicamentos_catalogo"))
        existentes = {_clave(r.nombre, r.presentacion, r.concentracion) for r in fila.fetchall()}

        insertados = 0
        saltados = 0
        for nombre, presentacion, concentracion, posologia in SEMILLA:
            clave = _clave(nombre, presentacion, concentracion)
            if clave in existentes:
                saltados += 1
                continue
            await db.execute(
                text(
                    "INSERT INTO medicamentos_catalogo "
                    "(nombre, presentacion, concentracion, posologia_sugerida, creado_por, activo) "
                    "VALUES (:n, :p, :c, :pos, 'semilla', TRUE)"
                ),
                {"n": nombre, "p": presentacion, "c": concentracion, "pos": posologia},
            )
            insertados += 1

        print(f"[ok] catálogo: {insertados} medicamentos insertados, {saltados} ya existían")

    await engine.dispose()
    print("Seed medicamentos listo.")


if __name__ == "__main__":
    asyncio.run(seed())