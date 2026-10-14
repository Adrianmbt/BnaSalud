"""Semilla idempotente: columna `antecedentes_operatorios` en historias_clinicas.

Agrega la columna JSONB para registrar si el paciente fue operado anteriormente
(cirugías previas), espejo del campo `antecedentes_medicos`.

Uso:
    python -m app.seed_antecedentes_operatorios
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings

DDL = """
ALTER TABLE historias_clinicas
    ADD COLUMN IF NOT EXISTS antecedentes_operatorios JSONB NOT NULL DEFAULT '[]'::jsonb;
"""


async def seed():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as db:
        await db.execute(text(DDL))
        print("[ok] columna antecedentes_operatorios asegurada en historias_clinicas")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())