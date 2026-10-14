"""Semilla de la agenda de especialistas (idempotente) para el módulo de remisión.

Crea la tabla `agenda_medicos` si no existe y asigna, por defecto, que cada
especialista atiende los días laborables (lunes a viernes) en los turnos
Mañana y Tarde. Es disponibilidad provisional hasta que se carguen los
horarios reales. No borra ni duplica datos existentes.

Uso:
    python -m app.seed_agenda
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings

DDL_AGENDA = """
CREATE TABLE IF NOT EXISTS agenda_medicos (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    medico_id INTEGER NOT NULL REFERENCES personal(id),
    dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    turno_id INTEGER NOT NULL REFERENCES turnos(id),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (medico_id, dia_semana, turno_id)
);
"""

# Días laborables (lunes=0 ... viernes=4) y turnos por defecto.
DIAS_LABORABLES = [0, 1, 2, 3, 4]
TURNOS_DEFECTO = ["Mañana", "Tarde"]


async def seed():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as db:
        await db.execute(text(DDL_AGENDA))
        print("[ok] tabla agenda_medicos asegurada")

        # Turnos existentes por nombre.
        turnos = {}
        r = await db.execute(text("SELECT id, nombre FROM turnos"))
        for row in r.fetchall():
            turnos[row.nombre] = row.id
        turnos_ids = [turnos[n] for n in TURNOS_DEFECTO if n in turnos]
        if not turnos_ids:
            print("[warn] no se encontraron turnos Mañana/Tarde; saltando agenda")
            await engine.dispose()
            return

        # Especialistas: personal con cargo 'Médico' y especialidad no nula
        # (+ el médico de emergencia, que siempre queda disponible).
        r = await db.execute(
            text(
                "SELECT p.id, p.nombre, p.especialidad, "
                "       EXISTS(SELECT 1 FROM usuarios u "
                "              WHERE u.personal_id = p.id AND u.rol = 'medico_emergencia') AS emergencia "
                "FROM personal p "
                "WHERE (p.cargo = 'Médico' AND p.especialidad IS NOT NULL) "
                "   OR EXISTS(SELECT 1 FROM usuarios u "
                "              WHERE u.personal_id = p.id AND u.rol = 'medico_emergencia') "
                "ORDER BY p.especialidad NULLS LAST, p.nombre"
            )
        )
        especialistas = r.fetchall()

        if not especialistas:
            print("[warn] no hay especialistas en personal")
            await engine.dispose()
            return

        insertados = 0
        saltados = 0
        for esp in especialistas:
            for dia in DIAS_LABORABLES:
                for turno_id in turnos_ids:
                    existe = (
                        await db.execute(
                            text(
                                "SELECT 1 FROM agenda_medicos "
                                "WHERE medico_id=:m AND dia_semana=:d AND turno_id=:t"
                            ),
                            {"m": esp.id, "d": dia, "t": turno_id},
                        )
                    ).first()
                    if existe:
                        saltados += 1
                        continue
                    await db.execute(
                        text(
                            "INSERT INTO agenda_medicos (medico_id, dia_semana, turno_id, activo) "
                            "VALUES (:m, :d, :t, TRUE)"
                        ),
                        {"m": esp.id, "d": dia, "t": turno_id},
                    )
                    insertados += 1
        print(f"[ok] agenda: {insertados} disponibilidades insertadas, {saltados} ya existían")

    await engine.dispose()
    print("Seed agenda listo (" + str(len(especialistas)) + " especialistas).")


if __name__ == "__main__":
    asyncio.run(seed())
