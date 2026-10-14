"""Backup de personal (ids 17-36) y agenda_medicos de esos médicos.

Genera el archivo SQL de restauración en migrations/backups/ antes de
aplicar 015_medicos_reales.sql. Solo lee la base de datos.
"""
import asyncio
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from app.core.database import engine

PATH = Path(__file__).resolve().parent / "backups"

async def main():
    PATH.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = PATH / f"backup_medicos_{stamp}.sql"
    lines = [f"-- Backup médicos reales (personal 17-36 + agenda_medicos) - {stamp}"]

    async with engine.connect() as conn:
        r = await conn.execute(
            text("SELECT id, cedula, nombre, apellido, cargo, especialidad, clinica_id "
                 "FROM personal WHERE id BETWEEN 17 AND 36 ORDER BY id")
        )
        rows = r.fetchall()
        lines.append(f"-- personal: {len(rows)} registros")
        for p in rows:
            vals = "', '".join(str(x) if x is not None else "NULL" for x in p)
            lines.append(f"INSERT INTO personal (id, cedula, nombre, apellido, cargo, especialidad, clinica_id) VALUES ('{vals}');")

        r = await conn.execute(
            text("SELECT medico_id, dia_semana, turno_id, activo FROM agenda_medicos "
                 "WHERE medico_id BETWEEN 17 AND 36 ORDER BY medico_id, dia_semana, turno_id")
        )
        ag = r.fetchall()
        lines.append(f"-- agenda_medicos: {len(ag)} registros")
        for a in ag:
            lines.append(f"INSERT INTO agenda_medicos (medico_id, dia_semana, turno_id, activo) VALUES ({a[0]}, {a[1]}, {a[2]}, {a[3]});")

    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[ok] backup escrito: {dest}")

asyncio.run(main())