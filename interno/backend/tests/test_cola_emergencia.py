"""Cola de emergencia: categoría por afiliación y orden por prioridad.

Verifica la mejora de la interfaz del médico de urgencias: cada paciente de la
cola llega con `categoria` (trabajador | beneficiario | publico) y la espera se
ordena por prioridad (1 = crítico) antes que por antigüedad (FIFO).
"""
import uuid

from conftest import token_para


async def _insertar_cola(pg, cedula: str, nombre: str, prioridad: int) -> None:
    await pg.execute(
        "INSERT INTO cola_atencion "
        "(token, paciente_cedula, paciente_nombre, clinica_id, atencion_estado, "
        " ruta_atencion, prioridad, categoria_prioridad, fec_encolada, creado_en) "
        "VALUES ($1, $2, $3, 16, 'EN_ESPERA_CONSULTA'::atencion_estado_t, "
        "'EMERGENCIA'::ruta_atencion_t, $4, 'AMARILLO'::categoria_paciente_t, now(), now())",
        f"C-{uuid.uuid4()}", cedula, nombre, prioridad,
    )


async def test_espera_emergencia_categoria_y_prioridad(client, pg):
    # Afiliación aislada en otra clínica para no depender de mutaciones de otros tests.
    emp_id = str(uuid.uuid4())
    await pg.execute(
        "INSERT INTO empleados (id, cedula, nombre_completo, edad, cargo, activo) "
        "VALUES ($1, '20400001', 'Ana Afiliada', 30, 'Tecnico', TRUE)",
        emp_id,
    )
    await pg.execute(
        "INSERT INTO beneficiarios (id, empleado_id, cedula, nombre_completo, parentesco, activo) "
        "VALUES ($1, $2, '10400002', 'Pedro Carga', 'Hijo', TRUE)",
        str(uuid.uuid4()), emp_id,
    )
    await _insertar_cola(pg, "20400001", "Ana Afiliada", 3)
    await _insertar_cola(pg, "10400002", "Pedro Carga", 3)
    await _insertar_cola(pg, "99999999", "Publico Urgente", 1)

    token = await token_para(client, "test_recep")
    r = await client.get(
        "/api/v1/cola",
        params={"clinica_id": 16, "rol": "medico_emergencia", "medico_id": 999999},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    espera = r.json()["espera"]

    by_cedula = {p["paciente_cedula"]: p for p in espera}
    assert len(by_cedula) >= 3
    assert by_cedula["20400001"]["categoria"] == "trabajador"
    assert by_cedula["10400002"]["categoria"] == "beneficiario"
    assert by_cedula["99999999"]["categoria"] == "publico"

    # P1 (más reciente) ordena antes que los P3 (más antiguos): prioridad > FIFO.
    prioridades = [p["prioridad"] for p in espera]
    assert prioridades == sorted(prioridades)
    assert by_cedula["99999999"]["prioridad"] == 1
    assert prioridades[0] == 1