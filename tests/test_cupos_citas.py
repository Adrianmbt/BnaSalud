"""Doble reserva: el índice de la 0027 se traduce en 409, no en 500."""
import unittest

from app.api.v1.endpoints.citas import _es_cupo_duplicado


class CupoDuplicadoTest(unittest.TestCase):
    def test_reconoce_la_violacion_del_indice(self) -> None:
        error = Exception(
            "{'code': '23505', 'message': 'duplicate key value violates unique "
            "constraint \"citas_cupo_centro_uq\"'}"
        )
        self.assertTrue(_es_cupo_duplicado(error))

    def test_otro_error_de_base_no_es_doble_reserva(self) -> None:
        self.assertFalse(_es_cupo_duplicado(Exception("connection refused")))


if __name__ == "__main__":
    unittest.main()
