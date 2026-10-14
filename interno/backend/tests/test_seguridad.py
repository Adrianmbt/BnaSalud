"""Fase 1 (seguridad): JWT obligatorio y roles de /admin."""
from tests.conftest import auth, login, token_para


async def test_login_ok(client):
    r = await login(client, "test_farm")
    assert r.status_code == 200
    body = r.json()
    assert body["rol"] == "farmacia"
    assert body["clinica_id"] == 13


async def test_login_invalido_401(client):
    r = await client.post(
        "/api/v1/auth/login", json={"username": "test_farm", "password": "incorrecta"}
    )
    assert r.status_code == 401


async def test_sin_token_401(client):
    r = await client.get("/api/v1/farmacia/inventario")
    assert r.status_code == 401


async def test_admin_rechaza_rol_medico(client):
    tok = await token_para(client, "test_med")
    r = await client.get("/api/v1/admin/usuarios", headers=auth(tok))
    assert r.status_code == 403


async def test_admin_acepta_admin_sistemas(client):
    tok = await token_para(client, "test_admin")
    r = await client.get("/api/v1/admin/usuarios", headers=auth(tok))
    assert r.status_code == 200