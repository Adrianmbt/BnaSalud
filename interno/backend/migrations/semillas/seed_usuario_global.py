"""Semilla de usuario global (admin_sistemas) idempotente.

Crea/actualiza adrianbello con rol admin_sistemas y sin clínica asignada
(global), igual que oswaldo. Ambos son los administradores técnicos que
gestionan usuarios, nómina, logs y stock de cualquier centro de forma remota.

Ejecutar desde backend/: python migrations/semillas/seed_usuario_global.py
"""
import asyncio
import uuid
from pathlib import Path

import asyncpg
import bcrypt

USUARIOS = {
    "adrianbello": {"password": "19674244", "rol": "admin_sistemas"},
}


def _datos_conexion() -> str:
    env = Path(__file__).resolve().parent.parent.parent / ".env"
    for linea in env.read_text(encoding="utf-8").splitlines():
        if linea.startswith("DATABASE_URL="):
            return linea.split("=", 1)[1].strip().replace("+asyncpg", "")
    raise SystemExit("No se encontró DATABASE_URL en backend/.env")


async def main():
    conn = await asyncpg.connect(_datos_conexion())
    try:
        for username, datos in USUARIOS.items():
            existing = await conn.fetchval(
                "SELECT id FROM usuarios WHERE username = $1", username
            )
            hash_pw = bcrypt.hashpw(datos["password"].encode(), bcrypt.gensalt()).decode()
            if existing:
                await conn.execute(
                    "UPDATE usuarios SET password_hash = $1, rol = $2, activo = TRUE, "
                    "clinica_id = NULL WHERE id = $3",
                    hash_pw, datos["rol"], existing,
                )
                print(f"Actualizado {username} (rol {datos['rol']}, global).")
            else:
                await conn.execute(
                    "INSERT INTO usuarios (id, username, password_hash, rol, activo, created_at) "
                    "VALUES ($1, $2, $3, $4, TRUE, NOW())",
                    uuid.uuid4(), username, hash_pw, datos["rol"],
                )
                print(f"Creado {username} (rol {datos['rol']}, global).")
        print("Seeds de usuarios globales aplicados.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())