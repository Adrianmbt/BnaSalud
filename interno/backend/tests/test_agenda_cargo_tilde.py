"""Regresión QA: la remisión a especialista fallaba (404) para médicos con cargo 'Medico' sin tilde.

El filtro de especialistas comparaba `cargo = 'Médico'` literal, pero `personal.cargo`
guarda variantes con y sin tilde ('Medico' / 'Médico'). Un médico con cargo sin tilde
quedaba excluido del listado y rechazado por `crear_cita` (404).
"""
from conftest import _hash, auth, token_para

PERSONAL_MEDICO_SIN_TILDE = 999101


async def _usar_especialista_sin_tilde(pg, pid: int):
    await pg.execute(
        "INSERT INTO personal (id, cedula, nombre, apellido, cargo, especialidad) "
        "VALUES ($1, $2, 'MedicoQA', 'SinTilde', 'Medico', 'Medicina General') "
        "ON CONFLICT (id) DO NOTHING",
        pid, str(15000000 + pid),
    )
    await pg.execute(
        "INSERT INTO usuarios (username, password_hash, rol, activo, personal_id) "
        "VALUES ($1, $2, 'medico', TRUE, $3) "
        "ON CONFLICT (username) DO NOTHING",
        "med_sintilde", _hash(), pid,
    )


async def test_especialista_aparece_con_cargo_sin_tilde(client, pg):
    """'/especialistas' debe listar a un médico con cargo 'Medico' (sin tilde)."""
    await _usar_especialista_sin_tilde(pg, PERSONAL_MEDICO_SIN_TILDE)
    tok = await token_para(client, "test_med")
    r = await client.get("/api/v1/agenda/especialistas", headers=auth(tok))
    assert r.status_code == 200, r.text
    ids = {e["id"] for e in r.json()}
    assert PERSONAL_MEDICO_SIN_TILDE in ids, f"El médico con cargo 'Medico' no aparece: {sorted(ids)[:6]}..."


async def test_crear_cita_con_especialista_sin_tilde(client, pg):
    """Crear una cita con un médico de cargo 'Medico' debe responder 201 (no 404)."""
    await _usar_especialista_sin_tilde(pg, PERSONAL_MEDICO_SIN_TILDE)
    tok = await token_para(client, "test_med")

    # Paciente de prueba con historia clínica (FK de citas.paciente_id).
    import uuid as _uu
    pid = str(_uu.uuid4())
    await pg.execute(
        "INSERT INTO historias_clinicas (id, tipo_cedula, cedula, nombre_completo, numero_historia) "
        "VALUES ($1, 'V', '00000099', 'QA Cita', 'HC-QA-0001')",
        pid,
    )

    r = await client.post(
        "/api/v1/agenda/citas",
        json={
            "medico_id": PERSONAL_MEDICO_SIN_TILDE,
            "fecha": "2099-01-01",
            "hora_inicio": "09:00",
            "nivel": "azul",
            "paciente_id": pid,
            "motivo": "QA: cita regresion",
            "especialidad": "Medicina General",
            "origen": "remision",
        },
        headers=auth(tok),
    )
    assert r.status_code == 201, r.text
    assert r.json()["medico_id"] == PERSONAL_MEDICO_SIN_TILDE