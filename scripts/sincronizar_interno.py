#!/usr/bin/env python3
"""Agente de sincronización: sistema interno (CITAB) → Supabase.

Sube a Supabase un espejo de SOLO LECTURA del Postgres interno para que el
panel de soporte (rol `admin_sistemas`) vea los datos desde cualquier lugar:

  personal              → interno_personal   (nómina)
  usuarios (personal)   → interno_usuarios   (directorio, sin contraseñas)
  bitacora_acciones     → interno_bitacora   (quién hizo qué)
  system_logs           → interno_logs       (errores y avisos)
  latido de la máquina  → estado_instalaciones

Nunca escribe en el Postgres interno. Se ejecuta en el servidor interno,
donde ambos sistemas son alcanzables.

Requisitos (una sola vez, en ese servidor):
    pip install psycopg2-binary supabase python-dotenv

Uso:
    python scripts/sincronizar_interno.py --dry-run    # ver qué subiría
    python scripts/sincronizar_interno.py              # sincronizar

Programar en el Programador de tareas de Windows cada 5 minutos.

Variables:
    DATABASE_URL        cadena del Postgres interno. Si falta, se lee
                        interno/backend/.env (clave DATABASE_URL).
    SUPABASE_URL        se lee del .env de la raíz.
    SUPABASE_KEY        idem (clave de servicio, no la anónima).
    INSTALACION_ID      por defecto `citab`.
    INSTALACION_NOMBRE  por defecto `CITAB · Clínica de los Trabajadores`.
    CLINICA_ID          centro de esta instalación (por defecto 2).
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import psycopg2
from dotenv import load_dotenv

RAIZ = Path(__file__).resolve().parent.parent
ENV_PORTAL = RAIZ / ".env"
ENV_INTERNO = RAIZ / "interno" / "backend" / ".env"

TAM_LOTE = 500
MAX_LOGS_POR_CORRIDA = 5000


def _leer_clave(archivo: Path, clave: str) -> str:
    if not archivo.is_file():
        return ""
    for linea in archivo.read_text(encoding="utf-8", errors="ignore").splitlines():
        if linea.strip().startswith(f"{clave}="):
            return linea.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def _url_interna(argumento: Optional[str]) -> str:
    url = (argumento or os.getenv("DATABASE_URL") or _leer_clave(ENV_INTERNO, "DATABASE_URL")).strip()
    if not url:
        sys.exit(
            "Falta DATABASE_URL. Defínala en el entorno o en interno/backend/.env, "
            "por ejemplo:\n  DATABASE_URL=postgresql://usuario:clave@localhost:5432/bnasalud"
        )
    return url.replace("postgresql+asyncpg://", "postgresql://").replace("postgres+asyncpg://", "postgresql://")


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _leer_interno(url: str, consulta: str) -> List[Dict[str, Any]]:
    conexion = psycopg2.connect(url, connect_timeout=10)
    try:
        with conexion.cursor() as cur:
            cur.execute(consulta)
            columnas = [d[0] for d in cur.description]
            return [dict(zip(columnas, fila)) for fila in cur.fetchall()]
    finally:
        conexion.close()


def _subir(cliente, tabla: str, filas: List[Dict[str, Any]], conflicto: str) -> int:
    """Upsert por lotes. Devuelve cuántas filas se enviaron."""
    enviadas = 0
    for inicio in range(0, len(filas), TAM_LOTE):
        lote = filas[inicio : inicio + TAM_LOTE]
        cliente.table(tabla).upsert(lote, on_conflict=conflicto).execute()
        enviadas += len(lote)
    return enviadas


def _podar(cliente, tabla: str, columna: str, conservar: List[Any]) -> None:
    """Elimina del espejo lo que ya no existe en el interno."""
    if not conservar:
        return
    # shortcut: PostgREST viaja en la URL; con miles de filas habría que
    # trocear la lista. A la escala de CITAB (decenas) no hace falta.
    cliente.table(tabla).delete().not_.in_(columna, conservar).execute()


def _calcular_emergencias(url: str) -> List[Dict[str, Any]]:
    """Agrega métricas de emergencias/morbilidad desde cola_atencion por clínica."""
    sql = """
        SELECT
            ca.clinica_id,
            cl.nombre                                          AS clinica_nombre,
            COUNT(*) FILTER (
                WHERE ca.ruta_atencion = 'EMERGENCIA'
                  AND ca.atencion_estado NOT IN ('CANCELADO','NO_ASISTIO')
            )                                                  AS total_emergencias,
            COUNT(*) FILTER (
                WHERE ca.ruta_atencion = 'EMERGENCIA'
                  AND ca.atencion_estado = 'FINALIZADO'
            )                                                  AS finalizadas,
            COUNT(*) FILTER (
                WHERE ca.ruta_atencion = 'EMERGENCIA'
                  AND ca.atencion_estado IN (
                        'RECEPCION','TRIAJE','EN_ESPERA_CONSULTA','EN_CONSULTA'
                      )
            )                                                  AS en_atencion,
            COUNT(*) FILTER (
                WHERE ca.ruta_atencion = 'EMERGENCIA'
                  AND ca.atencion_estado IN ('CANCELADO','NO_ASISTIO')
            )                                                  AS canceladas,
            COUNT(*) FILTER (
                WHERE ca.ruta_atencion = 'EMERGENCIA'
                  AND ca.atencion_estado NOT IN ('CANCELADO','NO_ASISTIO')
                  AND ca.categoria_prioridad = 'VERDE'
            )                                                  AS prio_verde,
            COUNT(*) FILTER (
                WHERE ca.ruta_atencion = 'EMERGENCIA'
                  AND ca.atencion_estado NOT IN ('CANCELADO','NO_ASISTIO')
                  AND ca.categoria_prioridad = 'AMARILLO'
            )                                                  AS prio_amarillo,
            COUNT(*) FILTER (
                WHERE ca.ruta_atencion = 'EMERGENCIA'
                  AND ca.atencion_estado NOT IN ('CANCELADO','NO_ASISTIO')
                  AND ca.categoria_prioridad = 'ROJO'
            )                                                  AS prio_rojo,
            COUNT(DISTINCT COALESCE(
                ca.paciente_cedula,
                ca.paciente_id::text
            )) FILTER (
                WHERE ca.ruta_atencion = 'EMERGENCIA'
                  AND ca.atencion_estado NOT IN ('CANCELADO','NO_ASISTIO')
            )                                                  AS pacientes_distintos
        FROM  cola_atencion ca
        LEFT  JOIN clinicas cl ON cl.id = ca.clinica_id
        WHERE ca.ruta_atencion = 'EMERGENCIA'
        GROUP BY ca.clinica_id, cl.nombre
        ORDER BY ca.clinica_id
    """
    try:
        return _leer_interno(url, sql)
    except Exception as error:
        print(f"[aviso] No se pudo leer cola_atencion: {error}")
        return []


def _calcular_top_cie10(url: str) -> Dict[int, List[Dict[str, Any]]]:
    """Top diagnósticos CIE-10 de emergencia por clínica (desde consultas vinculadas a cola_atencion)."""
    sql = """
        SELECT ca.clinica_id, c.cie10_descripcion
        FROM consultas c
        INNER JOIN cola_atencion ca ON ca.id = c.cola_id
        WHERE ca.ruta_atencion = 'EMERGENCIA'
          AND c.cie10_descripcion IS NOT NULL
          AND TRIM(c.cie10_descripcion) <> ''
    """
    try:
        filas = _leer_interno(url, sql)
    except Exception as error:
        print(f"[aviso] No se pudo leer top CIE-10 de emergencia: {error}")
        return {}
    por_clinica: Dict[int, Dict[str, int]] = {}
    for f in filas:
        cid = f.get("clinica_id")
        if cid is None:
            continue
        cid = int(cid)
        diag = str(f.get("cie10_descripcion") or "").strip()
        if not diag:
            continue
        por_clinica.setdefault(cid, {})
        por_clinica[cid][diag] = por_clinica[cid].get(diag, 0) + 1
    resultado: Dict[int, List[Dict[str, Any]]] = {}
    for cid, conteo in por_clinica.items():
        resultado[cid] = [
            {"diagnostico": k, "total": v}
            for k, v in sorted(conteo.items(), key=lambda kv: -kv[1])[:5]
        ]
    return resultado


def _sincronizar(url: str, cliente, config: Dict[str, Any], seco: bool) -> None:
    ahora = _ahora()
    resumen: Dict[str, int] = {}

    # 1. Nómina
    personal = _leer_interno(
        url,
        "SELECT id, cedula, nombre, apellido, cargo, cargo_id, clinica_id, email, "
        "especialidad, estado, status, telefono FROM personal ORDER BY id",
    )
    filas_personal = [{**f, "actualizado_en": ahora} for f in personal]
    resumen["personal"] = len(filas_personal)
    if seco:
        print(f"[seco] interno_personal: {len(filas_personal)} filas")
    else:
        _subir(cliente, "interno_personal", filas_personal, "id")
        _podar(cliente, "interno_personal", "id", [f["id"] for f in personal])
        print(f"interno_personal: {len(filas_personal)} filas")

    # 2. Cuentas del personal (los pacientes tienen su propio portal)
    usuarios = _leer_interno(
        url,
        "SELECT username, rol, personal_id, clinica_id, activo FROM usuarios "
        "WHERE rol <> 'paciente' ORDER BY username",
    )
    filas_usuarios = [{**f, "actualizado_en": ahora} for f in usuarios]
    resumen["usuarios"] = len(filas_usuarios)
    if seco:
        print(f"[seco] interno_usuarios: {len(filas_usuarios)} filas")
    else:
        _subir(cliente, "interno_usuarios", filas_usuarios, "username")
        _podar(cliente, "interno_usuarios", "username", [f["username"] for f in usuarios])
        print(f"interno_usuarios: {len(filas_usuarios)} filas")

    # 3. Bitácora de acciones y logs del sistema (solo lo nuevo)
    if seco:
        bitacora = _leer_interno(url, "SELECT id FROM bitacora_acciones ORDER BY id DESC LIMIT 1")
        logs = _leer_interno(url, "SELECT id FROM system_logs ORDER BY id DESC LIMIT 1")
        print(f"[seco] interno_bitacora: hasta id {bitacora[0]['id'] if bitacora else 0}")
        print(f"[seco] interno_logs: hasta id {logs[0]['id'] if logs else 0}")
        resumen["bitacora"] = 0
        resumen["logs"] = 0
    else:
        resumen["bitacora"] = _sincronizar_bitacora(url, cliente, config["instalacion"])
        resumen["logs"] = _sincronizar_logs(url, cliente, config["instalacion"])

    # 4. Emergencias / Morbilidad (cola_atencion → interno_emergencias_resumen)
    filas_emerg = _calcular_emergencias(url)
    top_cie10_por_clinica = _calcular_top_cie10(url)
    resumen["emergencias"] = len(filas_emerg)
    if seco:
        total_emerg = sum(f.get("total_emergencias", 0) for f in filas_emerg)
        print(f"[seco] interno_emergencias_resumen: {len(filas_emerg)} clínicas · {total_emerg} emergencias")
    else:
        if filas_emerg:
            filas_emerg_subir = [
                {
                    "clinica_id": f["clinica_id"],
                    "instalacion": config["instalacion"],
                    "clinica_nombre": f.get("clinica_nombre") or f"Centro {f['clinica_id']}",
                    "total_emergencias": int(f.get("total_emergencias") or 0),
                    "finalizadas": int(f.get("finalizadas") or 0),
                    "en_atencion": int(f.get("en_atencion") or 0),
                    "canceladas": int(f.get("canceladas") or 0),
                    "prio_verde": int(f.get("prio_verde") or 0),
                    "prio_amarillo": int(f.get("prio_amarillo") or 0),
                    "prio_rojo": int(f.get("prio_rojo") or 0),
                    "pacientes_distintos": int(f.get("pacientes_distintos") or 0),
                    "top_cie10": top_cie10_por_clinica.get(int(f["clinica_id"]), []),
                    "actualizado_en": ahora,
                }
                for f in filas_emerg
            ]
            _subir(cliente, "interno_emergencias_resumen", filas_emerg_subir, "clinica_id,instalacion")
        total_emerg = sum(f.get("total_emergencias", 0) for f in filas_emerg)
        print(f"interno_emergencias_resumen: {len(filas_emerg)} clínicas · {total_emerg} emergencias")

    # 5. Latido para el estado del sistema
    detalle = {"personal": resumen["personal"], "usuarios": resumen["usuarios"], "emergencias": resumen["emergencias"]}
    if seco:
        print(f"[seco] estado_instalaciones: {config['instalacion']} · {detalle}")
        return
    cliente.table("estado_instalaciones").upsert(
        {
            "id": config["instalacion"],
            "nombre": config["nombre"],
            "centro_id": config["centro_id"],
            "version": config["version"],
            "db_ok": True,
            "detalle": detalle,
            "ultimo_ping": ahora,
        },
        on_conflict="id",
    ).execute()
    print(f"latido: {config['instalacion']} · {detalle}")


def _maximo(cliente, tabla: str, instalacion: str) -> int:
    try:
        filas = (
            cliente.table(tabla)
            .select("origen_id")
            .eq("instalacion", instalacion)
            .order("origen_id", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        return int(filas[0]["origen_id"]) if filas else 0
    except Exception as error:
        sys.exit(
            f"No se pudo leer {tabla} en Supabase ({error}). Verifique SUPABASE_URL/SUPABASE_KEY "
            "y que supabase/migrations/0026_soporte_panel.sql esté aplicada."
        )


def _sincronizar_bitacora(url: str, cliente, instalacion: str) -> int:
    ultimo = _maximo(cliente, "interno_bitacora", instalacion)
    filas = _leer_interno(
        url,
        f"SELECT id, usuario_id, username, rol, accion, entidad, entidad_id, "
        f"detalle, created_at AS creado_en FROM bitacora_acciones "
        f"WHERE id > {ultimo} ORDER BY id LIMIT {MAX_LOGS_POR_CORRIDA}",
    )
    if filas:
        _subir(
            cliente,
            "interno_bitacora",
            [
                {
                    "origen_id": f["id"],
                    "instalacion": instalacion,
                    "usuario_id": f.get("usuario_id"),
                    "username": f.get("username"),
                    "rol": f.get("rol"),
                    "accion": f.get("accion") or "",
                    "entidad": f.get("entidad"),
                    "entidad_id": str(f["entidad_id"]) if f.get("entidad_id") is not None else None,
                    "detalle": f.get("detalle"),
                    "creado_en": f["creado_en"],
                    "sincronizado_en": _ahora(),
                }
                for f in filas
            ],
            "instalacion,origen_id",
        )
    print(f"interno_bitacora: {len(filas)} filas nuevas (desde id {ultimo})")
    return len(filas)


def _sincronizar_logs(url: str, cliente, instalacion: str) -> int:
    ultimo = _maximo(cliente, "interno_logs", instalacion)
    filas = _leer_interno(
        url,
        f"SELECT id, nivel, mensaje, fuente, detalle, creado_en FROM system_logs "
        f"WHERE id > {ultimo} ORDER BY id LIMIT {MAX_LOGS_POR_CORRIDA}",
    )
    if filas:
        _subir(
            cliente,
            "interno_logs",
            [
                {
                    "origen_id": f["id"],
                    "instalacion": instalacion,
                    "nivel": f.get("nivel") or "INFO",
                    "mensaje": f.get("mensaje") or "",
                    "fuente": f.get("fuente"),
                    "detalle": f.get("detalle"),
                    "creado_en": f["creado_en"],
                    "sincronizado_en": _ahora(),
                }
                for f in filas
            ],
            "instalacion,origen_id",
        )
        for fila in filas:
            print(f"  · {fila['nivel']} {fila['mensaje']} — {str(fila.get('detalle') or '')[:60]}")
    print(f"interno_logs: {len(filas)} filas nuevas (desde id {ultimo})")
    return len(filas)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sincroniza el sistema interno con Supabase.")
    parser.add_argument("--dry-run", action="store_true", help="solo muestra lo que subiría")
    parser.add_argument("--database-url", help="cadena del Postgres interno")
    args = parser.parse_args()

    load_dotenv(ENV_PORTAL)
    url = _url_interna(args.database_url)

    config = {
        "instalacion": os.getenv("INSTALACION_ID", "citab").strip() or "citab",
        "nombre": os.getenv("INSTALACION_NOMBRE", "CITAB · Clínica de los Trabajadores").strip(),
        "centro_id": int(os.getenv("CLINICA_ID", "2") or 2),
        "version": os.getenv("INSTALACION_VERSION", "").strip(),
    }

    if args.dry_run:
        _sincronizar(url, None, config, seco=True)
        print("Modo seco: no se escribió nada.")
        return

    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    # El script escribe en tablas protegidas por RLS: necesita la clave de
    # servicio (service_role). Si no está definida, se usa SUPABASE_KEY.
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_KEY", "").strip()
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_KEY", "").strip()
    )
    if not supabase_url or not supabase_key:
        sys.exit("Faltan SUPABASE_URL y SUPABASE_KEY en el .env de la raíz.")
    if os.getenv("SUPABASE_SERVICE_KEY", "").strip() == "" and os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip() == "":
        print("[aviso] No se definió SUPABASE_SERVICE_KEY; se usará SUPABASE_KEY. "
              "Si las tablas tienen RLS, la sincronización fallará: use la clave service_role.")

    from supabase import create_client

    cliente = create_client(supabase_url, supabase_key)
    _sincronizar(url, cliente, config, seco=False)
    print("Sincronización completada.")


if __name__ == "__main__":
    main()
