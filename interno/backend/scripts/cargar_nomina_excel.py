"""Carga la nómina consolidada de RRHH (Excel) en `empleados`.

Uso, desde `backend/`:

    python scripts/cargar_nomina_excel.py "C:\\ruta\\DATA CONSOLIDADA.xlsx"
    python scripts/cargar_nomina_excel.py "DATA CONSOLIDADA.xlsx" --aplicar
    python scripts/cargar_nomina_excel.py "DATA CONSOLIDADA.xlsx" --aplicar --sin-egresos

Sin `--aplicar` solo previsualiza (no escribe nada). Con `--aplicar`, la
sincronización es una sola transacción: upsert por cédula e, salvo
`--sin-egresos`, `activo = false` para quien no venga en el archivo. Nunca
borra empleados (arrastraría a sus beneficiarios por CASCADE).
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import AsyncSessionLocal, engine  # noqa: E402
from app.services import nomina  # noqa: E402


def _leer(ruta: Path):
    datos = ruta.read_bytes()
    return nomina.leer_nomina(datos, ruta.name)


async def _main(args) -> int:
    ruta = Path(args.archivo)
    if not ruta.is_file():
        print(f"No existe el archivo: {ruta}")
        return 1

    registros, errores, advertencias, cedulas_presentes, resumen = _leer(ruta)
    inactivar = not args.sin_egresos

    try:
        async with AsyncSessionLocal() as db:
            vista = await nomina.previsualizar(db, registros, cedulas_presentes, inactivar)
            print(
                f"{resumen['empleados']} empleado(s) en {resumen['entes']} ente(s) "
                f"({resumen['filas']} filas leídas)."
            )
            print(
                f"Nuevos: {vista['nuevos']}  Actualizar: {vista['actualizar']}  "
                f"Egresos: {vista['a_inactivar']}"
            )
            print(f"Errores: {len(errores)}  Advertencias: {len(advertencias)}")
            for fila in errores[:20]:
                print(f"  ERROR  {fila['hoja']} fila {fila['fila']} ({fila['cedula']}): {fila['error']}")
            for fila in advertencias[:20]:
                print(f"  AVISO  {fila['hoja']} fila {fila['fila']} ({fila['cedula']}): {fila['advertencia']}")
            if len(errores) + len(advertencias) > 40:
                print(f"  ... y {len(errores) + len(advertencias) - 40} fila(s) más")

            if not args.aplicar:
                print("\nPrevisualización. Nada se escribió. Usa --aplicar para guardar.")
                return 0

            resultado = await nomina.sincronizar(
                db,
                registros,
                cedulas_presentes,
                inactivar_no_presentes=inactivar,
                archivo=ruta.name,
                usuario=None,
                resumen=resumen,
                errores_fila=len(errores),
            )
            print(f"\nAplicado: {resultado['mensaje']}")
            return 0
    finally:
        await engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description="Sincroniza la nómina de empleados desde Excel.")
    parser.add_argument("archivo", help="Ruta del .xlsx consolidado")
    parser.add_argument("--aplicar", action="store_true", help="Escribe en la base de datos")
    parser.add_argument(
        "--sin-egresos",
        action="store_true",
        help="No inactiva a los empleados que no estén en el archivo",
    )
    return asyncio.run(_main(parser.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
