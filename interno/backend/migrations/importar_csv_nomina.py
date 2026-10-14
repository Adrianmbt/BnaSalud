"""
Script de importacion: CSV de nomina -> tablas empleados y beneficiarios.
Ejecutar desde backend/: python migrations/importar_csv_nomina.py

Estructura CSV (separado por ';'):
  Col 0:  NACIONALIDAD TITULAR
  Col 1:  CEDULA TITULAR
  Col 2:  PRIMER APELLIDO (titular)
  Col 3:  SEGUNDO APELLIDO (titular)
  Col 4:  PRIMER NOMBRE (titular)
  Col 5:  SEGUNDO NOMBRE (titular)
  Col 6:  NACIONALIDAD (beneficiario)
  Col 7:  CEDULA DEL ASEGURADO (beneficiario)
  Col 8:  CORRELATIVO PARA HIJO
  Col 9:  PRIMER APELLIDO (beneficiario)
  Col 10: SEGUNDO APELLIDO (beneficiario)
  Col 11: PRIMER NOMBRE (beneficiario)
  Col 12: SEGUNDO NOMBRE (beneficiario)
  Col 13: PARENTESCO
  Col 14: FECHA DE NACIMIENTO
  Col 15: DIA
  Col 16: MES
  Col 17: ANO
  Col 18: ANO EN CURSO
  Col 19: EDAD
  Col 20: GENERO
  Col 21: TIPO DE NOMINA (cargo)
"""
import asyncio
import csv
import sys
from datetime import datetime
from pathlib import Path

import asyncpg

def _datos_conexion() -> str:
    """Lee DATABASE_URL del .env del backend (nunca credenciales hardcodeadas)."""
    env = Path(__file__).resolve().parent.parent / ".env"
    for linea in env.read_text(encoding="utf-8").splitlines():
        if linea.startswith("DATABASE_URL="):
            # El .env usa el esquema SQLAlchemy (postgresql+asyncpg://); asyncpg espera postgresql://.
            return linea.split("=", 1)[1].strip().replace("+asyncpg", "")
    raise SystemExit("No se encontró DATABASE_URL en backend/.env")


DATABASE_URL = _datos_conexion()
CSV_PATH = Path(__file__).resolve().parent.parent.parent / "docs" / "DATA SEDE ALCALDIA DE BOLIVAR  (7 DE AGOSTO).csv"


def parse_fecha(fecha_str: str):
    if not fecha_str or not fecha_str.strip():
        return None
    fecha_str = fecha_str.strip()
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y"):
        try:
            return datetime.strptime(fecha_str, fmt).date()
        except ValueError:
            continue
    return None


def limpiar(texto: str) -> str:
    if not texto:
        return ""
    return " ".join(texto.split())


def construir_nombre(p_ap, s_ap, p_nom, s_nom) -> str:
    partes = []
    for c in [p_nom, s_nom, p_ap, s_ap]:
        v = limpiar(c) if c else ""
        if v:
            partes.append(v)
    return " ".join(partes)


async def respaldar_datos(conn):
    backup_dir = Path(__file__).resolve().parent / "backups"
    backup_dir.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    for tabla in ["empleados", "beneficiarios"]:
        rows = await conn.fetch(f"SELECT * FROM {tabla}")
        if rows:
            path = backup_dir / f"backup_{tabla}_{ts}.sql"
            with open(path, "w", encoding="utf-8") as f:
                f.write(f"-- Backup {tabla} - {ts}\n-- Total: {len(rows)} registros\n\n")
                for row in rows:
                    keys = list(row.keys())
                    vals = []
                    for k in keys:
                        v = row[k]
                        if v is None:
                            vals.append("NULL")
                        elif isinstance(v, bool):
                            vals.append("true" if v else "false")
                        elif isinstance(v, str):
                            escaped = v.replace("'", "''")
                            vals.append(f"'{escaped}'")
                        else:
                            vals.append(f"'{v}'")
                    cols = ", ".join(keys)
                    f.write(f"INSERT INTO {tabla} ({cols}) VALUES ({', '.join(vals)});\n")
            print(f"  Backup {tabla}: {path.name} ({len(rows)} registros)")
        else:
            print(f"  No hay {tabla} para respaldar.")


async def importar(conn, csv_path: Path):
    empleados_map = {}
    stats = {"empleados": 0, "beneficiarios": 0, "saltados": 0, "duplicados": 0}

    with open(csv_path, "r", encoding="utf-8") as f:
        # Detectar delimitador
        header_line = f.readline()
        f.seek(0)
        delimiter = ";" if ";" in header_line else ","

        reader = csv.reader(f, delimiter=delimiter)
        header = next(reader)  # Saltar header

        for i, row in enumerate(reader, start=2):
            if len(row) < 22:
                stats["saltados"] += 1
                continue

            cedula_tit = limpiar(row[1])
            if not cedula_tit:
                stats["saltados"] += 1
                continue

            if "CEDULA" in cedula_tit.upper():
                stats["saltados"] += 1
                continue

            # === TITULAR (EMPLEADO) ===
            nombre_tit = construir_nombre(limpiar(row[2]), limpiar(row[3]),
                                          limpiar(row[4]), limpiar(row[5]))
            tipo_nomina = limpiar(row[21])
            fecha_nac = parse_fecha(limpiar(row[14]))
            genero = limpiar(row[20])
            edad_str = limpiar(row[19])
            edad = int(edad_str) if edad_str and edad_str.isdigit() else None

            if cedula_tit not in empleados_map:
                eid = await conn.fetchval(
                    """INSERT INTO empleados (cedula, nombre_completo, edad, cargo, fecha_nacimiento, genero, activo)
                       VALUES ($1,$2,$3,$4,$5,$6,true)
                       ON CONFLICT (cedula) DO UPDATE SET
                         nombre_completo=EXCLUDED.nombre_completo, edad=EXCLUDED.edad,
                         cargo=EXCLUDED.cargo, fecha_nacimiento=EXCLUDED.fecha_nacimiento,
                         genero=EXCLUDED.genero
                       RETURNING id""",
                    cedula_tit, nombre_tit, edad, tipo_nomina or None, fecha_nac, genero or None
                )
                empleados_map[cedula_tit] = eid
                stats["empleados"] += 1
            else:
                eid = empleados_map[cedula_tit]

            # === BENEFICIARIO ===
            cedula_ben = limpiar(row[7])
            parentesco = limpiar(row[13]).lower().strip()

            # Saltar si es el mismo que el titular
            if not cedula_ben or cedula_ben == cedula_tit:
                continue
            if parentesco.startswith("titular"):
                continue

            # Mapear parentesco
            pmap = {
                "hijo (a)": "HIJO(A)", "hijo": "HIJO(A)",
                "madre": "MADRE", "padre": "PADRE",
                "esposo (a)": "ESPOSO(A)", "esposo": "ESPOSO(A)",
            }
            parentesco_db = pmap.get(parentesco, parentesco.upper())

            nombre_ben = construir_nombre(limpiar(row[9]), limpiar(row[10]),
                                          limpiar(row[11]), limpiar(row[12]))

            if not nombre_ben:
                stats["saltados"] += 1
                continue

            try:
                await conn.execute(
                    """INSERT INTO beneficiarios (empleado_id, cedula, nombre_completo, parentesco, fecha_nacimiento, genero, activo)
                       VALUES ($1,$2,$3,$4,$5,$6,true)""",
                    eid, cedula_ben, nombre_ben, parentesco_db, fecha_nac, genero or None
                )
                stats["beneficiarios"] += 1
            except asyncpg.UniqueViolationError:
                stats["duplicados"] += 1

    return stats


async def main():
    print("=" * 60)
    print("  IMPORTADOR DE NOMINA - BNA Salud")
    print("=" * 60)

    if not CSV_PATH.exists():
        print(f"\nERROR: CSV no encontrado: {CSV_PATH}")
        sys.exit(1)

    print(f"\nCSV: {CSV_PATH.name}")

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        print("\n[1/3] Respaldando datos existentes...")
        await respaldar_datos(conn)

        print("\n[2/3] Eliminando datos de prueba...")
        await conn.execute("DELETE FROM beneficiarios")
        await conn.execute("DELETE FROM empleados")
        print("  OK - datos eliminados.")

        print("\n[3/3] Importando CSV...")
        stats = await importar(conn, CSV_PATH)

        count_e = await conn.fetchval("SELECT COUNT(*) FROM empleados")
        count_b = await conn.fetchval("SELECT COUNT(*) FROM beneficiarios")

        print("\n" + "=" * 60)
        print("  RESUMEN")
        print("=" * 60)
        print(f"  Empleados insertados:   {stats['empleados']}")
        print(f"  Beneficiarios insertados: {stats['beneficiarios']}")
        print(f"  Filas saltadas:         {stats['saltados']}")
        print(f"  Duplicados omitidos:    {stats['duplicados']}")
        print(f"  Total empleados DB:     {count_e}")
        print(f"  Total beneficiarios DB: {count_b}")
        print("=" * 60)
        print("\nImportacion completada.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
