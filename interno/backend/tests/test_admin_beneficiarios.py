"""Nómina: cargas familiares (beneficiarios), cascada de activación y promover."""
from tests.conftest import auth, token_para


async def _emp(pg, cedula: str) -> str:
    return str(await pg.fetchval("SELECT id FROM empleados WHERE cedula = $1", cedula))


async def _ben(pg, cedula: str) -> str:
    return str(await pg.fetchval("SELECT id FROM beneficiarios WHERE cedula = $1", cedula))


async def test_listar_empleados_incluye_num_beneficiarios(client, pg):
    tok = await token_para(client, "test_admin")
    r = await client.get("/api/v1/admin/empleados", params={"q": "Juan", "per_page": 10}, headers=auth(tok))
    assert r.status_code == 200
    items = r.json()["items"]
    assert any(i["nombre_completo"] == "Juan Perez" and i["num_beneficiarios"] == 2 for i in items)


async def test_crear_beneficiario_y_cedula_duplicada(client, pg):
    tok = await token_para(client, "test_admin")
    emp1 = await _emp(pg, "20345678")
    r = await client.post(
        f"/api/v1/admin/empleados/{emp1}/beneficiarios",
        json={"cedula": "10345672", "nombre_completo": "Ana Perez", "parentesco": "ESPOSA"},
        headers=auth(tok),
    )
    assert r.status_code == 201
    assert r.json()["activo"] is True

    r2 = await client.post(
        f"/api/v1/admin/empleados/{emp1}/beneficiarios",
        json={"cedula": "10345672", "nombre_completo": "Ana Dup", "parentesco": "HIJA"},
        headers=auth(tok),
    )
    assert r2.status_code == 409


async def test_transferir_beneficiario_a_otro_trabajador(client, pg):
    tok = await token_para(client, "test_admin")
    emp1 = await _emp(pg, "20345678")
    emp2 = await _emp(pg, "20345679")
    b = await _ben(pg, "10345670")

    r = await client.put(
        f"/api/v1/admin/beneficiarios/{b}",
        json={"empleado_id": emp2, "parentesco": "CONYUGE"},
        headers=auth(tok),
    )
    assert r.status_code == 200

    en2 = await client.get(f"/api/v1/admin/empleados/{emp2}/beneficiarios", headers=auth(tok))
    assert any(x["id"] == b for x in en2.json())
    en1 = await client.get(f"/api/v1/admin/empleados/{emp1}/beneficiarios", headers=auth(tok))
    assert all(x["id"] != b for x in en1.json())


async def test_promover_beneficiario_a_empleado(client, pg):
    tok = await token_para(client, "test_admin")
    b = await _ben(pg, "10345671")

    r = await client.post(f"/api/v1/admin/beneficiarios/{b}/promover", headers=auth(tok))
    assert r.status_code == 201

    nuevo_emp = await pg.fetchval("SELECT id FROM empleados WHERE cedula = '10345671'")
    assert nuevo_emp is not None
    activo_ben = await pg.fetchval("SELECT activo FROM beneficiarios WHERE id = $1", b)
    assert activo_ben is False

    logs = await pg.fetchval(
        "SELECT COUNT(*) FROM system_logs WHERE fuente = 'nomina' AND mensaje LIKE '%promovido%'"
    )
    assert logs >= 1


async def test_borrar_empleado_desactiva_cascada(client, pg):
    tok = await token_para(client, "test_admin")
    emp1 = await _emp(pg, "20345678")

    r = await client.delete(f"/api/v1/admin/empleados/{emp1}", headers=auth(tok))
    assert r.status_code == 204

    assert await pg.fetchval("SELECT activo FROM empleados WHERE id = $1", emp1) is False
    ben_activos = await pg.fetchval(
        "SELECT COUNT(*) FROM beneficiarios WHERE empleado_id = $1 AND activo = TRUE", emp1
    )
    assert ben_activos == 0


async def test_reactivar_empleado_reactiva_beneficiarios(client, pg):
    tok = await token_para(client, "test_admin")
    emp1 = await _emp(pg, "20345678")

    r = await client.put(f"/api/v1/admin/empleados/{emp1}", json={"activo": True}, headers=auth(tok))
    assert r.status_code == 200

    assert await pg.fetchval("SELECT activo FROM empleados WHERE id = $1", emp1) is True
    ben_inactivos = await pg.fetchval(
        "SELECT COUNT(*) FROM beneficiarios WHERE empleado_id = $1 AND activo = FALSE", emp1
    )
    assert ben_inactivos == 0


async def test_transferir_a_trabajador_inactivo_409(client, pg):
    tok = await token_para(client, "test_admin")
    emp1 = await _emp(pg, "20345678")
    emp2 = await _emp(pg, "20345679")

    r = await client.post(
        f"/api/v1/admin/empleados/{emp1}/beneficiarios",
        json={"cedula": "10345673", "nombre_completo": "Sonia Paz", "parentesco": "MADRE"},
        headers=auth(tok),
    )
    assert r.status_code == 201
    b = await _ben(pg, "10345673")

    await client.put(f"/api/v1/admin/empleados/{emp2}", json={"activo": False}, headers=auth(tok))

    r2 = await client.put(
        f"/api/v1/admin/beneficiarios/{b}", json={"empleado_id": emp2}, headers=auth(tok)
    )
    assert r2.status_code == 409

    sigue_emp1 = await pg.fetchval(
        "SELECT empleado_id::text FROM beneficiarios WHERE id = $1", b
    )
    assert sigue_emp1 == emp1