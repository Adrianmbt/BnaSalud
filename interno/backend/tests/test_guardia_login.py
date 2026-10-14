"""Fase 3 (guardia): solo el médico de emergencia con guardia ACTIVA que cubra HOY inicia sesión.

Cubre el hoy, incluyendo turnos 24h/nocturnos iniciados ayer (fecha = ayer).
- Sin guardia activa: login 403.
- Guardia ACTIVA con fecha = hoy: login 200 con rol 'emergency'.
- Guardia ACTIVA con fecha = ayer (24h nocturna): login 200.
- Guardia ACTIVA antigua (no cubre hoy): login 403.
"""
from tests.conftest import _hash, login


async def _sembrar_emergencia(pg, username: str, pid: int):
    await pg.execute(
        "INSERT INTO turnos (id, nombre, hora_inicio, hora_fin) "
        "VALUES (1, 'Manana', '07:00', '13:00') "
        "ON CONFLICT (id) DO NOTHING"
    )
    await pg.execute(
        "INSERT INTO personal (id, cedula, nombre, apellido, cargo, especialidad) "
        "VALUES ($1, $2, 'Emerg', 'Prueba', 'Médico', 'Medicina Interna') "
        "ON CONFLICT (id) DO NOTHING",
        pid, str(18000000 + pid),
    )
    await pg.execute(
        "INSERT INTO usuarios (username, password_hash, rol, activo, personal_id) "
        "VALUES ($1, $2, 'medico_emergencia', TRUE, $3) "
        "ON CONFLICT (username) DO NOTHING",
        username, _hash(), pid,
    )


async def test_emergencia_sin_guardia_no_puede_loguear(client, pg):
    await _sembrar_emergencia(pg, "emerg_sin_guardia", 999001)
    r = await login(client, "emerg_sin_guardia")
    assert r.status_code == 403
    assert "guardia" in r.json()["detail"].lower()


async def test_emergencia_con_guardia_activa_puede_loguear(client, pg):
    pid = 999002
    await _sembrar_emergencia(pg, "emerg_con_guardia", pid)
    await pg.execute(
        "INSERT INTO guardias (medico_id, turno_id, fecha, estado) "
        "VALUES ($1, 1, CURRENT_DATE, 'ACTIVA')",
        pid,
    )
    r = await login(client, "emerg_con_guardia")
    assert r.status_code == 200
    assert r.json()["rol"] == "emergency"
    assert r.json()["personal_id"] == pid


async def test_emergencia_guardia_ayer_24h_tambien_cubre_hoy(client, pg):
    pid = 999003
    await _sembrar_emergencia(pg, "emerg_verneo", pid)
    await pg.execute(
        "INSERT INTO guardias (medico_id, turno_id, fecha, estado) "
        "VALUES ($1, 1, CURRENT_DATE - 1, 'ACTIVA')",
        pid,
    )
    r = await login(client, "emerg_verneo")
    assert r.status_code == 200


async def test_emergencia_guardia_antigua_no_cubre_hoy(client, pg):
    pid = 999004
    await _sembrar_emergencia(pg, "emerg_antigua", pid)
    await pg.execute(
        "INSERT INTO guardias (medico_id, turno_id, fecha, estado) "
        "VALUES ($1, 1, CURRENT_DATE - 9, 'ACTIVA')",
        pid,
    )
    r = await login(client, "emerg_antigua")
    assert r.status_code == 403