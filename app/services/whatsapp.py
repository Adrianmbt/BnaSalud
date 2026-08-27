"""Servicio de notificaciones por WhatsApp vía Green API.

Envía mensajes transaccionales (bienvenida, PIN, cita confirmada) al
paciente al número registrado en historias_clinicas.telefono.

Si GREEN_API_TOKEN no está configurado, el servicio funciona en modo
demo (devuelve False sin lanzar error) para que el flujo no se rompa.
"""
from __future__ import annotations

import httpx

from app.core.config import settings


def _chat_id(telefono: str) -> str:
    """Convierte un teléfono venezolano a chatId de WhatsApp (c.us)."""
    limpio = telefono.replace("+", "").replace(" ", "").replace("-", "")
    if not limpio.endswith("@c.us"):
        limpio = f"{limpio}@c.us"
    return limpio


async def enviar_mensaje(telefono: str, mensaje: str) -> bool:
    """Envía un mensaje de texto por WhatsApp via Green API.

    Devuelve True si se envió correctamente, False en modo demo o si falla.
    """
    if not settings.GREEN_API_TOKEN or not settings.GREEN_API_INSTANCE:
        return False

    url = (
        f"{settings.GREEN_API_URL}"
        f"/waInstance{settings.GREEN_API_INSTANCE}"
        f"/sendMessage/{settings.GREEN_API_TOKEN}"
    )

    payload = {
        "chatId": _chat_id(telefono),
        "message": mensaje,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=15.0)
            return response.status_code == 200
    except Exception:
        return False


async def enviar_bienvenida_cita(
    telefono: str,
    nombre: str,
    cedula: str,
    pin: str,
    centro: str,
    especialidad: str,
    fecha: str,
    hora: str,
    codigo_confirmacion: str,
) -> bool:
    """Envía el mensaje de bienvenida con datos de acceso y cita."""
    mensaje = (
        f"*¡Cita Registrada!*\n"
        f"Hola {nombre}, tu cita en *{centro}* fue agendada.\n\n"
        f"*Centro:* {centro}\n"
        f"*Especialidad:* {especialidad}\n"
        f"*Fecha:* {fecha}\n"
        f"*Hora:* {hora}\n"
        f"*Código:* {codigo_confirmacion}\n\n"
        f"---\n"
        f"*Datos de acceso al portal:*\n"
        f"Cédula: {cedula}\n"
        f"PIN: {pin}\n\n"
        f"Usa estos datos en *bnasalud.gob.ve/paciente* para consultar "
        f"tus citas, recetas y resultados.\n\n"
        f"_Guarda este PIN. Nadie de BNA Salud te lo pedirá por teléfono._"
    )
    return await enviar_mensaje(telefono, mensaje)
