"""Fase 2 (multi-centro): la consulta escribe clinica_id y el descuento es doble libro.

- Insumo 1 tiene fila en stock_por_centro(13): descontar resta centro Y global.
- Insumo 3 no tiene fila por centro: solo resta del global.
"""
import uuid

from tests.conftest import auth, token_para


async def _vaciar_consultas(pg):
    await pg.execute("DELETE FROM consultas")


async def test_consulta_escribe_clinica_id_y_doble_libro(client, pg):
    tok = await token_para(client, "test_med")
    pac_id = await pg.fetchval(
        "SELECT id::text FROM historias_clinicas WHERE cedula='00000001'"
    )
    ins1_centro = await pg.fetchval(
        "SELECT stock_actual FROM stock_por_centro WHERE insumo_id=1 AND clinica_id=13"
    )
    ins1_global = await pg.fetchval("SELECT stock_actual FROM insumos_catalogo WHERE id=1")
    ins3_global = await pg.fetchval("SELECT stock_actual FROM insumos_catalogo WHERE id=3")

    r = await client.post(
        "/api/v1/consultas",
        json={
            "paciente_id": pac_id,
            "medico_nombre": "Dr. Test",
            "especialidad": "Medicina General",
            "motivo_consulta": "Control",
            "insumos": [
                {"insumo_id": 1, "cantidad": 3, "tabla_origen": "insumos_catalogo"},
                {"insumo_id": 3, "cantidad": 1, "tabla_origen": "insumos_catalogo"},
            ],
        },
        headers=auth(tok),
    )
    assert r.status_code == 201
    cid = r.json()["id"]

    row = await pg.fetchrow("SELECT clinica_id FROM consultas WHERE id = $1", uuid.UUID(cid))
    assert row["clinica_id"] == 13

    assert await pg.fetchval(
        "SELECT stock_actual FROM stock_por_centro WHERE insumo_id=1 AND clinica_id=13"
    ) == ins1_centro - 3
    assert await pg.fetchval(
        "SELECT stock_actual FROM insumos_catalogo WHERE id=1"
    ) == ins1_global - 3
    assert await pg.fetchval(
        "SELECT stock_actual FROM insumos_catalogo WHERE id=3"
    ) == ins3_global - 1

    await _vaciar_consultas(pg)


async def test_consulta_sin_centro_descuenta_solo_global(client, pg):
    tok = await token_para(client, "test_admin")  # clinica_id NULL
    pac_id = await pg.fetchval(
        "SELECT id::text FROM historias_clinicas WHERE cedula='00000001'"
    )
    ins3_global = await pg.fetchval("SELECT stock_actual FROM insumos_catalogo WHERE id=3")

    r = await client.post(
        "/api/v1/consultas",
        json={
            "paciente_id": pac_id,
            "medico_nombre": "Dr. Test",
            "especialidad": "Medicina General",
            "insumos": [
                {"insumo_id": 3, "cantidad": 2, "tabla_origen": "insumos_catalogo"},
            ],
        },
        headers=auth(tok),
    )
    assert r.status_code == 201
    assert await pg.fetchval(
        "SELECT stock_actual FROM insumos_catalogo WHERE id=3"
    ) == ins3_global - 2

    row = await pg.fetchrow(
        "SELECT clinica_id FROM consultas WHERE paciente_id::text = $1 ORDER BY created_at DESC LIMIT 1",
        pac_id,
    )
    assert row["clinica_id"] is None

    await _vaciar_consultas(pg)


async def test_consulta_stock_insuficiente_409(client, pg):
    tok = await token_para(client, "test_med")
    pac_id = await pg.fetchval(
        "SELECT id::text FROM historias_clinicas WHERE cedula='00000001'"
    )
    r = await client.post(
        "/api/v1/consultas",
        json={
            "paciente_id": pac_id,
            "medico_nombre": "Dr. Test",
            "insumos": [
                {"insumo_id": 2, "cantidad": 99999, "tabla_origen": "insumos_catalogo"},
            ],
        },
        headers=auth(tok),
    )
    assert r.status_code == 409