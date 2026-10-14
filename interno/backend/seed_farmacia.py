# backend/seed_farmacia.py
"""Seed pharmacy test data: user, medications, supplies, batches, movements"""
import asyncio
import sys
from pathlib import Path
from datetime import date, timedelta

import bcrypt
from sqlalchemy import text
from app.core.database import engine

CHECK_PERSONAL = "SELECT id FROM personal WHERE cedula = :cedula"

INSERT_PERSONAL = """
INSERT INTO personal (cedula, nombre, apellido, cargo, clinica_id)
VALUES (:cedula, :nombre, :apellido, :cargo, :clinica_id)
RETURNING id;
"""

SEED_USER = """
INSERT INTO usuarios (username, password_hash, rol, personal_id, activo)
VALUES (:username, :pwd_hash, :rol, :personal_id, true)
ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    rol = EXCLUDED.rol,
    personal_id = EXCLUDED.personal_id,
    activo = EXCLUDED.activo
RETURNING id;
"""

SEED_MEDICATIONS = """
INSERT INTO medicamentos_catalogo (nombre, presentacion, concentracion, categoria, stock_actual, stock_minimo, activo)
VALUES
    (:n1, :p1, :c1, :cat1, :s1, :sm1, true),
    (:n2, :p2, :c2, :cat2, :s2, :sm2, true),
    (:n3, :p3, :c3, :cat3, :s3, :sm3, true),
    (:n4, :p4, :c4, :cat4, :s4, :sm4, true),
    (:n5, :p5, :c5, :cat5, :s5, :sm5, true),
    (:n6, :p6, :c6, :cat6, :s6, :sm6, true),
    (:n7, :p7, :c7, :cat7, :s7, :sm7, true),
    (:n8, :p8, :c8, :cat8, :s8, :sm8, true),
    (:n9, :p9, :c9, :cat9, :s9, :sm9, true),
    (:n10, :p10, :c10, :cat10, :s10, :sm10, true),
    (:n11, :p11, :c11, :cat11, :s11, :sm11, true),
    (:n12, :p12, :c12, :cat12, :s12, :sm12, true),
    (:n13, :p13, :c13, :cat13, :s13, :sm13, true),
    (:n14, :p14, :c14, :cat14, :s14, :sm14, true),
    (:n15, :p15, :c15, :cat15, :s15, :sm15, true)
ON CONFLICT (nombre, COALESCE(presentacion, ''), COALESCE(concentracion, ''))
DO UPDATE SET
    stock_actual = EXCLUDED.stock_actual,
    stock_minimo = EXCLUDED.stock_minimo,
    categoria = EXCLUDED.categoria,
    activo = EXCLUDED.activo;
"""

CHECK_SUPPLY = "SELECT id FROM insumos_catalogo WHERE nombre = :nombre"

INSERT_SUPPLY = """
INSERT INTO insumos_catalogo (nombre, descripcion, categoria, unidad, stock_actual, stock_minimo, activo)
VALUES (:nombre, :descripcion, :categoria, :unidad, :stock_actual, :stock_minimo, true)
RETURNING id;
"""


def _hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


async def main():
    async with engine.begin() as conn:
        # 1. Create personal record (check first to avoid duplicates)
        check_result = await conn.execute(
            text(CHECK_PERSONAL), {"cedula": "20000001"}
        )
        existing_personal = check_result.fetchone()
        
        if existing_personal:
            personal_id = existing_personal[0]
            print(f"[ok] personal ya existe (id={personal_id})")
        else:
            personal_result = await conn.execute(
                text(INSERT_PERSONAL),
                {
                    "cedula": "20000001",
                    "nombre": "Maria",
                    "apellido": "Gonzalez",
                    "cargo": "Jefe de Farmacia",
                    "clinica_id": 1,
                },
            )
            personal_row = personal_result.fetchone()
            personal_id = personal_row[0] if personal_row else None
            print(f"[ok] personal creado (id={personal_id})")

        # 2. Create user with bcrypt password hash
        pwd_hash = _hash_password("farmacia123")
        user_result = await conn.execute(
            text(SEED_USER),
            {
                "username": "farmacia",
                "pwd_hash": pwd_hash,
                "rol": "jefe_farmacia",
                "personal_id": personal_id,
            },
        )
        print(f"[ok] usuario farmacia creado (personal_id={personal_id})")

        # 3. Seed medications
        meds = [
            ("Paracetamol", "Tabletas", "500mg", "ANALGESICO", 150, 30),
            ("Ibuprofeno", "Tabletas", "400mg", "ANTIINFLAMATORIO", 80, 25),
            ("Amoxicilina", "Cápsulas", "500mg", "ANTIBIOTICO", 120, 20),
            ("Omeprazol", "Cápsulas", "20mg", "GASTRO", 200, 40),
            ("Losartán", "Tabletas", "50mg", "CARDIOVASCULAR", 45, 15),
            ("Metformina", "Tabletas", "850mg", "ANTIDIABETICO", 90, 20),
            ("Salbutamol", "Inhalador", "100mcg", "RESPIRATORIO", 35, 10),
            ("Diclofenaco", "Inyectable", "75mg/ml", "ANTIINFLAMATORIO", 60, 15),
            ("Ciprofloxacino", "Tabletas", "500mg", "ANTIBIOTICO", 10, 20),
            ("Metamizol", "Gotas", "500mg/ml", "ANALGESICO", 25, 10),
            ("Ranitidina", "Tabletas", "150mg", "GASTRO", 0, 15),
            ("Dexametasona", "Inyectable", "4mg/ml", "CORTICOIDE", 40, 10),
            ("Ketorolaco", "Inyectable", "30mg/ml", "ANALGESICO", 55, 15),
            ("Azitromicina", "Tabletas", "500mg", "ANTIBIOTICO", 70, 20),
            ("Pantoprazol", "Tabletas", "40mg", "GASTRO", 110, 25),
        ]
        med_params = {}
        for i, (nombre, presentacion, concentracion, categoria, stock, minimo) in enumerate(meds, 1):
            med_params[f"n{i}"] = nombre
            med_params[f"p{i}"] = presentacion
            med_params[f"c{i}"] = concentracion
            med_params[f"cat{i}"] = categoria
            med_params[f"s{i}"] = stock
            med_params[f"sm{i}"] = minimo
        await conn.execute(text(SEED_MEDICATIONS), med_params)
        print(f"[ok] {len(meds)} medicamentos insertados/actualizados")

        # 4. Seed supplies
        supplies = [
            ("Guantes desechables", "Guantes de látex talla M", "PROTECCION", "caja", 200, 50),
            ("Jeringas 5ml", "Jeringas desechables 5ml", "INYECCION", "pieza", 500, 100),
            ("Algodón", "Algodón hidrófilo 500g", "HIGIENE", "rollo", 30, 10),
            ("Gasas estériles", "Gasas 10x10cm paquete de 10", "CURACION", "paquete", 80, 20),
            ("Sueres fisiológicos", "NaCl 0.9% 500ml", "INFUSION", "unidad", 150, 30),
            ("Catéteres IV", "Catéter 20G", "ACCESO_VENOSO", "pieza", 40, 15),
            ("Cintas adhesivas", "Micropore 2.5cm", "CURACION", "rollo", 25, 10),
            ("Mascarillas quirúrgicas", "Mascarilla quirúrgica 3 capas", "PROTECCION", "unidad", 300, 50),
            ("Bata desechable", "Bata quirúrgica talla L", "PROTECCION", "unidad", 100, 20),
            ("Tubos de ensayo", "Tubos vacutainer 5ml", "LABORATORIO", "pieza", 0, 50),
        ]
        inserted_supplies = 0
        skipped_supplies = 0
        for nombre, desc, cat, unidad, stock, minimo in supplies:
            check_result = await conn.execute(text(CHECK_SUPPLY), {"nombre": nombre})
            if check_result.fetchone():
                skipped_supplies += 1
                continue
            await conn.execute(
                text(INSERT_SUPPLY),
                {
                    "nombre": nombre,
                    "descripcion": desc,
                    "categoria": cat,
                    "unidad": unidad,
                    "stock_actual": stock,
                    "stock_minimo": minimo,
                },
            )
            inserted_supplies += 1
        print(f"[ok] insumos: {inserted_supplies} insertados, {skipped_supplies} ya existían")

        # 5. Seed batches (20 batches with varied expiration dates)
        today = date.today()
        for i in range(1, 21):
            med_id = (i % 15) + 1
            days_offset = -30 + (i * 10)  # Some expired (-30..-1), some expiring soon (0..90), some OK
            exp_date = today + timedelta(days=days_offset)
            qty = max(0, 50 - (i * 3))
            codigo_lote = f"LOTE-{i:04d}"

            await conn.execute(
                text(
                    "INSERT INTO lotes (codigo_lote, medicamento_id, insumo_id, cantidad, cantidad_inicial, fecha_entrada, fecha_vencimiento) "
                    "VALUES (:codigo, :med_id, NULL, :qty, :qty_init, :fecha_entrada, :fecha_venc) "
                    "ON CONFLICT DO NOTHING"
                ),
                {
                    "codigo": codigo_lote,
                    "med_id": med_id,
                    "qty": qty,
                    "qty_init": qty,
                    "fecha_entrada": today - timedelta(days=60),
                    "fecha_venc": exp_date,
                },
            )
        print("[ok] 20 lotes insertados")

        # 6. Seed movements (30 movements)
        for i in range(1, 31):
            lote_id = (i % 20) + 1
            tipo = "ENTRADA" if i % 3 == 0 else "SALIDA"
            cantidad = (i * 5) % 20 + 1
            await conn.execute(
                text(
                    "INSERT INTO movimientos_inventario (lote_id, tipo, cantidad, observacion, creado_por) "
                    "VALUES (:lote_id, :tipo, :cant, :obs, :creado_por)"
                ),
                {
                    "lote_id": lote_id,
                    "tipo": tipo,
                    "cant": cantidad,
                    "obs": f"Movimiento seed #{i}",
                    "creado_por": "farmacia",
                },
            )
        print("[ok] 30 movimientos insertados")

    print("\nFarmacia seed data created successfully.")


if __name__ == "__main__":
    asyncio.run(main())
