"""Fixtures e infraestructura de la suite de tests (Fase 3).

La suite corre contra la base `bnasalud_test` (nunca contra la de producción):
- El esquema se clona de la base de producción con `pg_dump --schema-only`
  (el esquema no está versionado; vive solo en el Postgres externo).
- Los datos de prueba se siembran/truncan por sesión.

Implicito: `pytest.ini` usa `asyncio_mode = auto`.
"""
import asyncio
import bcrypt
import os
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import asyncpg
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

LIVE_URL_FILE = BACKEND / ".env"


def _live_url() -> str:
    for linea in LIVE_URL_FILE.read_text(encoding="utf-8").splitlines():
        if linea.startswith("DATABASE_URL="):
            return linea.split("=", 1)[1].strip().replace("+asyncpg", "")
    raise SystemExit("No se encontró DATABASE_URL en backend/.env")


def _cambiar_db(url: str, nuevo_db: str) -> str:
    p = urlsplit(url)
    return urlunsplit(p._replace(path=f"/{nuevo_db}"))


LIVE_URL = _live_url()
TEST_URL = _cambiar_db(LIVE_URL, "bnasalud_test")

# Antes de importar la app: apuntar el motor a la base de tests.
os.environ["DATABASE_URL"] = TEST_URL.replace(
    "postgresql://", "postgresql+asyncpg://", 1
)

PASSWORD = "test123"

SEED_CLINICAS = [
    (13, "CITAB - Centro Integral de Alta Tecnologia", "CITAB"),
    (14, "Clinica Integral de la Mujer", "CMUJER"),
    (15, "Clinica Integral de los Ninos", "CNINOS"),
    (16, "Clinica Municipal CAP Jose Perez Fernandez", "CAPJPF"),
    (17, "Casa del Adulto Mayor", "CAMAYOR"),
    (18, "Oncologico Maruja Clavier", "OMARUJA"),
]

SEED_USUARIOS = [
    ("test_farm", "jefe_farmacia", 13),
    ("test_admin", "admin_sistemas", None),
    ("test_med", "medico", 13),
    ("test_recep", "recepcionista", 13),
]


def _hash() -> str:
    return bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()


def _bin_dir() -> str:
    if os.environ.get("PG_BIN"):
        return os.environ["PG_BIN"]
    for base in (r"C:\Program Files\PostgreSQL", r"C:\Program Files (x86)\PostgreSQL", r"C:\PostgreSQL"):
        for ver in ("18", "17", "16", "15", "14"):
            candidato = os.path.join(base, ver, "bin")
            if os.path.isfile(os.path.join(candidato, "psql.exe")):
                return candidato
    return ""


PG_URL_ADMIN = _cambiar_db(LIVE_URL, "postgres")


async def _recrear_db() -> None:
    """Elimina/crea bnasalud_test y clona el esquema desde la base de producción."""
    conn = await asyncpg.connect(PG_URL_ADMIN)
    try:
        await conn.execute("DROP DATABASE IF EXISTS bnasalud_test WITH (FORCE)")
        await conn.execute("CREATE DATABASE bnasalud_test")
    finally:
        await conn.close()

    bin_dir = _bin_dir()
    pg_dump = os.path.join(bin_dir, "pg_dump") if bin_dir else "pg_dump"
    psql = os.path.join(bin_dir, "psql") if bin_dir else "psql"

    dump = subprocess.run(
        [pg_dump, "--schema-only", "--no-owner", "--no-privileges", LIVE_URL],
        capture_output=True, text=True,
    )
    if dump.returncode != 0:
        raise RuntimeError(f"pg_dump falló: {dump.stderr[:1000]}")
    psql_run = subprocess.run(
        [psql, "-q", "-v", "ON_ERROR_STOP=1", TEST_URL],
        input=dump.stdout, capture_output=True, text=True,
    )
    if psql_run.returncode != 0:
        raise RuntimeError(f"psql falló al aplicar el esquema: {psql_run.stderr[-2000:]}")


async def _sembrar() -> None:
    conn = await asyncpg.connect(TEST_URL)
    try:
        await conn.execute(
            "TRUNCATE consultas, cola_atencion, usuarios, clinicas, empleados, beneficiarios, "
            "insumos_catalogo, medicamentos_catalogo, stock_por_centro, "
            "historias_clinicas RESTART IDENTITY CASCADE"
        )
        for cid, nombre, codigo in SEED_CLINICAS:
            await conn.execute(
                "INSERT INTO clinicas (id, nombre, codigo, activo) OVERRIDING SYSTEM VALUE "
                "VALUES ($1, $2, $3, TRUE)",
                cid, nombre, codigo,
            )
        pw = _hash()
        for usu, rol, cid in SEED_USUARIOS:
            await conn.execute(
                "INSERT INTO usuarios (username, password_hash, rol, activo, clinica_id) "
                "VALUES ($1, $2, $3, TRUE, $4)",
                usu, pw, rol, cid,
            )
        # Nómina: dos trabajadores activos, el primero con dos cargas familiares.
        emp1, emp2 = uuid.uuid4(), uuid.uuid4()
        await conn.executemany(
            "INSERT INTO empleados (id, cedula, nombre_completo, edad, cargo, activo) "
            "VALUES ($1, $2, $3, $4, $5, TRUE)",
            [
                (emp1, "20345678", "Juan Perez", 40, "Obrero"),
                (emp2, "20345679", "Carlos Diaz", 33, "Enfermero"),
            ],
        )
        await conn.executemany(
            "INSERT INTO beneficiarios (id, empleado_id, cedula, nombre_completo, parentesco, activo) "
            "VALUES ($1, $2, $3, $4, $5, TRUE)",
            [
                (uuid.uuid4(), emp1, "10345670", "Maria Perez", "Hija"),
                (uuid.uuid4(), emp1, "10345671", "Luis Perez", "Hijo"),
            ],
        )
        await conn.execute(
            "INSERT INTO medicamentos_catalogo (id, nombre, stock_actual, stock_minimo, activo, categoria) "
            "OVERRIDING SYSTEM VALUE VALUES (1, 'Paracetamol', 50, 20, TRUE, 'Analgesico')"
        )
        await conn.executemany(
            "INSERT INTO insumos_catalogo (id, nombre, unidad, stock_actual, stock_minimo, activo) "
            "OVERRIDING SYSTEM VALUE VALUES ($1, $2, 'pieza', $3, $4, TRUE)",
            [(1, "Algodon", 40, 10), (2, "Guantes", 30, 20), (3, "Gasas", 25, 5)],
        )
        # Doble libro: hay fila por centro solo para insumos 1 y 2.
        await conn.executemany(
            "INSERT INTO stock_por_centro (insumo_id, clinica_id, stock_actual, stock_minimo, activo) "
            "VALUES ($1, $2, $3, $4, TRUE)",
            [(1, 13, 15, 10), (2, 13, 12, 20), (2, 15, 7, 20)],
        )
        await conn.execute(
            "INSERT INTO historias_clinicas (id, tipo_cedula, cedula, nombre_completo, numero_historia) "
            "VALUES ($1, 'V', '00000001', 'Paciente Test', 'HC-TEST-0001')",
            str(uuid.uuid4()),
        )
        # Catálogo de exámenes (la BD de test se clona --schema-only, sin datos).
        await conn.execute(
            "INSERT INTO catalogo_examenes (categoria, grupo, nombre_estudio, requiere_ayuno) "
            "VALUES ('laboratorio', 'Hematología', 'Hemograma completo', FALSE)"
        )
    finally:
        await conn.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _mundo():
    await _recrear_db()
    await _sembrar()
    yield


@pytest_asyncio.fixture
async def client():
    from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def pg():
    conn = await asyncpg.connect(TEST_URL)
    yield conn
    await conn.close()


async def login(client, username: str):
    r = await client.post(
        "/api/v1/auth/login", json={"username": username, "password": PASSWORD}
    )
    return r


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def token_para(client, username: str) -> str:
    r = await login(client, username)
    r.raise_for_status()
    return r.json()["access_token"]