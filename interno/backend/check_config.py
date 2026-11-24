"""Verificar configuración de WhatsApp."""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import engine


async def check():
    async with engine.begin() as conn:
        result = await conn.execute(text('SELECT * FROM configuracion_whatsapp'))
        filas = result.mappings().all()
        print("Configuración de WhatsApp:")
        for fila in filas:
            print(f"  ID: {fila['id']}, Clínica ID: {fila['clinica_id']}, Instance: {fila['instance_name']}")
            print(f"  Teléfono: {fila['telefono_origen']}, Activo: {fila['activo']}")


if __name__ == "__main__":
    asyncio.run(check())
