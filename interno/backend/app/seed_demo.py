"""Semilla de datos de prueba (idempotente) para validar el módulo de emergencias.

Inserta trabajadores (empleados), beneficiarios e historias clínicas de prueba
solo si no existen (por cédula). No borra ni modifica datos existentes.

Uso:
    python -m app.seed_demo
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings


TRABAJADORES = [
    {
        "cedula": "25874136",
        "nombre_completo": "Luisana Rondón",
        "edad": 34,
        "cargo": "Supervisor de Planta",
    },
    {
        "cedula": "16987452",
        "nombre_completo": "Ramón Ávila",
        "edad": 45,
        "cargo": "Técnico",
    },
]

BENEFICIARIOS = [
    ("25874136", "B-25874136-001", "Lisbeth Rondón", "Cónyuge"),
    ("25874136", "B-25874136-002", "Daniela Rondón", "Hija"),
    ("16987452", "B-16987452-001", "José Gregorio Ávila", "Padre"),
]

PACIENTES_PRUEBA = [
    {
        "tipo_cedula": "V",
        "cedula": "11222333",
        "nombre_completo": "Pedro Prueba",
        "apellido": "González",
        "tipo_sangre": "O+",
        "telefono": "0412-1112233",
        "antecedentes_medicos": ["Hipertensión arterial"],
        "alergias": ["Penicilina"],
        "numero_historia": "HC-PRUEBA-0001",
    },
    {
        "tipo_cedula": "V",
        "cedula": "44555666",
        "nombre_completo": "Ana Prueba",
        "apellido": "Sánchez",
        "tipo_sangre": "A+",
        "telefono": "0416-4445566",
        "antecedentes_medicos": ["Asma"],
        "alergias": [],
        "numero_historia": "HC-PRUEBA-0002",
    },
]


async def _existe(db, tabla, cedula):
    r = await db.execute(text(f"SELECT 1 FROM {tabla} WHERE cedula = :c"), {"c": cedula})
    return r.first() is not None


async def seed():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as db:
        # ---- Trabajadores (empleados) ----
        for t in TRABAJADORES:
            if await _existe(db, "empleados", t["cedula"]):
                print(f"[skip] empleado {t['cedula']} ya existe")
                continue
            await db.execute(
                text(
                    "INSERT INTO empleados (id, cedula, nombre_completo, edad, cargo, activo) "
                    "VALUES (gen_random_uuid(), :cedula, :nombre, :edad, :cargo, TRUE)"
                ),
                {"cedula": t["cedula"], "nombre": t["nombre_completo"], "edad": t["edad"], "cargo": t["cargo"]},
            )
            print(f"[ok] empleado {t['cedula']} {t['nombre_completo']}")

        # ---- Beneficiarios (familiares de trabajadores) ----
        for cedula_emp, ced_b, nombre, parentesco in BENEFICIARIOS:
            if await _existe(db, "beneficiarios", ced_b):
                continue
            emp = (await db.execute(text("SELECT id FROM empleados WHERE cedula = :c"), {"c": cedula_emp})).first()
            if not emp:
                print(f"[skip] beneficiario: empleado {cedula_emp} no existe")
                continue
            await db.execute(
                text(
                    "INSERT INTO beneficiarios (id, empleado_id, cedula, nombre_completo, parentesco, activo) "
                    "VALUES (gen_random_uuid(), :eid, :ced, :nombre, :parentesco, TRUE)"
                ),
                {"eid": emp.id, "ced": ced_b, "nombre": nombre, "parentesco": parentesco},
            )
            print(f"[ok] beneficiario {ced_b} {nombre}")

        # ---- Pacientes de prueba (historias clínicas) ----
        for p in PACIENTES_PRUEBA:
            if await _existe(db, "historias_clinicas", p["cedula"]):
                print(f"[skip] historia {p['cedula']} ya existe")
                continue
            await db.execute(
                text(
                    "INSERT INTO historias_clinicas "
                    "(id, tipo_cedula, cedula, nombre_completo, apellido, telefono, tipo_sangre, "
                    " antecedentes_medicos, alergias, numero_historia) "
                    "VALUES (gen_random_uuid(), :tipo, :cedula, :nombre, :apellido, :tel, :ts, "
                    " :ant, :al, :nh)"
                ),
                {
                    "tipo": p["tipo_cedula"], "cedula": p["cedula"], "nombre": p["nombre_completo"],
                    "apellido": p["apellido"], "tel": p["telefono"], "ts": p["tipo_sangre"],
                    "ant": json.dumps(p["antecedentes_medicos"], ensure_ascii=False),
                    "al": json.dumps(p["alergias"], ensure_ascii=False), "nh": p["numero_historia"],
                },
            )
            print(f"[ok] historia {p['cedula']} {p['nombre_completo']}")
    await engine.dispose()
    print("Seed listo.")


if __name__ == "__main__":
    asyncio.run(seed())
