"""Verificar si existe Osmaldo Garcia en la base de datos."""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import engine


async def check():
    async with engine.begin() as conn:
        result = await conn.execute(
            text(
                "SELECT id, nombre, apellido, cargo, cedula, especialidad "
                "FROM personal "
                "WHERE LOWER(nombre) LIKE '%oswaldo%' "
                "   OR LOWER(nombre) LIKE '%osmar%' "
                "   OR LOWER(apellido) LIKE '%garcia%' "
                "ORDER BY nombre, apellido"
            )
        )
        filas = result.mappings().all()
        print("Registros encontrados:")
        for fila in filas:
            print(f"  ID: {fila['id']}")
            print(f"  Nombre: {fila['nombre']} {fila['apellido']}")
            print(f"  Cédula: {fila['cedula']}")
            print(f"  Cargo: {fila['cargo']}")
            print(f"  Especialidad: {fila['especialidad']}")
            print()


if __name__ == "__main__":
    asyncio.run(check())
