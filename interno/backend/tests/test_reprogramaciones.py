"""Pruebas del flujo de ausencias y reprogramación de citas."""

import datetime
import uuid

from conftest import auth, token_para

MEDICO_1 = 998201
MEDICO_2 = 998202


async def _crear_medico(pg, medico_id: int, cedula: str):
    await pg.execute(
        "INSERT INTO turnos (id, nombre, hora_inicio, hora_fin) "
        "VALUES (2, 'Mañana', '07:00', '13:00') ON CONFLICT (id) DO NOTHING"
    )
    await pg.execute(
        "INSERT INTO personal (id, cedula, nombre, apellido, cargo, especialidad, clinica_id) "
        "VALUES ($1, $2, 'Medico', 'Reprogramacion', 'Medico', 'Medicina General', 13) "
        "ON CONFLICT (id) DO NOTHING",
        medico_id,
        cedula,
    )
    for dia in range(7):
        await pg.execute(
            "INSERT INTO agenda_medicos (medico_id, dia_semana, turno_id, activo) "
            "VALUES ($1, $2, 2, TRUE) ON CONFLICT DO NOTHING",
            medico_id,
            dia,
        )


async def _crear_paciente(pg, cedula: str) -> str:
    paciente_id = str(uuid.uuid4())
    await pg.execute(
        "INSERT INTO historias_clinicas "
        "(id, tipo_cedula, cedula, nombre_completo, telefono, numero_historia) "
        "VALUES ($1, 'V', $2, 'Paciente Reprogramacion', '04141234567', $3)",
        paciente_id,
        cedula,
        f"HC-{cedula}",
    )
    return paciente_id


async def _crear_cita(pg, medico_id: int, paciente_id: str, fecha: str, hora: str, codigo: str):
    cita_id = str(uuid.uuid4())
    await pg.execute(
        "INSERT INTO citas "
        "(id, paciente_id, centro_id, centro_salud, especialidad, medico_id, "
        " fecha_cita, hora_inicio, motivo, origen, estado, codigo_confirmacion) "
        "VALUES ($1, $2, 13, 'CITAB', 'Medicina General', $3, $4, $5, "
        "        'QA reprogramacion', 'cita_web', 'pendiente', $6)",
        cita_id,
        paciente_id,
        medico_id,
        datetime.date.fromisoformat(fecha),
        datetime.time.fromisoformat(hora),
        codigo,
    )
    return cita_id


async def test_ausencia_bloquea_agenda_y_creacion(client, pg):
    await _crear_medico(pg, MEDICO_1, "19000001")
    tok = await token_para(client, "test_recep")

    r = await client.post(
        "/api/v1/reprogramaciones/ausencias",
        json={
            "medico_id": MEDICO_1,
            "fecha_desde": "2099-01-05",
            "fecha_hasta": "2099-01-05",
            "motivo": "QA ausencia",
        },
        headers=auth(tok),
    )
    assert r.status_code == 201, r.text
    ausencia_id = r.json()["id"]

    r = await client.get(
        f"/api/v1/agenda/turnos?medico_id={MEDICO_1}&fecha=2099-01-05",
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text
    dia = r.json()[0]
    assert dia["disponible"] is False
    assert dia["motivo"] == "médico ausente"

    paciente_id = await _crear_paciente(pg, "19000002")
    r = await client.post(
        "/api/v1/agenda/citas",
        json={
            "medico_id": MEDICO_1,
            "paciente_id": paciente_id,
            "fecha": "2099-01-05",
            "hora_inicio": "07:00",
            "nivel": "azul",
            "especialidad": "Medicina General",
            "origen": "remision",
        },
        headers=auth(tok),
    )
    assert r.status_code == 409, r.text

    r = await client.get(
        f"/api/v1/reprogramaciones/ausencias/{ausencia_id}/afectadas",
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text


async def test_plan_confirma_y_mueve_cita(client, pg):
    await _crear_medico(pg, MEDICO_2, "19000011")
    paciente_id = await _crear_paciente(pg, "19000012")
    cita_id = await _crear_cita(
        pg, MEDICO_2, paciente_id, "2099-02-02", "07:00", "CITAB-2099-QA1"
    )
    tok = await token_para(client, "test_recep")

    r = await client.post(
        "/api/v1/reprogramaciones/ausencias",
        json={
            "medico_id": MEDICO_2,
            "fecha_desde": "2099-02-02",
            "fecha_hasta": "2099-02-02",
            "motivo": "QA plan",
        },
        headers=auth(tok),
    )
    assert r.status_code == 201, r.text
    ausencia_id = r.json()["id"]

    r = await client.post(
        f"/api/v1/reprogramaciones/ausencias/{ausencia_id}/plan",
        json={"desde": "2099-02-03", "estrategia": "primer_hueco"},
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["resumen"]["total"] == 1
    assert body["resumen"]["con_cupo"] == 1
    propuesta = body["propuestas"][0]
    assert propuesta["fecha_nueva"] == "2099-02-03"
    assert propuesta["hora_nueva"] == "07:00"

    r = await client.post(
        f"/api/v1/reprogramaciones/propuestas/{propuesta['id']}/confirmar",
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text
    assert r.json()["propuesta"]["estado"] == "confirmada"

    fila = await pg.fetchrow(
        "SELECT fecha_cita, hora_inicio FROM citas WHERE id = $1", cita_id
    )
    assert fila["fecha_cita"].isoformat() == "2099-02-03"
    assert str(fila["hora_inicio"])[:5] == "07:00"


async def test_turnos_jornada_filtra_y_mueve_citas(client, pg):
    await _crear_medico(pg, MEDICO_1, "19000041")
    paciente_id = await _crear_paciente(pg, "19000042")
    fecha = "2099-05-04"
    cita_manana = await _crear_cita(
        pg, MEDICO_1, paciente_id, fecha, "07:30", "CITAB-2099-QA5"
    )
    cita_tarde = await _crear_cita(
        pg, MEDICO_1, paciente_id, fecha, "15:00", "CITAB-2099-QA6"
    )
    tok = await token_para(client, "test_recep")

    r = await client.get(
        f"/api/v1/reprogramaciones/jornada/turnos?medico_id={MEDICO_1}&fecha={fecha}",
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text
    turno_manana = next(t for t in r.json()["items"] if t["turno_id"] == 2)
    assert turno_manana["citas"] == 1

    r = await client.get(
        f"/api/v1/reprogramaciones/jornada/previa"
        f"?medico_id={MEDICO_1}&fecha={fecha}&turno_id=2",
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text
    assert [i["id"] for i in r.json()["items"]] == [cita_manana]

    r = await client.post(
        "/api/v1/reprogramaciones/mover-jornada",
        json={
            "medico_id": MEDICO_1,
            "fecha_origen": fecha,
            "fecha_destino": "2099-05-05",
            "ajustar_horas": False,
            "intervalo_minutos": 30,
            "citas_ids": [cita_manana],
        },
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total_movidas"] == 1
    assert body["citas"][0]["link_whatsapp"].startswith("https://wa.me/58414")

    movida = await pg.fetchrow(
        "SELECT fecha_cita FROM citas WHERE id = $1", uuid.UUID(cita_manana)
    )
    pendiente = await pg.fetchrow(
        "SELECT fecha_cita FROM citas WHERE id = $1", uuid.UUID(cita_tarde)
    )
    assert movida["fecha_cita"].isoformat() == "2099-05-05"
    assert pendiente["fecha_cita"].isoformat() == fecha


async def test_confirmar_detecta_slot_ocupado_y_permite_reproponer(client, pg):
    await _crear_medico(pg, MEDICO_1, "19000021")
    paciente_id = await _crear_paciente(pg, "19000022")
    await _crear_cita(pg, MEDICO_1, paciente_id, "2099-03-02", "07:00", "CITAB-2099-QA2")
    tok = await token_para(client, "test_recep")

    r = await client.post(
        "/api/v1/reprogramaciones/ausencias",
        json={
            "medico_id": MEDICO_1,
            "fecha_desde": "2099-03-02",
            "fecha_hasta": "2099-03-02",
            "motivo": "QA conflicto",
        },
        headers=auth(tok),
    )
    assert r.status_code == 201, r.text
    ausencia_id = r.json()["id"]

    r = await client.post(
        f"/api/v1/reprogramaciones/ausencias/{ausencia_id}/plan",
        json={"desde": "2099-03-03", "estrategia": "primer_hueco"},
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text
    propuesta = r.json()["propuestas"][0]

    paciente_2 = await _crear_paciente(pg, "19000023")
    await _crear_cita(
        pg, MEDICO_1, paciente_2, "2099-03-03", "07:00", "CITAB-2099-QA3"
    )

    r = await client.post(
        f"/api/v1/reprogramaciones/propuestas/{propuesta['id']}/confirmar",
        headers=auth(tok),
    )
    assert r.status_code == 409, r.text

    r = await client.post(
        f"/api/v1/reprogramaciones/propuestas/{propuesta['id']}/reproponer",
        json={"fecha": "2099-03-03", "hora_inicio": "08:00"},
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text
    assert r.json()["hora_nueva"] == "08:00"

    r = await client.post(
        f"/api/v1/reprogramaciones/propuestas/{propuesta['id']}/confirmar",
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text


async def test_rechazar_no_resuelve_ausencia_si_quedan_citas_afectadas(client, pg):
    await _crear_medico(pg, MEDICO_2, "19000031")
    paciente_id = await _crear_paciente(pg, "19000032")
    await _crear_cita(
        pg, MEDICO_2, paciente_id, "2099-04-02", "07:00", "CITAB-2099-QA4"
    )
    tok = await token_para(client, "test_recep")

    r = await client.post(
        "/api/v1/reprogramaciones/ausencias",
        json={
            "medico_id": MEDICO_2,
            "fecha_desde": "2099-04-02",
            "fecha_hasta": "2099-04-02",
            "motivo": "QA rechazo",
        },
        headers=auth(tok),
    )
    assert r.status_code == 201, r.text
    ausencia_id = r.json()["id"]

    r = await client.post(
        f"/api/v1/reprogramaciones/ausencias/{ausencia_id}/plan",
        json={"desde": "2099-04-03", "estrategia": "primer_hueco"},
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text
    propuesta = r.json()["propuestas"][0]

    r = await client.post(
        f"/api/v1/reprogramaciones/propuestas/{propuesta['id']}/rechazar",
        json={"notas": "Paciente no acepto"},
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text

    r = await client.get("/api/v1/reprogramaciones/ausencias", headers=auth(tok))
    assert r.status_code == 200, r.text
    ausencia = next(a for a in r.json()["items"] if a["id"] == ausencia_id)
    assert ausencia["estado"] == "activa"
    assert ausencia["afectadas"] == 1

    r = await client.post(
        f"/api/v1/reprogramaciones/ausencias/{ausencia_id}/plan",
        json={"desde": "2099-04-03", "estrategia": "primer_hueco"},
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text
    nueva = r.json()["propuestas"][0]

    r = await client.post(
        f"/api/v1/reprogramaciones/propuestas/{nueva['id']}/confirmar",
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text
    assert r.json()["ausencia_resuelta"] is True
