"""Servicio de WhatsApp via Evolution API.

Cliente HTTP async para enviar mensajes y verificar estado de conexión.
"""
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# URLs base
_base = settings.EVOLUTION_API_URL.rstrip("/")
_headers = {
    "apikey": settings.EVOLUTION_API_KEY,
    "Content-Type": "application/json",
}


async def enviar_mensaje_texto(
    numero: str,
    mensaje: str,
    instance: str | None = None,
) -> dict:
    """Enviar un mensaje de texto por WhatsApp.

    Args:
        numero: Número de teléfono con código de país (ej: 584121234567)
        mensaje: Texto del mensaje
        instance: Nombre de la instancia (usa la por defecto si es None)

    Returns:
        dict con el resultado de la API

    Raises:
        httpx.HTTPError si la request falla
    """
    inst = instance or settings.EVOLUTION_INSTANCE_NAME
    url = f"{_base}/message/sendText/{inst}"

    payload = {
        "number": numero,
        "text": mensaje,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload, headers=_headers)
        resp.raise_for_status()
        return resp.json()


async def verificar_estadoConexion(instance: str | None = None) -> dict:
    """Verificar el estado de conexión de la instancia WhatsApp.

    Returns:
        dict con el estado (ej: {"state": "open", "statusReason": 200})
    """
    inst = instance or settings.EVOLUTION_INSTANCE_NAME
    url = f"{_base}/instance/connectionState/{inst}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers=_headers)
        resp.raise_for_status()
        return resp.json()
