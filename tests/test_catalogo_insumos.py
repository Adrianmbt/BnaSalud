"""Utilidades del catálogo y de las órdenes de entrega (sin base de datos)."""
import unittest

from app.api.v1.endpoints.almacen import _item_key, _tipo_de
from app.api.v1.endpoints.catalogo import _busqueda, _duplicado, _texto


class CatalogoInsumosTest(unittest.TestCase):
    def test_busqueda_quita_caracteres_de_filtro(self) -> None:
        limpio = _busqueda("  para(met)amol,500%*  ")
        self.assertEqual(limpio, "para met amol 500")

    def test_texto_opcional_vacio_es_nulo(self) -> None:
        self.assertEqual(_texto("  Caja x 20  "), "Caja x 20")
        self.assertIsNone(_texto("   "))
        self.assertIsNone(_texto(None))

    def test_detecta_codigo_duplicado(self) -> None:
        self.assertTrue(
            _duplicado(Exception('duplicate key value violates unique constraint "catalogo_insumos_codigo_key"'))
        )
        self.assertTrue(_duplicado(Exception("PostgrestAPIError 23505")))
        self.assertFalse(_duplicado(Exception("connection reset")))


class OrdenEntregaTest(unittest.TestCase):
    def test_categoria_define_el_tipo_del_interno(self) -> None:
        self.assertEqual(_tipo_de("Medicamento"), "medicamento")
        self.assertEqual(_tipo_de("Insumo Médico"), "insumo")
        self.assertEqual(_tipo_de("Material Quirúrgico"), "insumo")
        self.assertEqual(_tipo_de("Otro"), "insumo")

    def test_item_key_coincide_con_el_sistema_interno(self) -> None:
        self.assertEqual(_item_key("insumo", "Jeringa 5ml"), "insumo:jeringa-5ml")
        self.assertEqual(_item_key("medicamento", "Paracetamol 500mg"), "medicamento:paracetamol-500mg")


if __name__ == "__main__":
    unittest.main()
