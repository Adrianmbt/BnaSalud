"""Reglas de las cuentas globales que no dependen de la base de datos."""
import unittest

from fastapi import HTTPException

from app.api.v1.endpoints.usuarios import _a_respuesta, _validar_desactivacion


class ReglasUsuariosGlobalesTest(unittest.TestCase):
    def test_no_deja_desactivarse_a_si_mismo(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            _validar_desactivacion(
                {"username": "adrianbello"},
                {"username": "adrianbello", "rol": "admin_sistemas", "activo": True},
                False,
                2,
            )
        self.assertEqual(ctx.exception.status_code, 409)

    def test_no_deja_desactivar_la_ultima_activa(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            _validar_desactivacion(
                {"username": "adrianbello"},
                {"username": "director", "rol": "director", "activo": True},
                False,
                1,
            )
        self.assertEqual(ctx.exception.status_code, 409)

    def test_permite_desactivar_si_queda_otra_activa(self) -> None:
        _validar_desactivacion(
            {"username": "adrianbello"},
            {"username": "director", "rol": "director", "activo": True},
            False,
            2,
        )
        _validar_desactivacion(
            {"username": "adrianbello"},
            {"username": "adrianbello", "rol": "admin_sistemas", "activo": True},
            True,
            1,
        )

    def test_nombre_cae_en_el_usuario_sin_ficha(self) -> None:
        fila = {"id": "1", "username": "adrianbello", "rol": "admin_sistemas", "activo": True}
        self.assertEqual(_a_respuesta(fila, {}).nombre, "adrianbello")
        fila["personal_id"] = 999
        self.assertEqual(_a_respuesta(fila, {999: "Oswaldo García"}).nombre, "Oswaldo García")


if __name__ == "__main__":
    unittest.main()
