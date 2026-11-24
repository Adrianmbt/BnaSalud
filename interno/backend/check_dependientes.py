"""Verificar dependientes de Oswaldo Garcia."""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import engine


async def check():
    async with engine.begin() as conn:
        # Verificar si es empleado con cargas
        result = await conn.execute(
            text(
                "SELECT d.id, d.nombre, d.apellido, d.cedula, d.fecha_nacimiento, d.parentesco "
                "FROM dependientes d "
                "JOIN empleados e ON e.id = d.empleado_id "
                "WHERE e.personal_id = 999"
            )
        )
        filas = result.mappings().all()
        print(f"Dependientes de Oswaldo Garcia (ID 999):")
        if not filas:
            print("  No tiene dependientes registrados.")
        else:
            for fila in filas:
                print(f"  ID: {fila['id']}")
                print(f"  Nombre: {fila['nombre']} {fila['apellido']}")
                print(f"  Cédula: {fila['cedula']}")
                print(f"  Parentesco: {fila['parentesco']}")
                print(f"  Fecha Nacimiento: {fila['fecha_nacimiento']}")
                print()


if __name__ == "__main__":
    asyncio.run(check())
