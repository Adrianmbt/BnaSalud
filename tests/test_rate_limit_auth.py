"""Pruebas de la ventana de intentos de autenticación (sin base de datos)."""
import unittest

from app.api.v1.endpoints.auth import _intentos_auth, _rate_limit_auth


class RateLimitAuthTest(unittest.TestCase):
    def setUp(self) -> None:
        _intentos_auth.clear()

    def test_bloquea_el_sexto_intento(self) -> None:
        clave = "test:127.0.0.1"
        permitidos = [_rate_limit_auth(clave) for _ in range(5)]
        self.assertTrue(all(permitidos))
        self.assertFalse(_rate_limit_auth(clave))

    def test_claves_independientes(self) -> None:
        for _ in range(6):
            _rate_limit_auth("ip-a")
        self.assertTrue(_rate_limit_auth("ip-b"))


if __name__ == "__main__":
    unittest.main()
