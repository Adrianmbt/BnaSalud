"""Servicio de sincronización híbrida con el portal público en Supabase.

Permite al sistema interno de la clínica (con su base de datos local `bnasalud`)
leer solicitudes de citas hechas por pacientes en el portal web público (Vercel)
y reportar de vuelta cuando una cita es confirmada o asignada.
"""
import logging
from datetime import datetime
from typing import Optional
import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)


def _headers() -> dict:
    return {
        "apikey": settings.SUPABASE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def sincronizar_solicitudes_supabase(db: AsyncSession, centro_id: Optional[int] = None) -> int:
    """Consulta citas pendientes y canceladas en Supabase y las sincroniza en la BD local.

    Trae citas con origen='cita_web' y estado en ('pendiente', 'cancelada')
    para reflejar tanto las solicitudes activas como las que el paciente
    canceló desde el portal web. Se insertan con su centro_id original y el
    filtro por centro se aplica al leer desde la BD local.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        logger.warning("SUPABASE_URL/SUPABASE_KEY no configuradas; se omite sincronización.")
        return 0

    base_url = settings.SUPABASE_URL.rstrip("/")
    citas_url = f"{base_url}/rest/v1/citas"
    params = {
        "estado": "in.('pendiente','cancelada')",
        "origen": "eq.cita_web",
        "select": "*",
        "order": "created_at.desc",
    }
    if centro_id is not None:
        params["centro_id"] = f"eq.{centro_id}"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(citas_url, params=params, headers=_headers())
            if resp.status_code != 200:
                logger.warning(f"Error consultando Supabase citas: HTTP {resp.status_code} - {resp.text}")
                return 0
            citas_remotas = resp.json() or []
    except Exception as e:
        logger.info(f"Supabase offline o inalcanzable temporalmente: {e}")
        return 0

    if not citas_remotas:
        return 0

    # Recolectar paciente_ids que falten en local
    paciente_ids = {c["paciente_id"] for c in citas_remotas if c.get("paciente_id")}
    pacientes_map = {}

    if paciente_ids:
        try:
            ids_filtro = ",".join(f'"{pid}"' for pid in paciente_ids)
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp_p = await client.get(
                    f"{base_url}/rest/v1/historias_clinicas?id=in.({ids_filtro})&select=*",
                    headers=_headers(),
                )
                if resp_p.status_code == 200:
                    for p in resp_p.json():
                        pacientes_map[str(p["id"])] = p
        except Exception as e:
            logger.warning(f"Error obteniendo historias clínicas de Supabase: {e}")

    sincronizadas = 0

    for c in citas_remotas:
        cid = str(c["id"])
        pid = c.get("paciente_id")
        p_data = pacientes_map.get(str(pid)) if pid else None

        # 1. Asegurar historia clínica local
        local_pid = None
        if p_data:
            cedula = str(p_data.get("cedula") or "").strip()
            nombre = p_data.get("nombre_completo") or "Paciente Web"
            tel = p_data.get("telefono") or ""
            email = p_data.get("email") or ""
            dir_pac = p_data.get("direccion") or ""

            # Buscar si ya existe una historia clínica local con esta cédula
            if cedula:
                existente = (
                    await db.execute(
                        text("SELECT id FROM historias_clinicas WHERE cedula = :ced"),
                        {"ced": cedula},
                    )
                ).mappings().first()
                if existente:
                    local_pid = str(existente["id"])
                    # Actualizar datos si faltan
                    await db.execute(
                        text("""
                            UPDATE historias_clinicas
                            SET nombre_completo = COALESCE(:nombre, nombre_completo),
                                telefono = COALESCE(NULLIF(:telefono, ''), telefono),
                                email = COALESCE(NULLIF(:email, ''), email),
                                direccion = COALESCE(NULLIF(:direccion, ''), direccion)
                            WHERE id = :pid
                        """),
                        {
                            "pid": local_pid,
                            "nombre": nombre,
                            "telefono": tel,
                            "email": email,
                            "direccion": dir_pac,
                        },
                    )
            # Si no existe por cédula, insertar con el id de Supabase
            if not local_pid:
                await db.execute(
                    text("""
                        INSERT INTO historias_clinicas
                            (id, cedula, nombre_completo, telefono, email, direccion, created_at)
                        VALUES
                            (:id, :cedula, :nombre, :telefono, :email, :direccion, NOW())
                        ON CONFLICT (id) DO UPDATE SET
                            nombre_completo = EXCLUDED.nombre_completo,
                            telefono = COALESCE(NULLIF(EXCLUDED.telefono, ''), historias_clinicas.telefono),
                            email = COALESCE(NULLIF(EXCLUDED.email, ''), historias_clinicas.email)
                    """),
                    {
                        "id": pid,
                        "cedula": cedula,
                        "nombre": nombre,
                        "telefono": tel,
                        "email": email,
                        "direccion": dir_pac,
                    },
                )
                local_pid = pid

        # 2. Insertar o actualizar cita en BD local (usa el centro_id remoto; fallback al parametro)
        existe = (
            await db.execute(
                text("SELECT id, estado FROM citas WHERE id::text = :cid"),
                {"cid": cid},
            )
        ).mappings().first()

        estado_remoto = c.get("estado") or "pendiente"

        if not existe:
            await db.execute(
                text("""
                    INSERT INTO citas
                        (id, paciente_id, centro_id, centro_salud, especialidad,
                         motivo, origen, estado, codigo_confirmacion, created_at,
                         fecha_cita, hora_inicio)
                    VALUES
                        (:id, :pid, :centro_id, :centro_salud, :especialidad,
                         :motivo, 'cita_web', :estado_remoto, :codigo, :created_at,
                         :fecha_cita, :hora_inicio)
                    ON CONFLICT (id) DO NOTHING
                """),
                {
                    "id": cid,
                    "pid": local_pid,
                    "centro_id": c.get("centro_id") or centro_id,
                    "centro_salud": c.get("centro_salud") or "CITAB",
                    "especialidad": c.get("especialidad") or "",
                    "motivo": c.get("motivo") or "",
                    "estado_remoto": estado_remoto,
                    "codigo": c.get("codigo_confirmacion") or f"WEB-{cid[:6].upper()}",
                    "created_at": _parse_created_at(c.get("created_at")),
                    "fecha_cita": c.get("fecha_cita") or datetime.now().date(),
                    "hora_inicio": (
                        datetime.strptime(c.get("hora_inicio"), "%H:%M").time()
                        if c.get("hora_inicio")
                        else datetime.strptime("08:00", "%H:%M").time()
                    ),
                },
            )
            sincronizadas += 1
        else:
            # Si la cita ya existe localmente, actualizar su estado si cambió en Supabase
            if existe["estado"] != estado_remoto:
                await db.execute(
                    text("UPDATE citas SET estado = :estado_remoto WHERE id::text = :cid"),
                    {"estado_remoto": estado_remoto, "cid": cid},
                )
                sincronizadas += 1

    if sincronizadas > 0:
        await db.commit()
        logger.info(f"Sincronizadas {sincronizadas} solicitudes web desde Supabase (centro={centro_id}).")

    return sincronizadas


async def notificar_confirmacion_supabase(
    cita_id: str,
    paciente_id: Optional[str],
    medico_id: int,
    medico_nombre: str,
    fecha_cita: str,
    hora_inicio: str,
    centro_nombre: str,
    especialidad: str,
    codigo_confirmacion: str,
    destinatario: str = "",
) -> bool:
    """Envía la confirmación a Supabase para que el portal web refleje el nuevo estado y notificación."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        return False

    base_url = settings.SUPABASE_URL.rstrip("/")
    headers = _headers()

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            # 1. Actualizar cita en Supabase
            patch_data = {
                "estado": "confirmada",
                "fecha_cita": fecha_cita,
                "hora_inicio": hora_inicio,
                "medico_id": medico_id,
            }
            resp_c = await client.patch(
                f"{base_url}/rest/v1/citas?id=eq.{cita_id}",
                json=patch_data,
                headers=headers,
            )
            if resp_c.status_code not in (200, 204):
                logger.warning(f"Error actualizando cita en Supabase: {resp_c.status_code} - {resp_c.text}")

            # 2. Registrar notificación para el portal web
            if paciente_id:
                detalle = (
                    f"Su cita para {especialidad} ha sido confirmada para el "
                    f"{fecha_cita} a las {hora_inicio} con el Dr(a). {medico_nombre} en {centro_nombre}. "
                    f"Código de confirmación: {codigo_confirmacion}."
                )
                notif_data = {
                    "paciente_id": str(paciente_id),
                    "tipo": "recordatorio_cita",
                    "canal": "sistema",
                    "asunto": f"Cita confirmada en {centro_nombre}",
                    "destinatario": destinatario or None,
                    "detalle": detalle,
                    "estado": "enviado",
                    "referencia": f"cita:{cita_id}",
                }
                await client.post(
                    f"{base_url}/rest/v1/notificaciones",
                    json=notif_data,
                    headers=headers,
                )
        return True
    except Exception as e:
        logger.warning(f"No se pudo notificar confirmación a Supabase: {e}")
        return False


def _parse_created_at(valor) -> datetime:
    """Convierte created_at de Supabase (string ISO o datetime) a objeto datetime."""
    if valor is None:
        return datetime.now()
    if isinstance(valor, datetime):
        return valor
    if isinstance(valor, str):
        try:
            return datetime.fromisoformat(valor)
        except ValueError:
            return datetime.now()
    return datetime.now()
