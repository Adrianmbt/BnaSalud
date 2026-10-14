"""F2C (legado retirado): las recetas NO descuentan stock; solo los insumos aplicados.

Una consulta que recete medicamentos (catálogo para prescripción) sin insumos
aplicados no debe tocar `medicamentos_catalogo.stock_actual`.
"""
from tests.conftest import auth, token_para


async def _vaciar_consultas(pg):
    await pg.execute("DELETE FROM consultas")


async def test_consulta_con_recetas_sin_insumos_no_descuenta_stock(client, pg):
    tok = await token_para(client, "test_med")
    pac_id = await pg.fetchval(
        "SELECT id::text FROM historias_clinicas WHERE cedula='00000001'"
    )
    stock = await pg.fetchval("SELECT stock_actual FROM medicamentos_catalogo WHERE id=1")

    r = await client.post(
        "/api/v1/consultas",
        json={
            "paciente_id": pac_id,
            "medico_nombre": "Dr. Test",
            "especialidad": "Medicina General",
            "motivo_consulta": "Control",
            "recetas": [
                {"nombre": "Paracetamol", "posologia": "500mg cada 8h por 5 dias"},
            ],
        },
        headers=auth(tok),
    )
    assert r.status_code == 201
    assert await pg.fetchval(
        "SELECT stock_actual FROM medicamentos_catalogo WHERE id=1"
    ) == stock

    await _vaciar_consultas(pg)