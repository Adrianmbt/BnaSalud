"""Pruebas del módulo de Historia Clínica Integral (rol historias_medicas).

Cubren: login y permisos, búsqueda por cédula, alta básica, ficha versionada con
sincronización de identificación, atenciones que crean consultas con
`origen='historia_integral'`, reposos vinculados a nómina, anulación auditada y
métricas.
"""

import json
import uuid

from conftest import auth, login, token_para

CEDULA_TRABAJADOR = "20345678"  # empleado activo sembrado en conftest
BASE = "/api/v1/historias-medicas"


async def _alta_paciente(client, token, cedula, nombres="Ana", apellidos="Perez"):
    r = await client.post(
        f"{BASE}/pacientes",
        headers=auth(token),
        json={
            "tipo_cedula": "V",
            "cedula": cedula,
            "nombres": nombres,
            "apellidos": apellidos,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def _ficha(identificacion, extra=None):
    datos = {
        "identificacion": identificacion,
        "antecedentes_personales": {"carnet_prenatal": True, "horas_fuera_casa": 8},
        "factores_riesgo": {"fuma": True, "n_cigarrillos_diarios": 5},
    }
    if extra:
        datos.update(extra)
    return {"numero_carpeta": identificacion.get("numero_carpeta"), "datos": datos}


async def test_login_rol_historias_medicas(client):
    r = await login(client, "test_hist")
    assert r.status_code == 200
    body = r.json()
    assert body["rol"] == "historias_medicas"
    assert body["clinica_id"] == 13


async def test_permisos_lectura_y_escritura(client):
    tok_hist = await token_para(client, "test_hist")
    tok_med = await token_para(client, "test_med")
    tok_recep = await token_para(client, "test_recep")
    tok_farm = await token_para(client, "test_farm")

    # Lectura clínica amplia.
    for tok in (tok_hist, tok_med, tok_recep):
        r = await client.get(f"{BASE}/pacientes", params={"q": "00"}, headers=auth(tok))
        assert r.status_code == 200, r.text

    # Farmacia queda fuera del módulo.
    r = await client.get(f"{BASE}/pacientes", params={"q": "00"}, headers=auth(tok_farm))
    assert r.status_code == 403

    # Escritura reservada al rol.
    for tok in (tok_med, tok_recep):
        r = await client.post(
            f"{BASE}/pacientes",
            headers=auth(tok),
            json={"cedula": "99900001", "nombres": "No", "apellidos": "Permitido"},
        )
        assert r.status_code == 403


async def test_busqueda_prioriza_cedula_exacta(client):
    tok = await token_para(client, "test_hist")
    await _alta_paciente(client, tok, "55500001", "Búsqueda", "Exacta")
    await _alta_paciente(client, tok, "155500001", "Búsqueda", "Parcial")

    r = await client.get(
        f"{BASE}/pacientes", params={"q": "55500001"}, headers=auth(tok)
    )
    assert r.status_code == 200
    filas = r.json()
    assert len(filas) >= 2
    assert filas[0]["cedula"] == "55500001"
    assert filas[0]["nombre_completo"] == "Búsqueda Exacta"


async def test_ficha_versionada_y_sincronizacion(client, pg):
    tok = await token_para(client, "test_hist")
    paciente = await _alta_paciente(client, tok, "70000001", "Luis", "Gomez")
    hid = paciente["id"]

    r = await client.put(
        f"{BASE}/pacientes/{hid}/ficha",
        headers=auth(tok),
        json=_ficha(
            {
                "nombres": "Luis Alberto",
                "apellidos": "Gomez Diaz",
                "telefono": "04141112233",
                "direccion": "Calle 5, Barcelona",
                "numero_carpeta": "C-001",
                "sexo": "M",
            }
        ),
    )
    assert r.status_code == 200, r.text
    ficha = r.json()
    assert ficha["version"] == 1
    assert ficha["datos"]["identificacion"]["nombres"] == "Luis Alberto"

    # La ficha se refleja en historias_clinicas para que la búsqueda funcione.
    fila = await pg.fetchrow(
        "SELECT nombre_completo, apellido, telefono, direccion FROM historias_clinicas WHERE id = $1",
        uuid.UUID(hid),
    )
    assert fila["nombre_completo"] == "Luis Alberto Gomez Diaz"
    assert fila["apellido"] == "Gomez Diaz"
    assert fila["telefono"] == "04141112233"
    assert fila["direccion"] == "Calle 5, Barcelona"

    # Segundo guardado: sube la versión y conserva el histórico de auditoría.
    r2 = await client.put(
        f"{BASE}/pacientes/{hid}/ficha",
        headers=auth(tok),
        json=_ficha(
            {
                "nombres": "Luis Alberto",
                "apellidos": "Gomez Diaz",
                "telefono": "04141112233",
                "numero_carpeta": "C-001",
            },
            extra={"observaciones": {"observaciones": "Paciente estable."}},
        ),
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["version"] == 2
    assert r2.json()["datos"]["observaciones"]["observaciones"] == "Paciente estable."

    version_db = await pg.fetchval(
        "SELECT version FROM historias_integrales WHERE historia_clinica_id = $1",
        uuid.UUID(hid),
    )
    assert version_db == 2

    detalle = await client.get(f"{BASE}/pacientes/{hid}", headers=auth(tok))
    assert detalle.status_code == 200
    cuerpo = detalle.json()
    assert cuerpo["paciente"]["tiene_ficha"] is True
    assert cuerpo["paciente"]["numero_carpeta"] == "C-001"
    assert cuerpo["ficha"]["version"] == 2


async def test_atencion_crea_consulta_integral(client, pg):
    tok = await token_para(client, "test_hist")
    paciente = await _alta_paciente(client, tok, "70000002", "Marta", "Rojas")
    hid = paciente["id"]

    await client.put(
        f"{BASE}/pacientes/{hid}/ficha",
        headers=auth(tok),
        json=_ficha({"nombres": "Marta", "apellidos": "Rojas"}),
    )

    r = await client.post(
        f"{BASE}/pacientes/{hid}/atenciones",
        headers=auth(tok),
        json={
            "motivo_consulta": "Cefalea persistente",
            "enfermedad_actual": "Dolor frontotemporal de 3 días",
            "examen_fisico": "Neurológico sin déficit",
            "cie10_codigo": "R51",
            "diagnostico_principal": "Cefalea",
            "diagnostico_secundario": "Tensión arterial elevada",
            "tratamiento": "Analgésico por 5 días",
            "recomendaciones": "Reposo relativo",
            "signos_vitales": {
                "presion_arterial": "130/85",
                "frecuencia_cardiaca": 78,
                "temperatura": 36.8,
            },
        },
    )
    assert r.status_code == 201, r.text
    atencion = r.json()
    assert atencion["comprobante_ref"].startswith("HI-")
    assert atencion["signos_vitales"]["presion_arterial"] == "130/85"
    assert atencion["diagnostico_secundario"] == "Tensión arterial elevada"

    consulta = await pg.fetchrow(
        "SELECT origen, historia_integral_id, clinica_id, motivo_consulta "
        "FROM consultas WHERE id = $1",
        uuid.UUID(atencion["id"]),
    )
    assert consulta["origen"] == "historia_integral"
    assert consulta["clinica_id"] == 13
    assert consulta["motivo_consulta"] == "Cefalea persistente"

    ficha_id = await pg.fetchval(
        "SELECT id FROM historias_integrales WHERE historia_clinica_id = $1",
        uuid.UUID(hid),
    )
    assert consulta["historia_integral_id"] == ficha_id

    detalle = await client.get(f"{BASE}/pacientes/{hid}", headers=auth(tok))
    assert detalle.status_code == 200
    assert len(detalle.json()["atenciones"]) == 1

    historial = await client.get(f"{BASE}/pacientes/{hid}/atenciones", headers=auth(tok))
    assert historial.status_code == 200
    assert historial.json()[0]["motivo_consulta"] == "Cefalea persistente"


async def test_reposo_vinculado_a_nomina_y_anulacion(client, pg):
    tok = await token_para(client, "test_hist")
    tok_med = await token_para(client, "test_med")
    tok_admin = await token_para(client, "test_admin")

    paciente = await _alta_paciente(
        client, tok, CEDULA_TRABAJADOR, "Juan", "Perez"
    )
    hid = paciente["id"]

    # Días fuera del formato: el contrato solo admite 1, 3, 5 y 7.
    invalido = await client.post(
        f"{BASE}/pacientes/{hid}/reposos",
        headers=auth(tok),
        json={"dias": 2},
    )
    assert invalido.status_code == 422

    r = await client.post(
        f"{BASE}/pacientes/{hid}/reposos",
        headers=auth(tok),
        json={
            "dias": 5,
            "fecha_inicio": "2026-03-02",
            "diagnostico": "Lumbalgia aguda",
            "descripcion": "Evitar esfuerzos físicos.",
        },
    )
    assert r.status_code == 201, r.text
    reposo = r.json()
    assert reposo["folio"].startswith("RM-")
    assert reposo["dias"] == 5
    assert reposo["fecha_inicio"] == "2026-03-02"
    assert reposo["fecha_fin"] == "2026-03-06"
    assert reposo["empleado_id"] is not None
    assert reposo["trabajador_nombre"] == "Juan Perez"
    assert reposo["paciente_cedula"] == CEDULA_TRABAJADOR

    empleado_vinculado = await pg.fetchval(
        "SELECT empleado_id FROM reposos_medicos WHERE id = $1",
        uuid.UUID(reposo["id"]),
    )
    assert str(empleado_vinculado) == reposo["empleado_id"]

    # Un médico no puede anular; el rol del módulo y dirección sí.
    r = await client.post(
        f"{BASE}/reposos/{reposo['id']}/anular",
        headers=auth(tok_med),
        json={"motivo": "Intento sin permiso"},
    )
    assert r.status_code == 403

    r = await client.post(
        f"{BASE}/reposos/{reposo['id']}/anular",
        headers=auth(tok),
        json={"motivo": "Error en los días indicados"},
    )
    assert r.status_code == 200, r.text
    anulado = r.json()
    assert anulado["estado"] == "anulado"
    assert anulado["anulado_por"] == "test_hist"
    assert anulado["motivo_anulacion"] == "Error en los días indicados"

    # Anular dos veces es conflicto, sin borrar el registro.
    r = await client.post(
        f"{BASE}/reposos/{reposo['id']}/anular",
        headers=auth(tok),
        json={"motivo": "Repetido"},
    )
    assert r.status_code == 409

    # Dirección también puede anular.
    otro = await client.post(
        f"{BASE}/pacientes/{hid}/reposos",
        headers=auth(tok),
        json={"dias": 1, "diagnostico": "Control"},
    )
    assert otro.status_code == 201
    r = await client.post(
        f"{BASE}/reposos/{otro.json()['id']}/anular",
        headers=auth(tok_admin),
        json={"motivo": "Anulación administrativa"},
    )
    assert r.status_code == 200
    assert r.json()["anulado_por"] == "test_admin"

    listado = await client.get(f"{BASE}/reposos", headers=auth(tok))
    assert listado.status_code == 200
    assert listado.json()["total"] >= 2

    filtrado = await client.get(
        f"{BASE}/reposos", params={"estado": "vigente"}, headers=auth(tok)
    )
    assert filtrado.status_code == 200
    assert all(item["estado"] == "vigente" for item in filtrado.json()["items"])


async def test_metricas_de_reposos_y_resumen(client):
    import datetime

    tok = await token_para(client, "test_hist")
    hoy = datetime.date.today()

    r = await client.get(
        f"{BASE}/metricas/reposos",
        params={"anio": hoy.year, "mes": hoy.month},
        headers=auth(tok),
    )
    assert r.status_code == 200, r.text
    metricas = r.json()
    assert metricas["anio"] == hoy.year
    assert metricas["mes"] == hoy.month
    assert metricas["total"] >= 1
    assert isinstance(metricas["por_mes"], list) and len(metricas["por_mes"]) == 12
    assert any(d["dias"] == 5 for d in metricas["por_dia"])

    r = await client.get(f"{BASE}/metricas/resumen", headers=auth(tok))
    assert r.status_code == 200
    resumen = r.json()
    assert resumen["pacientes"] >= 1
    assert resumen["fichas"] >= 1
    assert resumen["reposos_mes"] >= 0


async def test_reposo_rechaza_consulta_ajena(client):
    tok = await token_para(client, "test_hist")
    paciente = await _alta_paciente(client, tok, "70000003", "Elena", "Suarez")
    otro = await _alta_paciente(client, tok, "70000004", "Pedro", "Larez")

    r = await client.post(
        f"{BASE}/pacientes/{otro['id']}/atenciones",
        headers=auth(tok),
        json={"motivo_consulta": "Control"},
    )
    assert r.status_code == 201
    consulta_ajena = r.json()["id"]

    r = await client.post(
        f"{BASE}/pacientes/{paciente['id']}/reposos",
        headers=auth(tok),
        json={"dias": 3, "consulta_id": consulta_ajena},
    )
    assert r.status_code == 400


async def test_atencion_con_recetas_y_reposo_en_indicaciones(client, pg):
    tok = await token_para(client, "test_hist")
    paciente = await _alta_paciente(client, tok, "70000005", "Rosa", "Mendoza")
    hid = paciente["id"]

    r = await client.post(
        f"{BASE}/pacientes/{hid}/atenciones",
        headers=auth(tok),
        json={
            "motivo_consulta": "Dolor lumbar",
            "tratamiento": "Se aplicó calor local y analgesia oral.",
            "recetas": [
                {
                    "nombre": "Ibuprofeno 400 mg",
                    "posologia": "1 tableta cada 8 horas por 3 días",
                    "cantidad": 9,
                }
            ],
            "reposo": {
                "fecha_inicio": "2026-03-10",
                "dias": 3,
                "diagnostico": "Lumbalgia aguda",
                "descripcion": "Evitar cargar peso.",
            },
        },
    )
    assert r.status_code == 201, r.text
    atencion = r.json()
    assert atencion["recetas"][0]["nombre"] == "Ibuprofeno 400 mg"
    assert atencion["reposo"]["folio"].startswith("RM-")
    assert atencion["reposo"]["dias"] == 3
    assert atencion["reposo"]["fecha_inicio"] == "2026-03-10"
    assert atencion["reposo"]["fecha_fin"] == "2026-03-12"

    consulta = await pg.fetchrow(
        "SELECT recetas, reposos FROM consultas WHERE id = $1",
        uuid.UUID(atencion["id"]),
    )
    recetas_db = json.loads(consulta["recetas"])
    reposos_db = json.loads(consulta["reposos"])
    assert recetas_db[0]["nombre"] == "Ibuprofeno 400 mg"
    assert reposos_db[0]["folio"] == atencion["reposo"]["folio"]

    reposo_db = await pg.fetchrow(
        "SELECT consulta_id, dias, fecha_inicio, fecha_fin "
        "FROM reposos_medicos WHERE id = $1",
        uuid.UUID(atencion["reposo"]["id"]),
    )
    assert str(reposo_db["consulta_id"]) == atencion["id"]
    assert reposo_db["dias"] == 3

    historial = await client.get(f"{BASE}/pacientes/{hid}/atenciones", headers=auth(tok))
    assert historial.status_code == 200
    assert historial.json()[0]["recetas"][0]["nombre"] == "Ibuprofeno 400 mg"
    assert historial.json()[0]["reposo"]["dias"] == 3


async def test_cola_consultas_y_vinculo_con_atencion(client, pg):
    tok = await token_para(client, "test_hist")
    paciente = await _alta_paciente(client, tok, "70000006", "Cola", "Integral")
    hid = paciente["id"]

    cola_id = await pg.fetchval(
        "INSERT INTO cola_atencion "
        "(token, paciente_id, paciente_cedula, paciente_nombre, clinica_id, "
        " atencion_estado, iniciado_en, fin_en, creado_en) "
        "VALUES ('C-TEST-HIST', $1, '70000006', 'Cola Integral', 13, "
        "        'FINALIZADO', NOW(), NOW(), NOW()) RETURNING id",
        uuid.UUID(hid),
    )

    r = await client.get(f"{BASE}/cola", headers=auth(tok))
    assert r.status_code == 200, r.text
    fila = next((i for i in r.json() if i["cola_id"] == cola_id), None)
    assert fila is not None
    assert fila["cedula"] == "70000006"
    assert fila["estado"] == "FINALIZADO"
    assert fila["tiene_ficha"] is False
    assert fila["tiene_atencion_integral"] is False

    r = await client.post(
        f"{BASE}/pacientes/{hid}/atenciones",
        headers=auth(tok),
        json={"cola_id": cola_id, "motivo_consulta": "Control post-consulta"},
    )
    assert r.status_code == 201, r.text
    atencion_id = r.json()["id"]

    r = await client.get(f"{BASE}/cola", headers=auth(tok))
    fila = next(i for i in r.json() if i["cola_id"] == cola_id)
    assert fila["tiene_atencion_integral"] is True
    assert fila["consulta_id"] == atencion_id

    consulta_id = await pg.fetchval(
        "SELECT consulta_id FROM cola_atencion WHERE id = $1", cola_id
    )
    assert str(consulta_id) == atencion_id


async def test_historia_inexistente_404(client):
    tok = await token_para(client, "test_hist")
    inexistente = str(uuid.uuid4())
    r = await client.get(f"{BASE}/pacientes/{inexistente}", headers=auth(tok))
    assert r.status_code == 404

    r = await client.post(
        f"{BASE}/pacientes/{inexistente}/atenciones",
        headers=auth(tok),
        json={"motivo_consulta": "Nada"},
    )
    assert r.status_code == 404
