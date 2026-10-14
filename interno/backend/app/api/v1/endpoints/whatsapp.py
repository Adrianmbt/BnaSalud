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
from app.schemas.whatsapp import (
    Destinatario,
    EnviarMasivoRequest,
    EnviarMensajeRequest,
    EnvioMasivoResponse,
    EstadoConexionResponse,
    MensajeWhastappResponse,
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
        resp = await whatsapp.enviar_mensaje_texto(numero=telefono, mensaje=mensaje)
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


@router.post("/enviar", response_model=MensajeWhastappResponse)
async def enviar_mensaje(
    req: EnviarMensajeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Enviar un mensaje individual de WhatsApp."""
    resultado = await _registrar_y_enviar(
        db, req.telefono, req.mensaje, cedula=req.cedula
    )
    await db.commit()

    if resultado.estado == "FALLIDO":
        raise HTTPException(status_code=502, detail=f"Error enviando mensaje: {resultado.error_detalle}")

    return resultado


@router.post("/enviar-masivo", response_model=EnvioMasivoResponse)
async def enviar_masivo(
    req: EnviarMasivoRequest,
    db: AsyncSession = Depends(get_db),
):
    """Enviar mensaje a múltiples destinatarios."""
    mensajes = [
        await _registrar_y_enviar(db, d.telefono, req.mensaje, cedula=d.cedula, nombre=d.nombre)
        for d in req.destinatarios
    ]
    await db.commit()

    enviados = sum(1 for m in mensajes if m.estado == "ENVIADO")
    fallidos = sum(1 for m in mensajes if m.estado == "FALLIDO")

    return EnvioMasivoResponse(
        total=len(req.destinatarios),
        enviados=enviados,
        fallidos=fallidos,
        mensajes=mensajes,
    )


@router.get("/mensajes", response_model=list[MensajeWhastappResponse])
async def listar_mensajes(
    estado: Optional[str] = Query(None, description="Filtrar por estado"),
    cedula: Optional[str] = Query(None, description="Filtrar por cédula"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
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
