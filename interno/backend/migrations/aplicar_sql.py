"""Aplica una migración SQL del directorio migrations/ contra la BD.

Uso: python migrations/aplicar_sql.py migrations/015_medicos_reales.sql
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from app.core.database import engine

async def main(file_path):
    sql = Path(file_path).read_text(encoding="utf-8")
    async with engine.begin() as conn:
        for stmt in sql.split(";"):
            stmt = "\n".join(
                ln for ln in stmt.splitlines()
                if not ln.strip().startswith("--")
            ).strip()
            if not stmt:
                continue
            await conn.execute(text(stmt))
            print(f"[ok] {stmt[:70]}...")
    print("[listo] migración aplicada")

asyncio.run(main(sys.argv[1]))