"""Pruebas de humo del portal público contra un backend en marcha.

Comprueba permisos por rol, panel, soporte, cupos de citas y el portal del
paciente. No necesita contraseñas: emite los tokens con `crear_token`.

Uso (desde la raíz del repo, con el backend levantado):

    venv\\Scripts\\python.exe scripts/pruebas_local.py
    venv\\Scripts\\python.exe scripts/pruebas_local.py https://appbna.onrender.com

Solo lee datos, salvo las citas de prueba que crea y borra al terminar.
"""

from __future__ import annotations

import json
import random
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Optional

# Permite ejecutar el script desde cualquier carpeta del repo.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import supabase  # noqa: E402
from app.core.security import crear_token  # noqa: E402

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8001").rstrip("/")
API = f"{BASE}/api/v1"

fallos: list[str] = []


def token(
    rol: str, username: str, paciente_id: Optional[str] = None, cedula: str = ""
) -> str:
    return crear_token(
        {
            "tipo": "paciente" if paciente_id else "staff",
            "rol": rol,
            "username": username,
            "personal_id": None,
            "paciente_id": paciente_id,
            "cedula": cedula,
        }
    )


def pedir(
    metodo: str, ruta: str, tk: Optional[str] = None, cuerpo: Any = None
) -> tuple[int, Any]:
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    cabeceras = {"Content-Type": "application/json"}
    if tk:
        cabeceras["Authorization"] = f"Bearer {tk}"
    req = urllib.request.Request(API + ruta, data=datos, method=metodo, headers=cabeceras)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            texto = res.read().decode()
            return res.status, json.loads(texto) if texto else None
    except urllib.error.HTTPError as error:
        texto = error.read().decode()
        try:
            return error.code, json.loads(texto)
        except ValueError:
            return error.code, texto[:120]


def comprobar(nombre: str, esperado: int, obtenido: int, detalle: str = "") -> None:
    ok = esperado == obtenido
    print(f"{'OK  ' if ok else 'FALLO'} {nombre:<52} {obtenido} (esperado {esperado})")
    if not ok:
        fallos.append(f"{nombre}: {obtenido} en vez de {esperado} {detalle}".strip())


def main() -> int:
    print(f"Backend: {API}\n")

    paciente = (
        supabase.table("historias_clinicas")
        .select("id, cedula")
        .limit(1)
        .execute()
        .data[0]
    )
    especialidad = supabase.table("especialidades").select("id").limit(1).execute().data[0]

    tk_director = token("director", "director")
    tk_admin = token("admin_sistemas", "adrianbello")
    tk_medico = token("medico", "avalera")
    tk_paciente = token("paciente", paciente["cedula"], paciente["id"], paciente["cedula"])

    print("— Público")
    comprobar("GET /health", 200, pedir("GET", "/health")[0])
    comprobar("GET /centros", 200, pedir("GET", "/centros")[0])
    comprobar("GET /especialidades", 200, pedir("GET", "/especialidades")[0])
    comprobar("GET /panel/resumen sin token", 401, pedir("GET", "/panel/resumen")[0])

    print("\n— Panel institucional por rol")
    comprobar("director -> /panel/resumen", 200, pedir("GET", "/panel/resumen", tk_director)[0])
    comprobar("admin_sistemas -> /panel/resumen", 200, pedir("GET", "/panel/resumen", tk_admin)[0])
    comprobar("medico -> /panel/resumen", 403, pedir("GET", "/panel/resumen", tk_medico)[0])
    comprobar("paciente -> /panel/resumen", 403, pedir("GET", "/panel/resumen", tk_paciente)[0])

    print("\n— Soporte técnico (solo admin_sistemas)")
    codigo, estado = pedir("GET", "/soporte/estado", tk_admin)
    comprobar("admin_sistemas -> /soporte/estado", 200, codigo)
    if codigo == 200:
        sincro = estado.get("sincronizacion", {})
        pendientes = [t for t, v in sincro.items() if v is None]
        if pendientes:
            print(f"     aviso: sin sincronizar todavía -> {', '.join(pendientes)}")
    comprobar("director -> /soporte/estado", 403, pedir("GET", "/soporte/estado", tk_director)[0])
    comprobar("admin_sistemas -> /soporte/logs", 200, pedir("GET", "/soporte/logs", tk_admin)[0])
    comprobar("admin_sistemas -> /soporte/nomina", 200, pedir("GET", "/soporte/nomina", tk_admin)[0])
    comprobar(
        "admin_sistemas -> /soporte/usuarios-internos",
        200,
        pedir("GET", "/soporte/usuarios-internos", tk_admin)[0],
    )

    print("\n— Cuentas institucionales")
    comprobar("admin_sistemas -> /usuarios", 200, pedir("GET", "/usuarios", tk_admin)[0])
    comprobar("director -> /usuarios", 403, pedir("GET", "/usuarios", tk_director)[0])

    print("\n— Portal del paciente")
    codigo, mias = pedir("GET", "/citas/mis-citas", tk_paciente)
    comprobar("paciente -> /citas/mis-citas", 200, codigo)
    if codigo == 200:
        ajenas = [c for c in mias if c.get("paciente_id") not in (None, paciente["id"])]
        comprobar("mis-citas solo devuelve citas propias", 0, len(ajenas))
    comprobar("paciente -> /citas?cedula=ajena", 403, pedir("GET", "/citas?cedula=00000000", tk_paciente)[0])
    comprobar("paciente -> /pacientes/{cedula} de otro", 403, pedir(
        "GET", "/pacientes/00000000", tk_paciente
    )[0])

    print("\n— Cupos de citas")
    fecha = (date.today() + timedelta(days=5)).isoformat()
    creadas: list[str] = []

    def crear(hora: str) -> tuple[int, Any]:
        return pedir(
            "POST",
            "/citas",
            tk_medico,
            {
                "centro_id": 2,
                "especialidad_id": especialidad["id"],
                "paciente_id": paciente["id"],
                "fecha_cita": fecha,
                "hora_inicio": hora,
                "motivo": "prueba de humo",
            },
        )

    hora = f"{random.randint(7, 16):02d}:{random.choice(['00', '30'])}:00"
    codigo, cita = crear(hora)
    for _ in range(4):
        if codigo == 201:
            break
        hora = f"{random.randint(7, 16):02d}:{random.choice(['00', '30'])}:00"
        codigo, cita = crear(hora)

    comprobar(f"staff crea cita {hora}", 201, codigo)
    if codigo != 201:
        print(f"     detalle: {cita}")
        return resumen()

    creadas.append(cita["codigo_confirmacion"])
    comprobar("mismo cupo otra vez", 409, crear(hora)[0])

    libre = "16:30:00" if hora != "16:30:00" else "16:00:00"
    codigo, movida = pedir(
        "PATCH", f"/citas/{cita['id']}/posponer", tk_paciente,
        {"nueva_fecha": fecha, "nueva_hora": libre},
    )
    comprobar(f"paciente pospone a {libre}", 200, codigo)

    comprobar(
        "cancelar",
        200,
        pedir("PATCH", f"/citas/{cita['id']}/cancelar", tk_paciente, {"motivo": "humo"})[0],
    )

    codigo, liberada = crear(libre)
    comprobar("re-reservar el cupo cancelado", 201, codigo)
    if codigo == 201:
        creadas.append(liberada["codigo_confirmacion"])

    for codigo_confirmacion in creadas:
        supabase.table("citas").delete().eq(
            "codigo_confirmacion", codigo_confirmacion
        ).execute()
    print(f"\ncitas de prueba borradas: {len(creadas)}")

    return resumen()


def resumen() -> int:
    print()
    if fallos:
        print(f"{len(fallos)} comprobaciones fallaron:")
        for fallo in fallos:
            print(f"  - {fallo}")
        return 1
    print("Todas las comprobaciones pasaron.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
