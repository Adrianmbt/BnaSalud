"""Servicio de WhatsApp via Evolution API.

Cliente HTTP async para enviar mensajes y verificar estado de conexión.
Incluye protecciones anti-ban: delays aleatorios, límites diarios y cola de envío.
"""
import asyncio
import logging
import random
from datetime import date
from typing import Optional

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)

# Configuración anti-ban
DELAY_MINIMO_SEGUNDOS = 2
DELAY_MAXIMO_SEGUNDOS = 4
MAXIMO_MENSAJES_DIARIOS = 100


def _get_base_url() -> str:
    return settings.EVOLUTION_API_URL.rstrip("/")


def _get_headers() -> dict:
    return {
        "apikey": settings.EVOLUTION_API_KEY or "Bn@Salud2026!Ev0lut1on",
        "Content-Type": "application/json",
    }


async def _obtener_contador_diario(db: AsyncSession) -> int:
    """Obtiene el número de mensajes enviados hoy."""
    resultado = await db.execute(
        text(
            "SELECT count(*) FROM mensajes_whatsapp "
            "WHERE DATE(created_at) = CURRENT_DATE AND estado = 'ENVIADO'"
        )
    )
    return resultado.scalar_one() or 0


async def _registrar_mensaje(
    db: AsyncSession,
    telefono: str,
    mensaje: str,
    estado: str,
    evolution_id: Optional[str] = None,
    error: Optional[str] = None,
    cedula: Optional[str] = None,
    nombre: Optional[str] = None,
) -> None:
    """Registra el mensaje en la tabla mensajes_whatsapp."""
    await db.execute(
        text(
            "INSERT INTO mensajes_whatsapp "
            "(destinatario_telefono, destinatario_cedula, destinatario_nombre, "
            "mensaje, estado, evolution_message_id, error_detalle, enviado_en) "
            "VALUES (:tel, :ced, :nom, :msg, :est, :eid, :err, CASE WHEN :est = 'ENVIADO' THEN now() ELSE NULL END)"
        ),
        {
            "tel": telefono,
            "ced": cedula,
            "nom": nombre,
            "msg": mensaje,
            "est": estado,
            "eid": evolution_id,
            "err": error,
        },
    )
    await db.commit()


async def enviar_mensaje_texto(
    numero: str,
    mensaje: str,
    instance: str | None = None,
    db: AsyncSession | None = None,
    delay: bool = True,
    cedula: Optional[str] = None,
    nombre: Optional[str] = None,
) -> dict:
    """Enviar un mensaje de texto por WhatsApp con protección anti-ban.

    Args:
        numero: Número de teléfono con código de país (ej: 584121234567)
        mensaje: Texto del mensaje
        instance: Nombre de la instancia (usa la por defecto si es None)
        db: Sesión de base de datos (para registrar y validar límites)
        delay: Si True, aplica delay aleatorio antes de enviar
        cedula: Cédula del destinatario (para registro)
        nombre: Nombre del destinatario (para registro)

    Returns:
        dict con el resultado de la API

    Raises:
        RuntimeError si se excede el límite diario
        httpx.HTTPError si la request falla
    """
    # Verificar límite diario
    if db:
        contador = await _obtener_contador_diario(db)
        if contador >= MAXIMO_MENSAJES_DIARIOS:
            raise RuntimeError(
                f"Límite diario alcanzado ({MAXIMO_MENSAJES_DIARIOS} mensajes/día). "
                "Intente mañana o contacte al administrador."
            )

    # Aplicar delay aleatorio para evitar detección de automatización
    if delay:
        segundos = random.randint(DELAY_MINIMO_SEGUNDOS, DELAY_MAXIMO_SEGUNDOS)
        logger.info(f"Esperando {segundos}s antes de enviar a {numero}...")
        await asyncio.sleep(segundos)

    inst = instance or settings.EVOLUTION_INSTANCE_NAME
    url = f"{_get_base_url()}/message/sendText/{inst}"

    payload = {
        "number": numero,
        "text": mensaje,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=_get_headers())
            resp.raise_for_status()
            resultado = resp.json()

        # Registrar éxito
        if db:
            await _registrar_mensaje(
                db, numero, mensaje, "ENVIADO",
                evolution_id=resultado.get("messageId"),
                cedula=cedula, nombre=nombre
            )

        logger.info(f"Mensaje enviado a {numero}: {resultado.get('messageId', 'OK')}")
        return resultado

    except Exception as err:
        # Registrar error
        if db:
            await _registrar_mensaje(
                db, numero, mensaje, "ERROR",
                error=str(err), cedula=cedula, nombre=nombre
            )
        logger.error(f"Error enviando a {numero}: {err}")
        raise


async def enviar_mensaje_cola(
    mensajes: list[dict],
    db: AsyncSession,
    instance: str | None = None,
) -> dict:
    """Envía múltiples mensajes con delays aleatorios y validación de límites.

    Args:
        mensajes: Lista de dicts con {telefono, mensaje, cedula?, nombre?}
        db: Sesión de base de datos
        instance: Nombre de la instancia

    Returns:
        dict con {total, enviados, fallidos, errores}
    """
    total = len(mensajes)
    enviados = 0
    fallidos = 0
    errores = []

    for i, msg in enumerate(mensajes, 1):
        try:
            await enviar_mensaje_texto(
                numero=msg["telefono"],
                mensaje=msg["mensaje"],
                instance=instance,
                db=db,
                delay=True,
                cedula=msg.get("cedula"),
                nombre=msg.get("nombre"),
            )
            enviados += 1
            logger.info(f"Progreso: {i}/{total} enviados")

        except RuntimeError as e:
            # Límite diario alcanzado
            errores.append({"telefono": msg["telefono"], "error": str(e)})
            fallidos = total - i + 1
            break

        except Exception as e:
            fallidos += 1
            errores.append({"telefono": msg["telefono"], "error": str(e)})
            logger.error(f"Error en mensaje {i}: {e}")

    return {
        "total": total,
        "enviados": enviados,
        "fallidos": fallidos,
        "errores": errores,
    }


async def crear_instancia(instance: str | None = None) -> dict:
    """Crea la instancia en Evolution API si no existe."""
    inst = instance or settings.EVOLUTION_INSTANCE_NAME
    url = f"{_get_base_url()}/instance/create"
    payload = {
        "instanceName": inst,
        "token": getattr(settings, "EVOLUTION_INSTANCE_TOKEN", "") or "",
        "qrcode": True,
        "integration": "WHATSAPP-BAILEYS",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, json=payload, headers=_get_headers())
        if resp.status_code in (200, 201):
            return resp.json()
        elif resp.status_code in (400, 403):
            return {"status": "exists", "detail": resp.text}
        resp.raise_for_status()
        return resp.json()


async def verificar_estadoConexion(instance: str | None = None) -> dict:
    """Verificar el estado de conexión de la instancia WhatsApp.

    Returns:
        dict con el estado (ej: {"state": "open", "statusReason": 200})
    """
    inst = instance or settings.EVOLUTION_INSTANCE_NAME
    url = f"{_get_base_url()}/instance/connectionState/{inst}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=_get_headers())
            if resp.status_code == 404:
                return {"state": "not_created", "statusReason": 404}
            resp.raise_for_status()
            data = resp.json()
            state = data.get("state")
            if not state and isinstance(data.get("instance"), dict):
                state = data.get("instance", {}).get("state")
            return {"state": state or "close", "raw": data}
    except Exception as e:
        logger.warning(f"Error verificando conexión en Evolution: {e}")
        return {"state": "error", "error": str(e)}


def _normalizar_qr(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    val = str(raw).strip()
    if val.startswith("data:image"):
        return val
    # Si viene en base64 puro
    if len(val) > 100 and not val.startswith("http"):
        return f"data:image/png;base64,{val}"
    return val


def _normalizar_numero(telefono: str) -> str:
    """Normaliza un número venezolano al formato E.164 sin el '+'."""
    limpio = "".join(c for c in str(telefono) if c.isdigit())
    if limpio.startswith("58") and len(limpio) >= 11:
        return limpio
    if limpio.startswith("0") and len(limpio) == 11:
        return f"58{limpio[1:]}"
    if len(limpio) == 10 and not limpio.startswith("0"):
        return f"58{limpio}"
    return limpio


async def obtener_qr_diagnostico(
    instance: str | None = None,
    telefono: str | None = None,
    reiniciar: bool = False,
) -> dict:
    """Obtener el código QR o código de emparejamiento (Pairing Code) para WhatsApp."""
    inst = instance or settings.EVOLUTION_INSTANCE_NAME
    base_url = _get_base_url()
    headers = _get_headers()

    async with httpx.AsyncClient(timeout=20.0) as client:
        # 0. Si se solicita reiniciar la instancia en Docker
        if reiniciar:
            try:
                await client.delete(f"{base_url}/instance/delete/{inst}", headers=headers)
                await asyncio.sleep(1.0)
            except Exception as e:
                logger.warning(f"Error borrando instancia para reiniciar: {e}")

        # 1. Probar conectividad con Evolution API
        try:
            ping_resp = await client.get(f"{base_url}/instance/fetchInstances", headers=headers)
            if ping_resp.status_code in (401, 403):
                return {
                    "qr": None,
                    "pairing_code": None,
                    "error": f"Autenticación fallida con Evolution API (código {ping_resp.status_code}). Verifica que EVOLUTION_API_KEY coincida.",
                    "conectado": False,
                }
        except httpx.ConnectError:
            return {
                "qr": None,
                "pairing_code": None,
                "error": f"No se pudo conectar a Evolution API en {base_url}. Verifica que el contenedor de Docker esté activo.",
                "conectado": False,
            }
        except Exception as e:
            return {
                "qr": None,
                "pairing_code": None,
                "error": f"Error de comunicación con Evolution API: {str(e)}",
                "conectado": False,
            }

        # 2. Verificar si la instancia ya está conectada
        try:
            st_resp = await client.get(f"{base_url}/instance/connectionState/{inst}", headers=headers)
            if st_resp.status_code == 200:
                sdata = st_resp.json()
                st = sdata.get("state") or (sdata.get("instance", {}).get("state") if isinstance(sdata.get("instance"), dict) else None)
                if st == "open":
                    return {"qr": None, "pairing_code": None, "error": "already_connected", "conectado": True}
        except Exception:
            pass

        # 3. Caso: Vinculación con Código Telefónico (Pairing Code - 8 dígitos)
        if telefono and telefono.strip():
            num = _normalizar_numero(telefono)
            # Primero eliminamos cualquier instancia previa atascada o creada sin número
            try:
                await client.delete(f"{base_url}/instance/delete/{inst}", headers=headers)
                await asyncio.sleep(0.5)
            except Exception:
                pass

            # Crear la instancia indicando el número de teléfono para que Baileys active pairingCode
            create_payload = {
                "instanceName": inst,
                "qrcode": False,
                "number": num,
                "integration": "WHATSAPP-BAILEYS",
            }
            try:
                resp_create = await client.post(f"{base_url}/instance/create", json=create_payload, headers=headers)
                if resp_create.status_code in (200, 201):
                    crdata = resp_create.json()
                    pcode = (
                        crdata.get("pairingCode")
                        or (crdata.get("qrcode", {}).get("pairingCode") if isinstance(crdata.get("qrcode"), dict) else None)
                        or (crdata.get("code") if len(str(crdata.get("code", ""))) <= 12 else None)
                    )
                    if pcode:
                        return {"qr": None, "pairing_code": str(pcode), "error": None, "conectado": False}
            except Exception as e:
                logger.warning(f"Error creando instancia para pairing: {e}")

            # Si no vino en create, solicitar /instance/connect?number={num}
            url_connect_num = f"{base_url}/instance/connect/{inst}?number={num}"
            try:
                resp_num = await client.get(url_connect_num, headers=headers)
                if resp_num.status_code == 200:
                    pdata = resp_num.json()
                    pcode = (
                        pdata.get("pairingCode")
                        or (pdata.get("qrcode", {}).get("pairingCode") if isinstance(pdata.get("qrcode"), dict) else None)
                        or (pdata.get("code") if len(str(pdata.get("code", ""))) <= 12 else None)
                    )
                    if pcode:
                        return {"qr": None, "pairing_code": str(pcode), "error": None, "conectado": False}
                    return {
                        "qr": None,
                        "pairing_code": None,
                        "error": f"Evolution devolvió: {str(pdata)[:160]}",
                        "conectado": False,
                    }
                else:
                    return {
                        "qr": None,
                        "pairing_code": None,
                        "error": f"Error conectando con Evolution ({resp_num.status_code}): {resp_num.text[:200]}",
                        "conectado": False,
                    }
            except Exception as e:
                return {
                    "qr": None,
                    "pairing_code": None,
                    "error": f"Error conectando con número {num}: {str(e)}",
                    "conectado": False,
                }

        # 4. Caso: Código QR
        url_connect = f"{base_url}/instance/connect/{inst}"
        try:
            resp_connect = await client.get(url_connect, headers=headers)
            if resp_connect.status_code == 200:
                cdata = resp_connect.json()
                qr = cdata.get("base64")
                if not qr and isinstance(cdata.get("qrcode"), dict):
                    qr = cdata.get("qrcode", {}).get("base64")
                elif not qr:
                    qr = cdata.get("qrcode") or cdata.get("code")
                pcode = cdata.get("pairingCode") or (cdata.get("qrcode", {}).get("pairingCode") if isinstance(cdata.get("qrcode"), dict) else None)
                if qr or pcode:
                    return {
                        "qr": _normalizar_qr(qr) if qr else None,
                        "pairing_code": str(pcode) if pcode else None,
                        "error": None,
                        "conectado": False,
                    }
        except Exception as e:
            logger.warning(f"Error conectando a instancia existente: {e}")

        # 5. Crear la instancia si no existe
        url_create = f"{base_url}/instance/create"
        payload = {
            "instanceName": inst,
            "qrcode": True,
            "integration": "WHATSAPP-BAILEYS",
        }

        ultimo_error = None
        try:
            resp_create = await client.post(url_create, json=payload, headers=headers)
            if resp_create.status_code in (200, 201):
                crdata = resp_create.json()
                qr = crdata.get("base64")
                if not qr and isinstance(crdata.get("qrcode"), dict):
                    qr = crdata.get("qrcode", {}).get("base64")
                elif not qr:
                    qr = crdata.get("qrcode") or crdata.get("code")
                pcode = crdata.get("pairingCode") or (crdata.get("qrcode", {}).get("pairingCode") if isinstance(crdata.get("qrcode"), dict) else None)
                if qr or pcode:
                    return {
                        "qr": _normalizar_qr(qr) if qr else None,
                        "pairing_code": str(pcode) if pcode else None,
                        "error": None,
                        "conectado": False,
                    }
            elif resp_create.status_code not in (400, 403):
                ultimo_error = f"Error creando instancia ({resp_create.status_code}): {resp_create.text[:200]}"
        except Exception as e:
            ultimo_error = f"Excepción creando instancia: {str(e)}"

        # 6. Reintento a /instance/connect tras creación
        try:
            resp_retry = await client.get(url_connect, headers=headers)
            if resp_retry.status_code == 200:
                rdata = resp_retry.json()
                qr = rdata.get("base64")
                if not qr and isinstance(rdata.get("qrcode"), dict):
                    qr = rdata.get("qrcode", {}).get("base64")
                elif not qr:
                    qr = rdata.get("qrcode") or rdata.get("code")
                pcode = rdata.get("pairingCode") or (rdata.get("qrcode", {}).get("pairingCode") if isinstance(rdata.get("qrcode"), dict) else None)
                if qr or pcode:
                    return {
                        "qr": _normalizar_qr(qr) if qr else None,
                        "pairing_code": str(pcode) if pcode else None,
                        "error": None,
                        "conectado": False,
                    }
                else:
                    ultimo_error = f"Evolution devolvió respuesta sin QR: {str(rdata)[:150]}"
            else:
                ultimo_error = f"Evolution /instance/connect devolvió código {resp_retry.status_code}: {resp_retry.text[:200]}"
        except Exception as e:
            ultimo_error = f"Error al reintentar connect: {str(e)}"

        return {
            "qr": None,
            "pairing_code": None,
            "error": ultimo_error or "Evolution API respondió pero no generó código QR.",
            "conectado": False,
        }


async def obtener_qr(instance: str | None = None) -> Optional[str]:
    """Obtener el código QR como string para compatibilidad."""
    resultado = await obtener_qr_diagnostico(instance)
    return resultado.get("qr")


async def obtener_configuracion(db: AsyncSession, clinica_id: int) -> Optional[dict]:
    """Obtiene la configuración de WhatsApp para una clínica."""
    resultado = await db.execute(
        text(
            "SELECT id, clinica_id, instance_name, api_url, api_key, telefono_origen, activo "
            "FROM configuracion_whatsapp WHERE clinica_id = :cid AND activo = TRUE"
        ),
        {"cid": clinica_id},
    )
    fila = resultado.mappings().first()
    return dict(fila) if fila else None


async def crear_actualizar_configuracion(
    db: AsyncSession,
    clinica_id: int,
    instance_name: str,
    api_url: str,
    api_key: str,
    telefono_origen: str,
    creado_por: Optional[int] = None,
) -> dict:
    """Crea o actualiza la configuración de WhatsApp para una clínica."""
    await db.execute(
        text(
            "INSERT INTO configuracion_whatsapp "
            "(clinica_id, instance_name, api_url, api_key, telefono_origen, creado_por) "
            "VALUES (:cid, :inst, :url, :key, :tel, :creador) "
            "ON CONFLICT (clinica_id) DO UPDATE SET "
            "instance_name = EXCLUDED.instance_name, "
            "api_url = EXCLUDED.api_url, "
            "api_key = EXCLUDED.api_key, "
            "telefono_origen = EXCLUDED.telefono_origen, "
            "updated_at = now() "
            "RETURNING *"
        ),
        {
            "cid": clinica_id,
            "inst": instance_name,
            "url": api_url,
            "key": api_key,
            "tel": telefono_origen,
            "creador": creado_por,
        },
    )
    await db.commit()
    return await obtener_configuracion(db, clinica_id)
