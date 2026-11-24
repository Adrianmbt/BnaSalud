"""Endpoints de WhatsApp: envío de mensajes via Evolution API."""
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.whatsapp import (
    ConfiguracionWhatsappCreate,
    ConfiguracionWhatsappRead,
    ConfiguracionWhatsappUpdate,
    Destinatario,
    EnviarMasivoRequest,
    EnviarMensajeRequest,
    EnvioMasivoResponse,
    EstadoConexionResponse,
    MensajeWhastappResponse,
    QrCodeResponse,
)
from app.services import whatsapp

router = APIRouter(tags=["WhatsApp"])
logger = logging.getLogger(__name__)


async def _registrar_y_enviar(
    db: AsyncSession,
    telefono: str,
    mensaje: str,
    cedula: Optional[str] = None,
    nombre: Optional[str] = None,
    delay: bool = True,
) -> MensajeWhastappResponse:
    """Registra el mensaje en BD, lo envía por Evolution y actualiza el estado."""
    result = await db.execute(
        text("""
            INSERT INTO mensajes_whatsapp
                (destinatario_telefono, destinatario_cedula, destinatario_nombre, mensaje, estado)
            VALUES (:tel, :ced, :nom, :msg, 'PENDIENTE')
            RETURNING id, created_at
        """),
        {"tel": telefono, "ced": cedula, "nom": nombre, "msg": mensaje},
    )
    row = result.mappings().first()
    msg_id = row["id"]
    created_at = row["created_at"]

    try:
        resp = await whatsapp.enviar_mensaje_texto(
            numero=telefono, 
            mensaje=mensaje,
            db=db,
            delay=delay,
            cedula=cedula,
            nombre=nombre,
        )
        evolution_id = resp.get("key", {}).get("id") or resp.get("id")

        await db.execute(
            text("""
                UPDATE mensajes_whatsapp
                SET estado = 'ENVIADO',
                    evolution_message_id = :evo_id,
                    enviado_en = NOW()
                WHERE id = :id
            """),
            {"evo_id": evolution_id, "id": msg_id},
        )
        estado = "ENVIADO"
    except RuntimeError as e:
        # Límite diario alcanzado
        logger.warning(f"Límite diario alcanzado: {e}")
        await db.execute(
            text("""
                UPDATE mensajes_whatsapp
                SET estado = 'RECHAZADO', error_detalle = :error
                WHERE id = :id
            """),
            {"error": str(e), "id": msg_id},
        )
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        logger.error(f"Error enviando mensaje a {telefono}: {e}")
        await db.execute(
            text("""
                UPDATE mensajes_whatsapp
                SET estado = 'FALLIDO', error_detalle = :error
                WHERE id = :id
            """),
            {"error": str(e), "id": msg_id},
        )
        estado = "FALLIDO"
        evolution_id = None
        enviado_en = None
        error_detalle = str(e)
    else:
        enviado_en = datetime.now(timezone.utc)
        error_detalle = None

    return MensajeWhastappResponse(
        id=msg_id,
        destinatario_cedula=cedula,
        destinatario_nombre=nombre,
        destinatario_telefono=telefono,
        mensaje=mensaje,
        estado=estado,
        evolution_message_id=evolution_id,
        error_detalle=error_detalle,
        enviado_en=enviado_en,
        created_at=created_at,
    )


# ============================================================================
# Configuración de WhatsApp por clínica
# ============================================================================

@router.get("/configuracion/{clinica_id}", response_model=ConfiguracionWhatsappRead)
async def obtener_configuracion(
    clinica_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Obtiene la configuración de WhatsApp para una clínica."""
    config = await whatsapp.obtener_configuracion(db, clinica_id)
    if not config:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return ConfiguracionWhatsappRead(**config)


@router.post("/configuracion", response_model=ConfiguracionWhatsappRead, status_code=201)
async def crear_configuracion(
    payload: ConfiguracionWhatsappCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Crea o actualiza la configuración de WhatsApp para una clínica."""
    config = await whatsapp.crear_actualizar_configuracion(
        db,
        clinica_id=payload.clinica_id,
        instance_name=payload.instance_name,
        api_url=payload.api_url,
        api_key=payload.api_key,
        telefono_origen=payload.telefono_origen,
        creado_por=user.get("personal_id"),
    )
    return ConfiguracionWhatsappRead(**config)


@router.patch("/configuracion/{clinica_id}", response_model=ConfiguracionWhatsappRead)
async def actualizar_configuracion(
    clinica_id: int,
    payload: ConfiguracionWhatsappUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Actualiza la configuración de WhatsApp para una clínica."""
    config_actual = await whatsapp.obtener_configuracion(db, clinica_id)
    if not config_actual:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")

    config = await whatsapp.crear_actualizar_configuracion(
        db,
        clinica_id=clinica_id,
        instance_name=payload.instance_name or config_actual["instance_name"],
        api_url=payload.api_url or config_actual["api_url"],
        api_key=payload.api_key or config_actual["api_key"],
        telefono_origen=payload.telefono_origen or config_actual["telefono_origen"],
        creado_por=user.get("personal_id"),
    )
    return ConfiguracionWhatsappRead(**config)


# ============================================================================
# Estado y envío de mensajes
# ============================================================================

@router.get("/estado", response_model=EstadoConexionResponse)
async def estado_conexion():
    """Verificar estado de conexión de WhatsApp."""
    try:
        estado = await whatsapp.verificar_estadoConexion()
        conectado = estado.get("state") == "open"
        return EstadoConexionResponse(
            conectado=conectado,
            estado=estado.get("state"),
            instancia=settings.EVOLUTION_INSTANCE_NAME,
            detalles=estado,
        )
    except Exception as e:
        logger.warning(f"Error consultando Evolution API: {e}")
        return EstadoConexionResponse(
            conectado=False,
            estado="error",
            instancia=settings.EVOLUTION_INSTANCE_NAME,
            detalles={"error": str(e)},
        )


@router.get("/qr", response_model=QrCodeResponse)
async def obtener_qr_code(
    telefono: Optional[str] = Query(None, description="Número de teléfono para vincular por código"),
    reiniciar: bool = Query(False, description="Reiniciar la sesión de la instancia en Docker"),
):
    """Obtener el código QR o código de emparejamiento (Pairing Code) para conectar WhatsApp."""
    try:
        resultado = await whatsapp.obtener_qr_diagnostico(telefono=telefono, reiniciar=reiniciar)
        return QrCodeResponse(
            qr=resultado.get("qr"),
            pairing_code=resultado.get("pairing_code"),
            instancia=settings.EVOLUTION_INSTANCE_NAME,
            error=resultado.get("error"),
        )
    except Exception as e:
        logger.warning(f"Error obteniendo QR o código: {e}")
        return QrCodeResponse(qr=None, pairing_code=None, instancia=settings.EVOLUTION_INSTANCE_NAME, error=str(e))


@router.post("/enviar", response_model=MensajeWhastappResponse)
async def enviar_mensaje(
    req: EnviarMensajeRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Enviar un mensaje individual de WhatsApp con protección anti-ban."""
    resultado = await _registrar_y_enviar(
        db, req.telefono, req.mensaje, cedula=req.cedula, delay=False
    )
    await db.commit()

    if resultado.estado == "FALLIDO":
        raise HTTPException(status_code=502, detail=f"Error enviando mensaje: {resultado.error_detalle}")

    return resultado


@router.post("/enviar-masivo", response_model=EnvioMasivoResponse)
async def enviar_masivo(
    req: EnviarMasivoRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Enviar mensaje a múltiples destinatarios con delays aleatorios."""
    mensajes_resp = []
    enviados = 0
    fallidos = 0

    for d in req.destinatarios:
        try:
            resultado = await _registrar_y_enviar(
                db, d.telefono, req.mensaje, cedula=d.cedula, nombre=d.nombre, delay=True
            )
            mensajes_resp.append(resultado)
            if resultado.estado == "ENVIADO":
                enviados += 1
            else:
                fallidos += 1
        except HTTPException as e:
            # Límite diario alcanzado, detener envío
            if e.status_code == 429:
                fallidos += len(req.destinatarios) - len(mensajes_resp)
                break
            raise

    await db.commit()

    return EnvioMasivoResponse(
        total=len(req.destinatarios),
        enviados=enviados,
        fallidos=fallidos,
        mensajes=mensajes_resp,
    )


@router.get("/mensajes", response_model=list[MensajeWhastappResponse])
async def listar_mensajes(
    estado: Optional[str] = Query(None, description="Filtrar por estado"),
    cedula: Optional[str] = Query(None, description="Filtrar por cédula"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Historial de mensajes enviados por WhatsApp."""
    conditions = []
    params = {}

    if estado:
        conditions.append("estado = :estado")
        params["estado"] = estado
    if cedula:
        conditions.append("destinatario_cedula = :ced")
        params["ced"] = cedula

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    offset = (page - 1) * limit
    params["limit"] = limit
    params["offset"] = offset

    result = await db.execute(
        text(f"""
            SELECT id, destinatario_cedula, destinatario_nombre,
                   destinatario_telefono, mensaje, estado,
                   evolution_message_id, error_detalle, enviado_en, created_at
            FROM mensajes_whatsapp
            {where}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    rows = result.mappings().all()

    return [
        MensajeWhastappResponse(
            id=r["id"],
            destinatario_cedula=r["destinatario_cedula"],
            destinatario_nombre=r["destinatario_nombre"],
            destinatario_telefono=r["destinatario_telefono"],
            mensaje=r["mensaje"],
            estado=r["estado"],
            evolution_message_id=r["evolution_message_id"],
            error_detalle=r["error_detalle"],
            enviado_en=r["enviado_en"],
            created_at=r["created_at"],
        )
        for r in rows
    ]


@router.get("/estadisticas")
async def estadisticas_diarias(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Estadísticas de mensajes enviados hoy."""
    resultado = await db.execute(
        text("""
            SELECT 
                count(*) AS total,
                count(*) FILTER (WHERE estado = 'ENVIADO') AS enviados,
                count(*) FILTER (WHERE estado = 'FALLIDO') AS fallidos,
                count(*) FILTER (WHERE estado = 'PENDIENTE') AS pendientes
            FROM mensajes_whatsapp
            WHERE DATE(created_at) = CURRENT_DATE
        """)
    )
    fila = resultado.mappings().first()
    
    return {
        "fecha": datetime.now().strftime("%Y-%m-%d"),
        "total": fila["total"] or 0,
        "enviados": fila["enviados"] or 0,
        "fallidos": fila["fallidos"] or 0,
        "pendientes": fila["pendientes"] or 0,
        "limite_diario": whatsapp.MAXIMO_MENSAJES_DIARIOS,
        "disponibles": max(0, whatsapp.MAXIMO_MENSAJES_DIARIOS - (fila["enviados"] or 0)),
    }
