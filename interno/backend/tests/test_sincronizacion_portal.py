"""Descarga de solicitudes web desde Supabase, sin red real.

El bug que cubre: el filtro PostgREST iba como `in.('pendiente','cancelada')`,
que responde 200 con 0 filas. La solicitud nunca se insertaba en la BD local y
recepción no la veía.
"""
import uuid

from app.core.database import AsyncSessionLocal
from app.services import sincronizacion_portal as svc

PACIENTE_ID = str(uuid.uuid4())
CITA_ID = str(uuid.uuid4())
CEDULA = "19000099"


class _Respuesta:
    def __init__(self, datos):
        self.status_code = 200
        self._datos = datos
        self.text = ""

    def json(self):
        return self._datos


class _ClienteFalso:
    """Sustituye a httpx.AsyncClient y captura los params de la consulta de citas."""

    params_citas = None

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, params=None, headers=None):
        if url.endswith("/citas"):
            _ClienteFalso.params_citas = params
            return _Respuesta(
                [
                    {
                        "id": CITA_ID,
                        "paciente_id": PACIENTE_ID,
                        "centro_id": 13,
                        "centro_salud": "CITAB",
                        "especialidad": "Traumatología",
                        "estado": "pendiente",
                        "origen": "cita_web",
                        "motivo": "Dolor de rodilla",
                        "codigo_confirmacion": "CITAB-2099-QA9",
                        "created_at": "2099-01-01T12:00:00+00:00",
                        "fecha_cita": None,
                        "hora_inicio": None,
                    }
                ]
            )
        return _Respuesta(
            [
                {
                    "id": PACIENTE_ID,
                    "cedula": CEDULA,
                    "nombre_completo": "Paciente Web QA",
                    "telefono": "04141234567",
                    "email": "",
                    "direccion": "",
                }
            ]
        )


async def test_sincroniza_solicitud_web(monkeypatch, pg):
    monkeypatch.setattr(svc.httpx, "AsyncClient", _ClienteFalso)

    async with AsyncSessionLocal() as db:
        total = await svc.sincronizar_solicitudes_supabase(db, None)

    assert total == 1
    assert _ClienteFalso.params_citas["estado"] == "in.(pendiente,cancelada)"

    fila = await pg.fetchrow(
        "SELECT centro_id, estado, origen FROM citas WHERE id::text = $1", CITA_ID
    )
    assert dict(fila) == {"centro_id": 13, "estado": "pendiente", "origen": "cita_web"}
