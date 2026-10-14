"""Fase 2B (inventario por centro): vistas, ingreso, descuento y roles."""
from tests.conftest import auth, token_para


async def test_inventario_per_centro_stock_centro(client, pg):
    tok = await token_para(client, "test_farm")
    r = await client.get(
        "/api/v1/farmacia/inventario", params={"clinica_id": 13}, headers=auth(tok)
    )
    assert r.status_code == 200
    filas = {f["id"]: f for f in r.json() if f["tabla_origen"] == "insumos_catalogo"}
    esperado = await pg.fetchval(
        "SELECT stock_actual FROM stock_por_centro WHERE insumo_id=1 AND clinica_id=13"
    )
    assert filas[1]["stock_centro"] == esperado   # el API refleja stock_por_centro
    assert filas[3]["stock_centro"] == 0          # insumo sin fila por centro
    assert filas[3]["stock_actual"] == await pg.fetchval(
        "SELECT stock_actual FROM insumos_catalogo WHERE id=3"
    )


async def test_inventario_global_sin_stock_centro(client):
    tok = await token_para(client, "test_admin")
    r = await client.get("/api/v1/farmacia/inventario", headers=auth(tok))
    assert r.status_code == 200
    assert all(f.get("stock_centro") is None for f in r.json())


async def test_ingreso_farmacia_fuerza_su_centro(client, pg):
    tok = await token_para(client, "test_farm")
    centro_antes = await pg.fetchval("SELECT stock_actual FROM stock_por_centro WHERE insumo_id=1 AND clinica_id=13")
    global_antes = await pg.fetchval("SELECT stock_actual FROM insumos_catalogo WHERE id=1")

    r = await client.post("/api/v1/farmacia/insumos/1/stock", json={"cantidad": 5}, headers=auth(tok))
    assert r.status_code == 201
    body = r.json()
    assert body["clinica_id"] == 13
    assert body["stock_centro"] == centro_antes + 5
    assert body["stock_global"] == global_antes + 5


async def test_ingreso_admin_elige_centro(client, pg):
    tok = await token_para(client, "test_admin")
    global_antes = await pg.fetchval("SELECT stock_actual FROM insumos_catalogo WHERE id=2")

    r = await client.post(
        "/api/v1/farmacia/insumos/2/stock",
        json={"clinica_id": 15, "cantidad": 7}, headers=auth(tok),
    )
    assert r.status_code == 201
    body = r.json()
    assert body["clinica_id"] == 15
    assert body["stock_centro"] == 14      # 7 sembrados + 7
    assert body["stock_global"] == global_antes + 7


async def test_ingreso_medico_forbidden(client):
    tok = await token_para(client, "test_med")
    r = await client.post("/api/v1/farmacia/insumos/1/stock", json={"cantidad": 1}, headers=auth(tok))
    assert r.status_code == 403


async def test_descuento_doble_libro(client, pg):
    tok = await token_para(client, "test_farm")
    centro_antes = await pg.fetchval("SELECT stock_actual FROM stock_por_centro WHERE insumo_id=2 AND clinica_id=13")
    global_antes = await pg.fetchval("SELECT stock_actual FROM insumos_catalogo WHERE id=2")

    r = await client.post("/api/v1/farmacia/insumos/2/descontar", json={"cantidad": 4}, headers=auth(tok))
    assert r.status_code == 200
    body = r.json()
    assert body["stock_centro"] == centro_antes - 4
    assert body["stock_global"] == global_antes - 4


async def test_descuento_excesivo_409(client):
    tok = await token_para(client, "test_farm")
    r = await client.post("/api/v1/farmacia/insumos/2/descontar", json={"cantidad": 99999}, headers=auth(tok))
    assert r.status_code == 409