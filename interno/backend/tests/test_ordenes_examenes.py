"""Fase Órdenes de exámenes: catálogo y orden médica.

Regresión del bug QA: «/examenes/catalogo» devolvía 500 porque la migración
seed_ordenes_examenes.sql (catálogo, órdenes e items) nunca se aplicó a la BD.
"""
from conftest import auth, token_para


async def test_catalogo_disponible(client):
    """El catálogo estructurado debe responder 200 con categorías."""
    tok = await token_para(client, "test_med")
    r = await client.get("/api/v1/examenes/catalogo", headers=auth(tok))
    assert r.status_code == 200, r.text
    assert "categorias" in r.json()


async def test_buscar_examen_por_nombre(client):
    """La búsqueda del catálogo debe encontrar exámenes."""
    tok = await token_para(client, "test_med")
    r = await client.get(
        "/api/v1/examenes/catalogo/buscar", params={"q": "sangre"}, headers=auth(tok)
    )
    assert r.status_code == 200, r.text
    assert "resultados" in r.json()


async def test_crear_orden_de_examen(client):
    """Un médico crea una orden de exámenes para un paciente."""
    tok = await token_para(client, "test_med")

    paciente_ok = await client.post(
        "/api/v1/cola",
        json={
            "cedula": "00000001",
            "nombre_completo": "Paciente Test",
            "ruta_atencion": "CITA",
            "clinica_id": 13,
            "motivo": "Control",
        },
        headers=auth(tok),
    )
    assert paciente_ok.status_code in (200, 201), paciente_ok.text
    historia = paciente_ok.json().get("historia", {}).get("id")
    if not historia:
        historia = paciente_ok.json().get("paciente_id")
    assert historia, paciente_ok.text

    r = await client.post(
        "/api/v1/examenes/ordenes",
        json={
            "paciente_id": historia,
            "origen_atencion": "consulta_especialidad",
            "observaciones": "QA orden examenes",
            "examenes": [
                {
                    "nombre_examen": "Hemograma completo",
                    "categoria": "laboratorio",
                    "grupo": "Hematología",
                }
            ],
        },
        headers=auth(tok),
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["estado"] == "pendiente"
    assert len(data["items"]) == 1
    assert data["items"][0]["examen_id"], "Item quedó sin examen_id del catálogo"

    detalle = await client.get(
        f"/api/v1/examenes/ordenes/{data['id']}", headers=auth(tok)
    )
    assert detalle.status_code == 200, detalle.text