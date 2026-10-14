"""Regresión QA: /consultas/hoy debe poder listar consultas de una fecha distinta a hoy.

AtendidosHoy se convierte en un panel por fecha (un día a la vez). El endpoint
actual filtra con `created_at::date = CURRENT_DATE` sin aceptar ?fecha=.
"""
import uuid
from datetime import datetime

from conftest import auth, token_para

PERSONAL_MED = 999201


async def _sembrar_consulta(pg, paciente_id: str, fecha: datetime, comprobante: str):
    await pg.execute(
        "INSERT INTO personal (id, cedula, nombre, apellido, cargo) "
        "VALUES ($1, '999999', 'Med', 'QA', 'Médico') "
        "ON CONFLICT (id) DO NOTHING",
        PERSONAL_MED,
    )
    await pg.execute(
        "INSERT INTO consultas (id, paciente_id, medico_id, medico_nombre, especialidad, "
        "motivo_consulta, cie10_codigo, cie10_descripcion, comprobante_ref, "
        "created_at, examen_remitido) "
        "VALUES ($1, $2, $5, 'MedTest', 'Emergencia', 'Dolor', 'R10.4', 'Dolor abd', "
        "$3, $4, FALSE)",
        str(uuid.uuid4()), paciente_id, comprobante, fecha, PERSONAL_MED,
    )


async def test_hoy_acepta_fecha_pasada(client, pg):
    """?fecha=<dia anterior> lista solo las consultas de ese dia."""
    hist = (await pg.fetchrow(
        "SELECT id FROM historias_clinicas WHERE cedula='00000001'"
    ))["id"]
    await _sembrar_consulta(pg, str(hist), datetime(2026,1,5,10,0), "ABH-AYER")
    tok = await token_para(client, "test_med")

    # Sin parametro: hoy (CURRENT_DATE) no incluye ABH-AYER.
    r = await client.get("/api/v1/consultas/hoy", headers=auth(tok))
    assert r.status_code == 200
    assert all(c["comprobante_ref"] != "ABH-AYER" for c in r.json())

    # Con ?fecha=<fecha de la consulta>: si aparece.
    r2 = await client.get("/api/v1/consultas/hoy?fecha=2026-01-05", headers=auth(tok))
    assert r2.status_code == 200, r2.text
    assert any(c["comprobante_ref"] == "ABH-AYER" for c in r2.json())


async def test_hoy_filtra_entre_dias(client, pg):
    """?fecha no mezcla consultas de dias distintos."""
    hist = (await pg.fetchrow(
        "SELECT id FROM historias_clinicas WHERE cedula='00000001'"
    ))["id"]
    await _sembrar_consulta(pg, str(hist), datetime(2026,1,6,9,30), "ABH-06")
    await _sembrar_consulta(pg, str(hist), datetime(2026,1,7,11,0), "ABH-07")
    tok = await token_para(client, "test_med")

    r6 = await client.get("/api/v1/consultas/hoy?fecha=2026-01-06", headers=auth(tok))
    refs6 = {c["comprobante_ref"] for c in r6.json()}
    assert "ABH-06" in refs6 and "ABH-07" not in refs6

    r7 = await client.get("/api/v1/consultas/hoy?fecha=2026-01-07", headers=auth(tok))
    refs7 = {c["comprobante_ref"] for c in r7.json()}
    assert "ABH-07" in refs7 and "ABH-06" not in refs7
