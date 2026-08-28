"""Servicio de notificaciones por WhatsApp vía Evolution API.

Envía mensajes transaccionales (bienvenida, PIN, cita confirmada) al
paciente al número registrado en historias_clinicas.telefono.

Si EVOLUTION_API_KEY no está configurado, el servicio funciona en modo
demo (devuelve False sin lanzar error) para que el flujo no se rompa.

Migrado de Green API a Evolution API v2.1.1.
El builder de mensajes y el modo demo se mantienen sin cambios.
"""
from __future__ import annotations

import httpx

from app.core.config import settings


def evolution_habilitado() -> bool:
    """True si Evolution API está configurada (URL + clave + instancia)."""
    return bool(settings.EVOLUTION_API_KEY and settings.EVOLUTION_INSTANCE_NAME)


def _normalizar_numero(telefono: str) -> str:
    """Normaliza un número venezolano al formato E.164 sin el '+'.

    Evolution API acepta el número sin '@c.us', en formato internacional.
    Ejemplo: '04141234567' → '584141234567'
    """
    limpio = telefono.replace("+", "").replace(" ", "").replace("-", "")
    # Si ya empieza con 58 (Venezuela) y tiene 11+ dígitos, lo dejamos
    if limpio.startswith("58") and len(limpio) >= 11:
        return limpio
    # Número local venezolano: 04XX... → 584XX...
    if limpio.startswith("0") and len(limpio) == 11:
        return f"58{limpio[1:]}"
    # Número de 10 dígitos sin prefijo 0
    if len(limpio) == 10 and not limpio.startswith("0"):
        return f"58{limpio}"
    return limpio


async def enviar_mensaje(telefono: str, mensaje: str) -> bool:
    """Envía un mensaje de texto por WhatsApp via Evolution API.

    Devuelve True si se envió correctamente, False en modo demo o si falla.
    Usa httpx.AsyncClient para no bloquear el event loop de FastAPI.
    """
    if not settings.EVOLUTION_API_KEY or not settings.EVOLUTION_INSTANCE_NAME:
        # Modo demo: la API no está configurada, el flujo continúa sin error
        return False

    numero = _normalizar_numero(telefono)
    url = (
        f"{settings.EVOLUTION_API_URL.rstrip('/')}"
        f"/message/sendText/{settings.EVOLUTION_INSTANCE_NAME}"
    )
    headers = {
        "Content-Type": "application/json",
        "apikey": settings.EVOLUTION_API_KEY,
    }
    # Evolution API v2: body con 'number' (E.164 sin '+') y 'text'
    payload = {
        "number": numero,
        "text": mensaje,
    }

    try:
        async with httpx.AsyncClient() as cliente:
            respuesta = await cliente.post(
                url,
                json=payload,
                headers=headers,
                timeout=15.0,
            )
            # Evolution API devuelve 200 o 201 en éxito
            return respuesta.status_code in (200, 201)
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
    """Envía el mensaje de bienvenida con datos de acceso y cita.

    El contenido del mensaje se mantiene idéntico al original.
    """
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


def mensaje_recordatorio(
    nombre: str, fecha_larga: str, hora: str, centro: str, especialidad: str
) -> str:
    """Texto del recordatorio de cita ~24 horas antes (Fase 5, canal WhatsApp)."""
    return (
        f"*Recordatorio de cita — BNA Salud*\n"
        f"Hola {nombre},\n"
        f"Mañana tienes tu cita médica:\n\n"
        f"*Fecha:* {fecha_larga}\n"
        f"*Hora:* {hora}\n"
        f"*Especialidad:* {especialidad}\n"
        f"*Centro:* {centro}\n\n"
        f"Llega 15 minutos antes con tu cédula. Si no puedes asistir, "
        f"cancela o reprograma desde *bnasalud.gob.ve/paciente*."
    )


async def enviar_recordatorio_whatsapp(
    telefono: str,
    nombre: str,
    fecha_larga: str,
    hora: str,
    centro: str,
    especialidad: str,
) -> bool:
    """Envía el recordatorio de cita por WhatsApp (tarea programada)."""
    return await enviar_mensaje(
        telefono,
        mensaje_recordatorio(nombre, fecha_larga, hora, centro, especialidad),
    )


async def enviar_notificacion_postergacion(
    telefono: str,
    nombre: str,
    centro: str,
    especialidad: str,
    nueva_fecha: str,
    nueva_hora: str,
    codigo_confirmacion: str,
) -> bool:
    """Notifica al paciente que su cita fue reprogramada exitosamente."""
    mensaje = (
        f"*Cita Reprogramada ✅*\n"
        f"Hola {nombre}, tu cita en *{centro}* fue actualizada.\n\n"
        f"*Centro:* {centro}\n"
        f"*Especialidad:* {especialidad}\n"
        f"*Nueva Fecha:* {nueva_fecha}\n"
        f"*Nueva Hora:* {nueva_hora}\n"
        f"*Código:* {codigo_confirmacion}\n\n"
        f"Si tienes dudas, visita *bnasalud.gob.ve/paciente*."
    )
    return await enviar_mensaje(telefono, mensaje)


async def enviar_notificacion_cancelacion(
    telefono: str,
    nombre: str,
    centro: str,
    especialidad: str,
    fecha: str,
    hora: str,
    codigo_confirmacion: str,
) -> bool:
    """Notifica al paciente que su cita fue cancelada por él o por el personal."""
    mensaje = (
        f"*Cita Cancelada*\n"
        f"Hola {nombre}, tu cita en *{centro}* fue cancelada.\n\n"
        f"*Especialidad:* {especialidad}\n"
        f"*Fecha:* {fecha}\n"
        f"*Hora:* {hora}\n"
        f"*Código:* {codigo_confirmacion}\n\n"
        f"Si deseas reagendar una nueva fecha, visita *bnasalud.gob.ve/paciente*."
    )
    return await enviar_mensaje(telefono, mensaje)
