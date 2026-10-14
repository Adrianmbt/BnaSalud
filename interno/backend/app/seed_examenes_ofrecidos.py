"""Semilla de oferta de exámenes por centro adscrito (idempotente).

Crea las tablas `examenes_ofrecidos` y `citas_examenes`, agrega columnas de
remisión a `consultas`, registra los 6 centros del Instituto de Salud de Simón
Bolívar en `clinicas` y siembra el catálogo inicial de exámenes.

Uso:
    python -m app.seed_examenes_ofrecidos
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings

DDL = """
CREATE TABLE IF NOT EXISTS examenes_ofrecidos (
    id SERIAL PRIMARY KEY,
    examen TEXT NOT NULL,
    centro_id INTEGER NOT NULL REFERENCES clinicas(id),
    horario_atencion JSONB NOT NULL,
    horario_texto TEXT NOT NULL,
    cupo_diario INTEGER NOT NULL CHECK (cupo_diario > 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_examen_ofrecido_centro ON examenes_ofrecidos (examen, centro_id);

CREATE TABLE IF NOT EXISTS citas_examenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    examen_ofrecido_id INTEGER NOT NULL REFERENCES examenes_ofrecidos(id),
    paciente_id UUID REFERENCES historias_clinicas(id),
    fecha_cita DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    motivo TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    codigo_confirmacion TEXT NOT NULL UNIQUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_citas_examenes_cupo ON citas_examenes (examen_ofrecido_id, fecha_cita, estado);

ALTER TABLE consultas ADD COLUMN IF NOT EXISTS examen_remitido BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS cita_examen_id UUID REFERENCES citas_examenes(id);
"""

CENTROS = [
    ("CITAB", "CITAB - Centro Integral de Alta Tecnología de Barcelona", "Barcelona", "Av. principal del centro de la ciudad"),
    ("CMUJER", "Clínica Integral de la Mujer", "Pueblo Nuevo", "Calle Bolívar"),
    ("CNINOS", "Clínica Integral de los Niños", "Barcelona", "Av. Fuerzas Armadas"),
    ("CAPJPF", "Clínica Municipal CAP José Pérez Fernández", "Caigua", "Vía principal de Caigua"),
    ("CAMAYOR", "Casa del Adulto Mayor", "El Roble", "Calle El Roble"),
    ("OMARUJA", "Oncológico Maruja Clavier", "Pueblo Nuevo", "Av. Intercomunal"),
]

HORARIO_LV = {
    "lunes": ["07:00-12:00"],
    "martes": ["07:00-12:00"],
    "miercoles": ["07:00-12:00"],
    "jueves": ["07:00-12:00"],
    "viernes": ["07:00-12:00"],
}
HORARIO_JUEVES = {**HORARIO_LV, "jueves": ["13:00-17:00"]}

CATALOGO = [
    ("CITAB", ["Radiografía de tórax", "Ecografía abdominal", "Electrocardiograma", "Hematología completa", "Uroanálisis"]),
    ("CMUJER", ["Papanicolaou", "Colposcopía", "Ecografía pélvica/obstétrica", "Mamografía", "Urocultivo"]),
    ("CNINOS", ["Hematología infantil", "Ecografía de partes blandas", "Radiografía de miembros", "Uroanálisis"]),
    ("CAPJPF", ["Glicemia en ayunas", "Perfil lipídico", "Creatinina", "Orina completa", "Radiografía simple"]),
    ("CAMAYOR", ["Glicemia", "Creatinina", "TSH", "Electrocardiograma", "Radiografía de tórax"]),
    ("OMARUJA", ["Marcadores tumorales (CEA, CA-125, PSA)", "Citología", "TAC", "Mamografía diagnóstica"]),
]


async def seed():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as db:
        for bloque in DDL.split(";"):
            if bloque.strip():
                await db.execute(text(bloque + ";"))
        print("[ok] esquema de remisión de exámenes asegurado")

        centros = {}
        for codigo, nombre, parroquia, direccion in CENTROS:
            existe = (
                await db.execute(text("SELECT id FROM clinicas WHERE codigo = :cod"), {"cod": codigo})
            ).first()
            if existe:
                idc = existe.id
                print(f"[skip] centro {codigo} ya existe")
            else:
                fila = (
                    await db.execute(
                        text(
                            "INSERT INTO clinicas (nombre, codigo, parroquia, direccion, activo) "
                            "VALUES (:n, :cod, :p, :d, TRUE) RETURNING id"
                        ),
                        {"n": nombre, "cod": codigo, "p": parroquia, "d": direccion},
                    )
                ).first()
                idc = fila.id
                print(f"[ok] centro {codigo} {nombre}")
            centros[codigo] = idc

        insertados = 0
        for cod, examenes in CATALOGO:
            horario = HORARIO_LV if cod != "OMARUJA" else HORARIO_JUEVES
            texto = "Lun–Vie 7:00–12:00" if horario is HORARIO_LV else "Lun–Jue 7:00–12:00, Vie 13:00–17:00"
            cupo = 10 if cod != "OMARUJA" else 5
            for examen in examenes:
                existe = (
                    await db.execute(
                        text(
                            "SELECT 1 FROM examenes_ofrecidos "
                            "WHERE examen = :e AND centro_id = :cid"
                        ),
                        {"e": examen, "cid": centros[cod]},
                    )
                ).first()
                if existe:
                    continue
                await db.execute(
                    text(
                        "INSERT INTO examenes_ofrecidos "
                        "(examen, centro_id, horario_atencion, horario_texto, cupo_diario, activo) "
                        "VALUES (:e, :cid, :hor, :t, :cupo, TRUE)"
                    ),
                    {"e": examen, "cid": centros[cod], "hor": json.dumps(horario, ensure_ascii=False), "t": texto, "cupo": cupo},
                )
                insertados += 1
        print(f"[ok] {insertados} exámenes ofrecidos insertados")

    await engine.dispose()
    print("Seed de oferta de exámenes listo.")


if __name__ == "__main__":
    asyncio.run(seed())