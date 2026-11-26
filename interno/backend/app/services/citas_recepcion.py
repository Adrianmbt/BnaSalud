"""Citas presenciales/telefónicas creadas desde Recepción.

Flujo híbrido:

1. La cita se valida y se guarda en la base local dentro de una transacción
   con bloqueo por (centro, fecha, médico), de modo que dos recepcionistas no
   puedan sobrevender el mismo cupo.
2. Se encola en `citas_sync_outbox` el registro que debe llegar al portal web.
3. Un worker en segundo plano (o el botón «Sincronizar» de la UI) empuja la
   cola a Supabase. Si no hay internet, la cita sigue operativa en la clínica y
   la cola se envía al reconectar.

Los identificadores son los mismos en local y en la nube: la cita se crea con
`gen_random_uuid()` y el paciente se empuja con el UUID local (o con el UUID
del portal si ya existía esa cédula), así no hay colisiones de claves.
"""
import logging
import random
import re
import string
from datetime import date, datetime, time, timedelta
from typing import Optional
from urllib.parse import quote
from uuid import uuid4

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_CUPOS_TURNO = 10
SLOT_MINUTOS = 30
ORIGEN_RECEPCION = "recepcion_interna"

_tablas_ok = False
_worker_task = None


# ─────────────────────────────────────────────────────────────────────────────
# Utilidades
# ─────────────────────────────────────────────────────────────────────────────
def _hhmm(hora) -> str:
    return str(hora)[:5]


def _slots(hora_inicio, hora_fin) -> list:
    """Inicios de los bloques de SLOT_MINUTOS dentro del turno."""
    inicio = datetime.combine(date.min, hora_inicio)
    fin = datetime.combine(date.min, hora_fin)
    paso = timedelta(minutes=SLOT_MINUTOS)
    if fin <= inicio:
        fin = inicio + paso
    return [(inicio + paso * i).time() for i in range(int((fin - inicio) / paso))]


def _parse_fecha(valor: str) -> date:
    try:
        return datetime.strptime(str(valor)[:10], "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValueError("Fecha inválida (formato YYYY-MM-DD).")


def _parse_hora(valor: str) -> time:
    try:
        return datetime.strptime(str(valor)[:5], "%H:%M").time()
    except (TypeError, ValueError):
        raise ValueError("Hora inválida (formato HH:MM).")


def _codigo_confirmacion(centro_id: int) -> str:
    sufijo = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"RC-{centro_id}-{sufijo}"


def _telefono_wa(telefono) -> str:
    digitos = re.sub(r"\D", "", str(telefono or ""))
    if not digitos:
        return ""
    if digitos.startswith("58"):
        return digitos
    if digitos.startswith("0"):
        return f"58{digitos[1:]}"
    if len(digitos) == 10:
        return f"58{digitos}"
    return digitos


def supabase_configurado() -> bool:
    return bool(settings.SUPABASE_URL and settings.SUPABASE_KEY)


def _base_url() -> str:
    return settings.SUPABASE_URL.rstrip("/")


def _headers() -> dict:
    return {
        "apikey": settings.SUPABASE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


async def asegurar_tablas(db: AsyncSession) -> None:
    """Aplica (de forma perezosa) las tablas de la migración 023 si faltan."""
    global _tablas_ok
    if _tablas_ok:
        return
    try:
        await db.execute(text("ALTER TABLE citas ADD COLUMN IF NOT EXISTS numero_turno integer"))
        await db.execute(
            text(
                "CREATE TABLE IF NOT EXISTS citas_sync_outbox ("
                "  id bigserial PRIMARY KEY,"
                "  entidad text NOT NULL DEFAULT 'cita',"
                "  operacion text NOT NULL DEFAULT 'upsert',"
                "  referencia text,"
                "  payload jsonb NOT NULL,"
                "  intentos integer NOT NULL DEFAULT 0,"
                "  ultimo_error text,"
                "  enviado_en timestamptz,"
                "  created_at timestamptz NOT NULL DEFAULT now()"
                ")"
            )
        )
        await db.commit()
        _tablas_ok = True
    except Exception as exc:  # pragma: no cover - respaldo defensivo
        await db.rollback()
        logger.warning("No se pudieron asegurar las tablas de citas de recepción: %s", exc)


# ─────────────────────────────────────────────────────────────────────────────
# Pacientes
# ─────────────────────────────────────────────────────────────────────────────
async def buscar_pacientes(db: AsyncSession, q: str, limite: int = 8) -> list:
    """Buscador rápido por cédula o nombre para el alta de la cita.

    Suma tres fuentes: pacientes con historia clínica, trabajadores activos
    (tabla `empleados`) y sus beneficiarios registrados. Un trabajador o
    beneficiario que todavía no tiene ficha vuelve con `id` nulo; la cita se
    registra con sus datos y la historia clínica se crea al confirmarla.

    Al buscar el nombre o la cédula de un trabajador también aparecen sus
    beneficiarios, para agendar a la familia sin repetir la búsqueda.
    """
    termino = (q or "").strip()
    if len(termino) < 2:
        return []
    filas = (
        await db.execute(
            text(
                "SELECT * FROM ("
                "  SELECT h.id::text AS id, h.cedula, h.nombre_completo, h.telefono,"
                "         h.fecha_nacimiento::text AS fecha_nacimiento,"
                "         CASE"
                "           WHEN EXISTS (SELECT 1 FROM empleados e2"
                "                        WHERE e2.cedula = h.cedula AND e2.activo)"
                "             THEN 'trabajador'"
                "           WHEN EXISTS (SELECT 1 FROM beneficiarios b2"
                "                        WHERE b2.cedula = h.cedula AND b2.activo)"
                "             THEN 'beneficiario'"
                "           ELSE ''"
                "         END AS vinculo,"
                "         ''::text AS parentesco, ''::text AS empleado_nombre"
                "    FROM historias_clinicas h"
                "   WHERE h.cedula ILIKE :q OR h.nombre_completo ILIKE :q"
                "  UNION ALL"
                "  SELECT NULL, e.cedula, e.nombre_completo, e.telefono,"
                "         e.fecha_nacimiento::text,"
                "         'trabajador', '', ''"
                "    FROM empleados e"
                "   WHERE COALESCE(e.activo, TRUE)"
                "     AND (e.cedula ILIKE :q OR e.nombre_completo ILIKE :q)"
                "     AND NOT EXISTS (SELECT 1 FROM historias_clinicas h2"
                "                      WHERE h2.cedula = e.cedula)"
                "  UNION ALL"
                "  SELECT NULL, b.cedula, b.nombre_completo, b.telefono,"
                "         b.fecha_nacimiento::text,"
                "         'beneficiario', COALESCE(b.parentesco, ''),"
                "         COALESCE(e.nombre_completo, '')"
                "    FROM beneficiarios b"
                "    LEFT JOIN empleados e ON e.id = b.empleado_id"
                "   WHERE COALESCE(b.activo, TRUE)"
                "     AND (b.cedula ILIKE :q OR b.nombre_completo ILIKE :q"
                "          OR e.cedula ILIKE :q OR e.nombre_completo ILIKE :q)"
                "     AND NOT EXISTS (SELECT 1 FROM historias_clinicas h2"
                "                      WHERE h2.cedula = b.cedula)"
                ") AS encontrados "
                "ORDER BY (cedula = :exacto) DESC, nombre_completo "
                "LIMIT :lim"
            ),
            {"q": f"%{termino}%", "exacto": termino, "lim": limite},
        )
    ).mappings()
    return [
        {
            "id": str(f["id"]) if f["id"] else None,
            "cedula": f["cedula"] or "",
            "nombre_completo": f["nombre_completo"] or "",
            "telefono": f["telefono"] or "",
            "fecha_nacimiento": str(f["fecha_nacimiento"])[:10] if f["fecha_nacimiento"] else "",
            "vinculo": f["vinculo"] or "",
            "parentesco": f["parentesco"] or "",
            "empleado_nombre": f["empleado_nombre"] or "",
        }
        for f in filas
    ]


async def buscar_paciente_por_cedula(db: AsyncSession, cedula: str) -> Optional[dict]:
    if not (cedula or "").strip():
        return None
    fila = (
        await db.execute(
            text(
                "SELECT id, cedula, nombre_completo, telefono, fecha_nacimiento "
                "FROM historias_clinicas WHERE TRIM(cedula) = TRIM(:c) LIMIT 1"
            ),
            {"c": cedula.strip()},
        )
    ).mappings().first()
    if not fila:
        return None
    return {
        "id": str(fila["id"]),
        "cedula": fila["cedula"] or "",
        "nombre_completo": fila["nombre_completo"] or "",
        "telefono": fila["telefono"] or "",
        "fecha_nacimiento": str(fila["fecha_nacimiento"])[:10] if fila["fecha_nacimiento"] else "",
    }


async def _crear_paciente(db: AsyncSession, datos: dict) -> dict:
    """Registra la ficha del paciente nuevo (sin commit: lo hace crear_cita).

    Si el portal ya conoce esa cédula se reutiliza su UUID, para que la cita
    suba apuntando al mismo paciente y no se dupliquen historias.
    """
    cedula = (datos.get("cedula") or "").strip()
    if not cedula:
        raise ValueError("La cédula es obligatoria para registrar al paciente.")
    nombre = (datos.get("nombre_completo") or "").strip()
    if not nombre:
        raise ValueError("El nombre completo es obligatorio para registrar al paciente.")

    existente = await buscar_paciente_por_cedula(db, cedula)
    if existente:
        # Completa teléfono/nombre si venían vacíos, sin sobreescribir datos.
        await db.execute(
            text(
                "UPDATE historias_clinicas SET "
                "  telefono = COALESCE(NULLIF(telefono, ''), :tel), "
                "  comuna = COALESCE(NULLIF(comuna, ''), :com), "
                "  nombre_completo = COALESCE(NULLIF(nombre_completo, ''), :nom) "
                "WHERE id = :id"
            ),
            {
                "tel": (datos.get("telefono") or "").strip() or None,
                "com": (datos.get("comuna") or "").strip() or None,
                "nom": nombre,
                "id": existente["id"],
            },
        )
        return existente

    nuevo_id = await _uuid_remoto_paciente(cedula) or str(uuid4())
    fecha_nac = (datos.get("fecha_nacimiento") or "").strip() or None

    await db.execute(
        text(
            "INSERT INTO historias_clinicas "
            "  (id, cedula, nombre_completo, apellido, telefono, comuna, fecha_nacimiento, created_at) "
            "VALUES (:id, :ced, :nom, :ape, :tel, :com, :fnac, NOW())"
        ),
        {
            "id": nuevo_id,
            "ced": cedula,
            "nom": nombre,
            "ape": (datos.get("apellido") or "").strip() or None,
            "tel": (datos.get("telefono") or "").strip() or None,
            "com": (datos.get("comuna") or "").strip() or None,
            "fnac": fecha_nac,
        },
    )
    return {
        "id": nuevo_id,
        "cedula": cedula,
        "nombre_completo": nombre,
        "telefono": (datos.get("telefono") or "").strip(),
        "comuna": (datos.get("comuna") or "").strip(),
        "fecha_nacimiento": fecha_nac or "",
    }


async def _uuid_remoto_paciente(cedula: str) -> Optional[str]:
    """UUID que el portal web ya usa para esa cédula (best effort, tolerante a offline)."""
    if not supabase_configurado() or not cedula:
        return None
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.get(
                f"{_base_url()}/rest/v1/historias_clinicas",
                params={"cedula": f"eq.{cedula}", "select": "id", "limit": "1"},
                headers=_headers(),
            )
            if r.status_code == 200 and r.json():
                return str(r.json()[0]["id"])
    except Exception as exc:
        logger.info("Portal inalcanzable al consultar la cédula %s: %s", cedula, exc)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Disponibilidad
# ─────────────────────────────────────────────────────────────────────────────
async def _especialista(db: AsyncSession, medico_id: int) -> dict:
    fila = (
        await db.execute(
            text(
                "SELECT p.id, p.nombre, p.apellido, COALESCE(p.especialidad, '') AS especialidad "
                "FROM personal p WHERE p.id = :mid"
            ),
            {"mid": medico_id},
        )
    ).mappings().first()
    if not fila:
        raise ValueError(f"No existe un especialista con id {medico_id}.")
    nombre = f"{fila['nombre'] or ''} {fila['apellido'] or ''}".strip()
    return {"id": fila["id"], "nombre": nombre, "especialidad": fila["especialidad"]}


async def _turnos_del_dia(db: AsyncSession, medico_id: int, fecha: date) -> list:
    filas = (
        await db.execute(
            text(
                "SELECT t.id AS turno_id, COALESCE(t.nombre, '') AS nombre, "
                "       t.hora_inicio, t.hora_fin "
                "FROM agenda_medicos a "
                "JOIN turnos t ON t.id = a.turno_id "
                "WHERE a.medico_id = :mid AND a.activo = TRUE AND a.dia_semana = :dia "
                "ORDER BY t.hora_inicio"
            ),
            {"mid": medico_id, "dia": fecha.weekday()},
        )
    ).mappings()
    return list(filas)


async def _esta_ausente(db: AsyncSession, medico_id: int, fecha: date) -> bool:
    fila = (
        await db.execute(
            text(
                "SELECT 1 FROM ausencias_medicos "
                "WHERE medico_id = :mid AND estado = 'activa' "
                "  AND fecha_desde <= :f AND fecha_hasta >= :f LIMIT 1"
            ),
            {"mid": medico_id, "f": fecha},
        )
    ).first()
    return bool(fila)


async def _ocupadas(db: AsyncSession, medico_id: int, fecha: date) -> dict:
    """{HH:MM: cantidad} de citas vigentes del médico en la fecha."""
    filas = (
        await db.execute(
            text(
                "SELECT to_char(hora_inicio, 'HH24:MI') AS h, count(*) AS n "
                "FROM citas WHERE medico_id = :mid AND fecha_cita = :fec "
                "  AND estado NOT IN ('cancelada', 'preasignada') "
                "GROUP BY to_char(hora_inicio, 'HH24:MI')"
            ),
            {"mid": medico_id, "fec": fecha},
        )
    ).mappings()
    return {f["h"]: int(f["n"] or 0) for f in filas}


def _resumen_turnos(turnos: list, ocupadas: dict) -> list:
    """Capacidad, ocupados y horas libres por turno (tope de 10 por turno)."""
    resultado = []
    for t in turnos:
        inicio = _hhmm(t["hora_inicio"])
        fin = _hhmm(t["hora_fin"])
        en_turno = sum(n for h, n in ocupadas.items() if inicio <= h < fin or (inicio == fin and h == inicio))
        slots = [_hhmm(s) for s in _slots(t["hora_inicio"], t["hora_fin"])]
        horas_libres = [s for s in slots if s not in ocupadas]
        libres = max(0, min(MAX_CUPOS_TURNO - en_turno, len(horas_libres)))
        resultado.append(
            {
                "turno_id": t["turno_id"],
                "nombre": t["nombre"] or "Turno",
                "hora_inicio": inicio,
                "hora_fin": fin,
                "capacidad": MAX_CUPOS_TURNO,
                "ocupadas": min(en_turno, MAX_CUPOS_TURNO),
                "libres": libres,
                "horas_libres": horas_libres if libres > 0 else [],
                "hora_asignada": horas_libres[0] if libres > 0 and horas_libres else None,
            }
        )
    return resultado


async def disponibilidad_dia(db: AsyncSession, medico_id: int, fecha_txt: str) -> dict:
    """Cupos libres vs ocupados del médico en una fecha concreta."""
    fecha = _parse_fecha(fecha_txt)
    esp = await _especialista(db, medico_id)
    hoy = (await db.execute(text("SELECT CURRENT_DATE AS hoy"))).scalar_one()

    base = {
        "medico_id": medico_id,
        "medico_nombre": esp["nombre"],
        "especialidad": esp["especialidad"],
        "fecha": fecha.isoformat(),
        "trabaja": False,
        "motivo": "",
        "turnos": [],
        "capacidad_total": 0,
        "ocupadas_total": 0,
        "libres_total": 0,
    }

    if fecha < hoy:
        base["motivo"] = "La fecha ya pasó."
        return base
    if await _esta_ausente(db, medico_id, fecha):
        base["motivo"] = "El especialista tiene una ausencia registrada ese día."
        return base

    turnos = await _turnos_del_dia(db, medico_id, fecha)
    if not turnos:
        base["motivo"] = "El especialista no labora ese día."
        return base

    resumen = _resumen_turnos(turnos, await _ocupadas(db, medico_id, fecha))
    base.update(
        {
            "trabaja": True,
            "turnos": resumen,
            "capacidad_total": sum(t["capacidad"] for t in resumen),
            "ocupadas_total": sum(t["ocupadas"] for t in resumen),
            "libres_total": sum(t["libres"] for t in resumen),
        }
    )
    if base["libres_total"] <= 0:
        base["motivo"] = "El especialista alcanzó su límite de cupos para ese día."
    return base


# ─────────────────────────────────────────────────────────────────────────────
# Alta de la cita
# ─────────────────────────────────────────────────────────────────────────────
async def crear_cita(
    db: AsyncSession,
    *,
    medico_id: int,
    fecha: str,
    paciente_id: Optional[str] = None,
    paciente: Optional[dict] = None,
    hora_inicio: Optional[str] = None,
    turno_id: Optional[int] = None,
    motivo: Optional[str] = None,
    centro_id: Optional[int] = None,
) -> dict:
    """Crea la cita confirmada con descuento atómico del cupo."""
    await asegurar_tablas(db)

    fec = _parse_fecha(fecha)
    esp = await _especialista(db, medico_id)
    centro = centro_id or settings.id_centro
    hoy = (await db.execute(text("SELECT CURRENT_DATE AS hoy"))).scalar_one()
    if fec < hoy:
        raise ValueError("No se puede agendar una cita en una fecha pasada.")

    # ── Datos del paciente (ficha existente o alta rápida) ──────────────────
    if paciente_id:
        fila = (
            await db.execute(
                text(
                    "SELECT id, cedula, nombre_completo, telefono, fecha_nacimiento "
                    "FROM historias_clinicas WHERE id = :id"
                ),
                {"id": paciente_id},
            )
        ).mappings().first()
        if not fila:
            raise ValueError("El paciente indicado no existe.")
        pac = {
            "id": str(fila["id"]),
            "cedula": fila["cedula"] or "",
            "nombre_completo": fila["nombre_completo"] or "",
            "telefono": fila["telefono"] or "",
            "fecha_nacimiento": str(fila["fecha_nacimiento"])[:10] if fila["fecha_nacimiento"] else "",
        }
    elif paciente:
        pac = await _crear_paciente(db, paciente)
    else:
        raise ValueError("Seleccione un paciente o registre uno nuevo.")

    # ── Bloqueos de transacción: centro/fecha (número de turno) y médico/fecha
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"),
        {"k": f"recepcion-centro|{centro}|{fec.isoformat()}"},
    )
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"),
        {"k": f"recepcion-medico|{medico_id}|{fec.isoformat()}"},
    )

    # Re-lectura DESPUÉS del bloqueo: evita el overbooking entre recepcionistas.
    if await _esta_ausente(db, medico_id, fec):
        raise ValueError("El especialista tiene una ausencia registrada ese día.")
    turnos = await _turnos_del_dia(db, medico_id, fec)
    if not turnos:
        raise ValueError("El especialista no labora ese día.")

    ocupadas = await _ocupadas(db, medico_id, fec)
    resumen = _resumen_turnos(turnos, ocupadas)

    turno = None
    if turno_id is not None:
        turno = next((t for t in resumen if t["turno_id"] == turno_id), None)
    if turno is None and hora_inicio:
        h = _hhmm(_parse_hora(hora_inicio))
        turno = next((t for t in resumen if t["hora_inicio"] <= h < t["hora_fin"]), None)

    if turno is None:
        raise ValueError("El turno indicado no está activo para el especialista ese día.")
    if turno["libres"] <= 0:
        raise ValueError(
            "El especialista alcanzó su límite de cupos en ese turno. Elija otro turno u otro día."
        )

    if hora_inicio:
        hora = _parse_hora(hora_inicio)
        if not (turno["hora_inicio"] <= _hhmm(hora) < turno["hora_fin"]):
            raise ValueError("La hora indicada está fuera del turno seleccionado.")
        if hora not in _slots(_parse_hora(turno["hora_inicio"]), _parse_hora(turno["hora_fin"])):
            raise ValueError("La hora indicada no coincide con un bloque de atención válido.")
        if _hhmm(hora) in ocupadas:
            raise ValueError("Esa hora ya está ocupada. Seleccione otra.")
    else:
        if not turno["hora_asignada"]:
            raise ValueError("No quedan horas libres en ese turno.")
        hora = _parse_hora(turno["hora_asignada"])

    # ── Número de turno correlativo del centro para el día ──────────────────
    numero = (
        await db.execute(
            text(
                "SELECT COALESCE(MAX(numero_turno), 0) + 1 FROM citas "
                "WHERE centro_id = :c AND fecha_cita = :f"
            ),
            {"c": centro, "f": fec},
        )
    ).scalar_one()

    centro_salud = (
        await db.execute(text("SELECT nombre FROM clinicas WHERE id = :c"), {"c": centro})
    ).scalar_one_or_none() or "BnaSalud"

    codigo = _codigo_confirmacion(centro)
    while (await db.execute(text("SELECT 1 FROM citas WHERE codigo_confirmacion = :c"), {"c": codigo})).first():
        codigo = _codigo_confirmacion(centro)

    fila = (
        await db.execute(
            text(
                "INSERT INTO citas "
                "  (id, paciente_id, centro_id, centro_salud, especialidad, medico_id, "
                "   fecha_cita, hora_inicio, motivo, origen, estado, codigo_confirmacion, "
                "   numero_turno, created_at) "
                "VALUES (gen_random_uuid(), :pid, :cid, :cs, :esp, :mid, :fec, :hora, :mot, "
                "        :origen, 'confirmada', :cod, :num, NOW()) "
                "RETURNING id, codigo_confirmacion, numero_turno"
            ),
            {
                "pid": pac["id"],
                "cid": centro,
                "cs": centro_salud,
                "esp": esp["especialidad"],
                "mid": medico_id,
                "fec": fec,
                "hora": hora,
                "mot": (motivo or "").strip() or None,
                "origen": ORIGEN_RECEPCION,
                "cod": codigo,
                "num": numero,
            },
        )
    ).mappings().first()

    payload = {
        "id": str(fila["id"]),
        "paciente_id": pac["id"],
        "centro_id": centro,
        "centro_salud": centro_salud,
        "especialidad": esp["especialidad"],
        "medico_id": medico_id,
        "fecha_cita": fec.isoformat(),
        "hora_inicio": _hhmm(hora),
        "motivo": (motivo or "").strip() or None,
        "origen": ORIGEN_RECEPCION,
        "estado": "confirmada",
        "codigo_confirmacion": fila["codigo_confirmacion"],
    }
    await db.execute(
        text(
            "INSERT INTO citas_sync_outbox (entidad, operacion, referencia, payload) "
            "VALUES ('cita', 'upsert', :ref, CAST(:payload AS jsonb))"
        ),
        {"ref": str(fila["id"]), "payload": _json(payload)},
    )
    await db.commit()

    # Empuje inmediato (si falla, la cola se reintenta en segundo plano).
    enviado = False
    try:
        enviados, _ = await empujar_pendientes(db)
        enviado = enviados > 0
    except Exception as exc:
        logger.info("Cita guardada en local, pendiente de sincronizar: %s", exc)

    return {
        "cita_id": str(fila["id"]),
        "codigo_confirmacion": fila["codigo_confirmacion"] or "",
        "numero_turno": int(fila["numero_turno"] or 0),
        "estado": "confirmada",
        "origen": ORIGEN_RECEPCION,
        "especialidad": esp["especialidad"],
        "medico_id": medico_id,
        "medico_nombre": esp["nombre"],
        "fecha_cita": fec.isoformat(),
        "hora_inicio": _hhmm(hora),
        "turno_nombre": turno["nombre"],
        "centro_salud": centro_salud,
        "paciente": pac,
        "sincronizada": enviado,
        **_whatsapp(pac, esp, fec, hora, turno["nombre"], centro_salud, fila["codigo_confirmacion"], numero),
    }


def _whatsapp(pac, esp, fec, hora, turno_nombre, centro, codigo, numero) -> dict:
    telefono = _telefono_wa(pac.get("telefono"))
    mensaje = (
        f"¡Hola {pac.get('nombre_completo') or 'paciente'}! Le saludamos de *{centro}*.\n\n"
        f"Su cita médica quedó *CONFIRMADA*:\n\n"
        f"🩺 *Especialidad:* {esp['especialidad'] or 'Consulta'}\n"
        f"👨‍⚕️ *Médico:* Dr(a). {esp['nombre']}\n"
        f"📅 *Fecha:* {fec.strftime('%d/%m/%Y')}\n"
        f"⏰ *Hora:* {_hhmm(hora)} ({turno_nombre})\n"
        f"🎫 *Número de turno:* {numero}\n"
        f"🔖 *Código:* {codigo}\n\n"
        f"Por favor acuda 15 minutos antes con su cédula de identidad. ¡Le esperamos!"
    )
    return {
        "whatsapp_url": f"https://wa.me/{telefono}?text={quote(mensaje)}" if telefono else None,
        "whatsapp_mensaje": mensaje,
    }


def _json(valor) -> str:
    import json

    return json.dumps(valor, ensure_ascii=False, default=str)


# ─────────────────────────────────────────────────────────────────────────────
# Sincronización hacia Supabase
# ─────────────────────────────────────────────────────────────────────────────
async def _resolver_paciente_remoto(db: AsyncSession, historia_id: str) -> str:
    """Devuelve el UUID del paciente en el portal (mismo si ya existía la cédula)."""
    fila = (
        await db.execute(
            text(
                "SELECT id, cedula, nombre_completo, telefono, fecha_nacimiento, email, direccion "
                "FROM historias_clinicas WHERE id = :id"
            ),
            {"id": historia_id},
        )
    ).mappings().first()
    if not fila:
        raise RuntimeError(f"La historia clínica local {historia_id} no existe.")

    cedula = (fila["cedula"] or "").strip()
    datos = {
        "nombre_completo": fila["nombre_completo"],
        "telefono": fila["telefono"],
        "fecha_nacimiento": str(fila["fecha_nacimiento"])[:10] if fila["fecha_nacimiento"] else None,
        "email": fila["email"],
        "direccion": fila["direccion"],
    }
    datos = {k: v for k, v in datos.items() if v not in (None, "")}

    async with httpx.AsyncClient(timeout=8.0) as client:
        r = await client.get(
            f"{_base_url()}/rest/v1/historias_clinicas",
            params={"id": f"eq.{fila['id']}", "select": "id"},
            headers=_headers(),
        )
        if r.status_code == 200 and r.json():
            return str(fila["id"])

        if cedula:
            r = await client.get(
                f"{_base_url()}/rest/v1/historias_clinicas",
                params={"cedula": f"eq.{cedula}", "select": "id", "limit": "1"},
                headers=_headers(),
            )
            if r.status_code == 200 and r.json():
                remoto_id = str(r.json()[0]["id"])
                await client.patch(
                    f"{_base_url()}/rest/v1/historias_clinicas",
                    params={"id": f"eq.{remoto_id}"},
                    json=datos,
                    headers=_headers(),
                )
                return remoto_id

        cuerpo = {"id": str(fila["id"]), "cedula": cedula or None, **datos}
        r = await client.post(
            f"{_base_url()}/rest/v1/historias_clinicas",
            json=cuerpo,
            headers={**_headers(), "Prefer": "return=minimal"},
        )
        if r.status_code not in (200, 201, 204):
            raise RuntimeError(f"Portal pacientes HTTP {r.status_code}: {r.text[:180]}")
        return str(fila["id"])


async def _enviar_cita(db: AsyncSession, payload: dict) -> None:
    paciente_remoto = await _resolver_paciente_remoto(db, payload["paciente_id"])
    cuerpo = {**payload, "paciente_id": paciente_remoto}

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{_base_url()}/rest/v1/citas",
            json=cuerpo,
            headers={**_headers(), "Prefer": "return=minimal,resolution=merge-duplicates"},
        )
        if r.status_code in (200, 201, 204):
            return

        # La cita ya existe en el portal (reintento de la cola): se actualiza.
        if r.status_code == 409:
            r2 = await client.patch(
                f"{_base_url()}/rest/v1/citas",
                params={"id": f"eq.{cuerpo['id']}"},
                json=cuerpo,
                headers={**_headers(), "Prefer": "return=minimal"},
            )
            if r2.status_code in (200, 204):
                return
            raise RuntimeError(
                "Conflicto de cupo en el portal (centro, fecha y hora ya reservados): "
                f"HTTP {r2.status_code} {r2.text[:150]}"
            )
        raise RuntimeError(f"Portal citas HTTP {r.status_code}: {r.text[:180]}")


async def empujar_pendientes(db: AsyncSession, limite: int = 25) -> tuple:
    """Envía la cola pendiente a Supabase. Devuelve (enviados, fallidos)."""
    await asegurar_tablas(db)
    if not supabase_configurado():
        return 0, 0

    filas = (
        await db.execute(
            text(
                "SELECT id, entidad, payload FROM citas_sync_outbox "
                "WHERE enviado_en IS NULL ORDER BY id LIMIT :lim"
            ),
            {"lim": limite},
        )
    ).mappings().all()
    if not filas:
        return 0, 0

    enviados = fallidos = 0
    for fila in filas:
        payload = fila["payload"]
        if isinstance(payload, str):
            import json

            payload = json.loads(payload)
        try:
            if fila["entidad"] == "cita":
                await _enviar_cita(db, payload)
            await db.execute(
                text(
                    "UPDATE citas_sync_outbox SET enviado_en = NOW(), ultimo_error = NULL "
                    "WHERE id = :id"
                ),
                {"id": fila["id"]},
            )
            enviados += 1
        except Exception as exc:
            await db.execute(
                text(
                    "UPDATE citas_sync_outbox "
                    "SET intentos = intentos + 1, ultimo_error = :err WHERE id = :id"
                ),
                {"err": str(exc)[:400], "id": fila["id"]},
            )
            fallidos += 1
            logger.warning("No se pudo sincronizar la cita %s: %s", payload.get("id"), exc)
    await db.commit()
    return enviados, fallidos


async def estado_sync(db: AsyncSession) -> dict:
    await asegurar_tablas(db)
    fila = (
        await db.execute(
            text(
                "SELECT "
                "  COUNT(*) FILTER (WHERE enviado_en IS NULL) AS pendientes, "
                "  COUNT(*) FILTER (WHERE enviado_en IS NOT NULL) AS enviadas, "
                "  COUNT(*) FILTER (WHERE enviado_en IS NULL AND intentos > 0) AS con_error "
                "FROM citas_sync_outbox"
            )
        )
    ).mappings().first()
    ultimo = (
        await db.execute(
            text(
                "SELECT ultimo_error FROM citas_sync_outbox "
                "WHERE ultimo_error IS NOT NULL ORDER BY id DESC LIMIT 1"
            )
        )
    ).scalar_one_or_none()
    return {
        "conectado": supabase_configurado(),
        "pendientes": int(fila["pendientes"] or 0),
        "enviadas": int(fila["enviadas"] or 0),
        "con_error": int(fila["con_error"] or 0),
        "ultimo_error": ultimo,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Worker de segundo plano
# ─────────────────────────────────────────────────────────────────────────────
async def _worker(intervalo: int = 60) -> None:
    from app.core.database import AsyncSessionLocal

    while True:
        try:
            async with AsyncSessionLocal() as db:
                enviados, fallidos = await empujar_pendientes(db)
                if enviados or fallidos:
                    logger.info("Cola de citas: %s enviadas, %s fallidas.", enviados, fallidos)
        except Exception:  # pragma: no cover - el worker nunca debe morir
            logger.exception("Error en el worker de sincronización de citas")
        await _sleep(intervalo)


async def _sleep(segundos: int) -> None:
    import asyncio

    await asyncio.sleep(segundos)


def iniciar_worker() -> None:
    """Arranca el bucle de sincronización (idempotente)."""
    import asyncio

    global _worker_task
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.create_task(_worker())


async def detener_worker() -> None:
    global _worker_task
    if _worker_task and not _worker_task.done():
        _worker_task.cancel()
        try:
            import asyncio

            await asyncio.gather(_worker_task, return_exceptions=True)
        except Exception:
            pass
    _worker_task = None
