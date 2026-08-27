#!/usr/bin/env python3
"""Restauracion de emergencia del esquema public (BnaSalud).

Reconstruye el esquema tras un borrado accidental de las tablas de la app:
  1. restore_schema.sql          (12 tablas base previas a las migraciones)
  2. migrations/0001..0020.sql   (en orden de nombre)
  3. seed.sql                     (datos demo/presentacion)
  4. cargar_medicos_citab.sql     (medicos/horarios CITAB)
  5. setval de secuencias + grants anon/authenticated

Uso:  python scripts/restore_db.py   (lee SUPABASE_DB_URI de ../.env)
"""
import os
import re
import sys
from pathlib import Path

import psycopg2


ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = ROOT / "supabase" / "migrations"
BASE = ROOT / "supabase" / "restore_schema.sql"
SEED = ROOT / "supabase" / "seed.sql"
CITAB = ROOT / "supabase" / "cargar_medicos_citab.sql"
ENV = ROOT / ".env"

SETVALS = """
DO $$
DECLARE
  r RECORD;
  seq TEXT;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'id'
      AND data_type IN ('integer', 'bigint')
    ORDER BY table_name
  LOOP
    seq := pg_get_serial_sequence(format('public.%I', r.table_name), 'id');
    IF seq IS NOT NULL THEN
      EXECUTE format(
        'SELECT setval(%L, GREATEST((SELECT COALESCE(MAX(id),1) FROM public.%I), 1))',
        seq, r.table_name);
    END IF;
  END LOOP;
END $$;
""" + ""

GRANTS = """
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
"""

VERIFY = """
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
"""


def load_env():
    uri = os.environ.get("SUPABASE_DB_URI")
    if uri:
        return uri
    if ENV.exists():
        m = re.search(r'^SUPABASE_DB_URI\s*=\s*"?([^"\r\n]+)"?', ENV.read_text(encoding="utf-8"), re.M)
        if m:
            return m.group(1)
    sys.exit("Error: no se encontro SUPABASE_DB_URI (env o .env)")


def run_file(cur, path, label):
    print(f"[+] {label}  ({path.name}) ... ", end="", flush=True)
    cur.execute(path.read_text(encoding="utf-8"))
    print("OK")


def run_migration(cur, path):
    if path.name == "0006_historias_jsonb.sql":
        cur.execute(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='historias_clinicas' "
            "AND column_name='antecedentes_medicos'"
        )
        row = cur.fetchone()
        if row and row[0] == "jsonb":
            print(f"[-] SKIP  ({path.name}) ya aplicada (columnas jsonb)")
            return
    run_file(cur, path, "MIGRACION")


def main():
    uri = load_env()
    order = sorted(p.name for p in MIGRATIONS.glob("*.sql"))
    print(f"Migraciones detectadas: {len(order)}")
    for n in order:
        print("   ", n)

    conn = psycopg2.connect(uri)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            run_file(cur, BASE, "BASE")
            conn.commit()
            for name in order:
                try:
                    run_migration(cur, MIGRATIONS / name)
                    conn.commit()
                except Exception:
                    conn.rollback()
                    print(f"FALLO en {name}")
                    raise
            run_file(cur, SEED, "SEED")
            conn.commit()
            cur.execute(SETVALS)
            conn.commit()
            run_file(cur, CITAB, "CITAB")
            conn.commit()
            cur.execute(SETVALS)
            conn.commit()
            cur.execute(GRANTS)
            conn.commit()

            cur.execute(VERIFY)
            tables = [r[0] for r in cur.fetchall()]
            print("\n[+] Tablas finales en public:", len(tables))
            for t in tables:
                cur.execute(
                    'SELECT count(*) FROM public."%s"' % t.replace('"', '""')
                )
                print(f"      {t}: {cur.fetchone()[0]}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()