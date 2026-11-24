"""Verificar información de personal."""
import asyncio
from sqlalchemy import text
from app.core.database import engine


async def check():
    async with engine.begin() as conn:
        # Verificar información de Oswaldo Garcia
        result = await conn.execute(
            text("SELECT * FROM personal WHERE id = 999")
        )
        fila = result.mappings().first()
        print("Información de Oswaldo Garcia (ID 999):")
        if fila:
            for key, value in fila.items():
                print(f"  {key}: {value}")
        else:
            print("  No encontrado.")


if __name__ == "__main__":
    asyncio.run(check())
