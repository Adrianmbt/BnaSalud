"""Limpieza de datos de semilla previa a la entrega.

Elimina todo stock_por_centro (tabla nacida de la semilla) dejando el sistema
en estado 0 con solo los usuarios. Reejecutar la semilla la vuelve a poblar.

Ejecutar desde backend/: python migrations/semillas/limpiar_semillas.py
"""
import asyncio
from pathlib import Path

import asyncpg


def _datos_conexion() -> str:
    env = Path(__file__).resolve().parent.parent.parent / ".env"
    for linea in env.read_text(encoding="utf-8").splitlines():
        if linea.startswith("DATABASE_URL="):
            return linea.split("=", 1)[1].strip().replace("+asyncpg", "")
    raise SystemExit("No se encontró DATABASE_URL en backend/.env")


async def main():
    conn = await asyncpg.connect(_datos_conexion())
    try:
        n = await conn.fetchval("SELECT COUNT(*) FROM stock_por_centro")
        await conn.execute("DELETE FROM stock_por_centro")
        print(f"stock_por_centro limpiado: {n} filas eliminadas.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())