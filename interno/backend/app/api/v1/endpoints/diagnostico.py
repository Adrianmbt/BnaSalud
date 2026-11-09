"""Endpoints de diagnóstico para sincronización con el portal web (Supabase).

Este router no requiere autenticación: solo sirve para verificar que las citas
creadas en el portal web llegan al sistema interno.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.core.config import settings
from app.core.database import get_db
from app.services import sincronizacion_portal as svc

router = APIRouter()


def _headers() -> dict:
    return {
        "apikey": settings.SUPABASE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


@router.get(
    "/sincronizar-citas-web",
    summary="Fuerza la sincronización de solicitudes de cita web desde Supabase",
)
async def sincronizar_citas_web(
    centro_id: Optional[int] = Query(
        None, description="ID del centro; si se omite usa CLINICA_ID del entorno"
    ),
    db: AsyncSession = Depends(get_db),
):
    """Fuerza la descarga de citas pendientes desde Supabase (portal web) a la BD local."""
    cid = centro_id if centro_id is not None else settings.id_centro

    resultado = {
        "sincronizadas": 0,
        "centro_id_usado": cid,
        "clinica_id_configurado": settings.id_centro,
        "citas_web_en_supabase": 0,
        "detalle_citas_web": [],
        "error_supabase": None,
        "error_sincronizacion": None,
    }

    # 1. Consultar directamente a Supabase
    base_url = settings.SUPABASE_URL.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            params = {
                "estado": "eq.pendiente",
                "origen": "eq.cita_web",
                "select": "*,paciente_id,centro_id,centro_salud,especialidad,motivo,codigo_confirmacion,created_at",
                "order": "created_at.desc",
            }
            resp = await client.get(
                f"{base_url}/rest/v1/citas", params=params, headers=_headers()
            )
            if resp.status_code == 200:
                citas_supabase = resp.json() or []
                resultado["citas_web_en_supabase"] = len(citas_supabase)
                resultado["detalle_citas_web"] = [
                    {
                        "id": c.get("id"),
                        "codigo_confirmacion": c.get("codigo_confirmacion"),
                        "centro_id": c.get("centro_id"),
                        "centro_salud": c.get("centro_salud"),
                        "especialidad": c.get("especialidad"),
                        "estado": c.get("estado"),
                        "origen": c.get("origen"),
                        "paciente_id": c.get("paciente_id"),
                        "fecha_cita": c.get("fecha_cita"),
                        "hora_inicio": c.get("hora_inicio"),
                    }
                    for c in citas_supabase
                ]
            else:
                resultado["error_supabase"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        resultado["error_supabase"] = str(e)

    # 2. Sincronizar a BD local
    try:
        n = await svc.sincronizar_solicitudes_supabase(db, cid)
        resultado["sincronizadas"] = n
    except Exception as e:
        resultado["error_sincronizacion"] = str(e)

    return resultado
