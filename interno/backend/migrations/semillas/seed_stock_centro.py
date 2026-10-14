"""Semilla de stock por centro (doble libro).

Reparte el inventario entre los centros reales (códigos sin prefijo CLN-)
escribiendo en stock_por_centro y ajustando el global para que se cumpla
   SUM(stock_por_centro) == insumos_catalogo.stock_actual (por insumo).

Ejecutar desde backend/: python migrations/semillas/seed_stock_centro.py [base_por_centro]
"""
import asyncio
import sys
from pathlib import Path

import asyncpg


def _datos_conexion() -> str:
    env = Path(__file__).resolve().parent.parent.parent / ".env"
    for linea in env.read_text(encoding="utf-8").splitlines():
        if linea.startswith("DATABASE_URL="):
            return linea.split("=", 1)[1].strip().replace("+asyncpg", "")
    raise SystemExit("No se encontró DATABASE_URL en backend/.env")


BASE_POR_CENTRO = int(sys.argv[1]) if len(sys.argv) > 1 else 20


async def main():
    conn = await asyncpg.connect(_datos_conexion())
    try:
        centros = await conn.fetch(
            "SELECT id FROM clinicas WHERE activo = TRUE AND codigo !~ '^CLN-' ORDER BY id"
        )
        if not centros:
            print("No hay centros reales activos (códigos sin CLN-).")
            return
        cids = [c["id"] for c in centros]
        insumos = await conn.fetch(
            "SELECT id, stock_actual FROM insumos_catalogo WHERE activo = TRUE ORDER BY id"
        )
        if not insumos:
            print("No hay insumos activos en el catálogo.")
            return

        total = BASE_POR_CENTRO * len(cids)
        insertadas = 0
        for ins in insumos:
            objetivo = max(ins["stock_actual"], total)
            for i, cid in enumerate(cids):
                cant = BASE_POR_CENTRO + (objetivo - total if i == 0 else 0)
                await conn.execute(
                    """INSERT INTO stock_por_centro (insumo_id, clinica_id, stock_actual)
                       VALUES ($1, $2, $3)
                       ON CONFLICT (insumo_id, clinica_id)
                       DO UPDATE SET stock_actual = EXCLUDED.stock_actual""",
                    ins["id"], cid, cant,
                )
                insertadas += 1
            await conn.execute(
                "UPDATE insumos_catalogo SET stock_actual = $1 WHERE id = $2",
                objetivo, ins["id"],
            )

        print(f"Seed aplicado: {len(insumos)} insumos x {len(cids)} centros "
              f"(base {BASE_POR_CENTRO}/centro) = {insertadas} filas en stock_por_centro.")
        print(f"Centros: {cids}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())