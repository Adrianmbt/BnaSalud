"""Panel institucional: resumen global por centro de salud.

Lo consumen las cuentas globales del portal público (`admin_sistemas` y
`director`). Agrega indicadores analíticos de citas, consultas externas,
personal, stock y emergencias / morbilidad por centro y para toda la red.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional
from unicodedata import normalize

from fastapi import APIRouter, Depends, Query

from app.api.v1.deps import exigir_rol_global
from app.api.v1.errors import db_fail
from app.core.config import settings
from app.core.database import supabase

router = APIRouter(tags=["Panel Institucional"])

# Caracas es UTC-4 todo el año (Venezuela no aplica horario de verano).
TZ = timezone(timedelta(hours=-4))
TAM_LOTE = 1000
MAX_FILAS = 100_000  # tope de seguridad para no paginar sin fin
STOCK_BAJO = 10


def _sin_tildes(valor: Any) -> str:
    texto = str(valor or "").strip().lower()
    return normalize("NFD", texto).encode("ascii", "ignore").decode("utf-8")


def _conectar_pg():
    """Conexión opcional directa a PostgreSQL si no hay Supabase o para consultas SQL."""
    db_url = (
        getattr(settings, "DATABASE_URL", None)
        or os.getenv("DATABASE_URL")
        or os.getenv("SUPABASE_DB_URI")
    )
    if not db_url:
        return None
    try:
        import psycopg2
        import psycopg2.extras

        clean_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
        conn = psycopg2.connect(clean_url, cursor_factory=psycopg2.extras.RealDictCursor)
        return conn
    except Exception:
        return None


def _traer(tabla: str, columnas: str) -> List[Dict[str, Any]]:
    """Lee una tabla completa, paginando por lotes de 1000 filas."""
    if supabase is not None:
        filas: List[Dict[str, Any]] = []
        desde = 0
        while desde < MAX_FILAS:
            try:
                lote = (
                    supabase.table(tabla)
                    .select(columnas)
                    .order("id")
                    .range(desde, desde + TAM_LOTE - 1)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                db_fail(f"consultar {tabla}")
            filas.extend(lote)
            if len(lote) < TAM_LOTE:
                break
            desde += TAM_LOTE
        return filas

    # Respaldo con conexión directa a PostgreSQL
    conn = _conectar_pg()
    if conn is not None:
        try:
            with conn.cursor() as cur:
                cur.execute(f"SELECT {columnas} FROM {tabla}")
                return [dict(r) for r in cur.fetchall()]
        except Exception:
            db_fail(f"consultar {tabla}")
        finally:
            conn.close()

    db_fail("consultar el panel")
    return []


def _traer_opcional(tabla: str, columnas: str) -> List[Dict[str, Any]]:
    """Lee una tabla opcional; si no existe o falla, retorna lista vacía sin romper."""
    if supabase is not None:
        filas: List[Dict[str, Any]] = []
        desde = 0
        while desde < MAX_FILAS:
            try:
                query = supabase.table(tabla).select(columnas)
                try:
                    query = query.order("id")
                except Exception:
                    pass
                lote = query.range(desde, desde + TAM_LOTE - 1).execute().data or []
            except Exception:
                return filas
            filas.extend(lote)
            if len(lote) < TAM_LOTE:
                break
            desde += TAM_LOTE
        return filas

    conn = _conectar_pg()
    if conn is not None:
        try:
            with conn.cursor() as cur:
                cur.execute(f"SELECT {columnas} FROM {tabla}")
                return [dict(r) for r in cur.fetchall()]
        except Exception:
            return []
        finally:
            conn.close()

    return []


def _traer_consultas() -> List[Dict[str, Any]]:
    """Carga consultas intentando traer campos de enlace a cola_atencion y cie10."""
    columnas_completas = (
        "id, paciente_id, cita_id, medico_id, especialidad, cola_id, cie10_descripcion, clinica_id, created_at"
    )
    filas = _traer_opcional("consultas", columnas_completas)
    if filas:
        return filas
    try:
        return _traer("consultas", "id, paciente_id, cita_id, medico_id, especialidad")
    except Exception:
        return []


def _traer_emergencias_resumen(instalacion: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lee el resumen de emergencias sincronizado desde el sistema interno.

    La tabla `interno_emergencias_resumen` vive en Supabase y la alimenta
    `scripts/sincronizar_interno.py` leyendo `cola_atencion` del Postgres
    interno (bnasalud).  El panel.py nunca toca bnasalud directamente.
    """
    columnas_completas = (
        "clinica_id, instalacion, clinica_nombre, total_emergencias, finalizadas, "
        "en_atencion, canceladas, prio_verde, prio_amarillo, prio_rojo, "
        "pacientes_distintos, top_cie10, actualizado_en"
    )
    filas = _traer_opcional("interno_emergencias_resumen", columnas_completas)
    if not filas:
        # Respaldo: tabla sin la columna top_cie10 (migración antigua)
        columnas_base = (
            "clinica_id, instalacion, clinica_nombre, total_emergencias, finalizadas, "
            "en_atencion, canceladas, prio_verde, prio_amarillo, prio_rojo, "
            "pacientes_distintos, actualizado_en"
        )
        filas = _traer_opcional("interno_emergencias_resumen", columnas_base)
    if instalacion:
        filas = [f for f in filas if f.get("instalacion") == instalacion]
    return filas


def _contar_por(filas: Iterable[Dict[str, Any]], clave: str) -> Dict[Any, int]:
    conteo: Dict[Any, int] = {}
    for fila in filas:
        valor = fila.get(clave)
        conteo[valor] = conteo.get(valor, 0) + 1
    return conteo


def _contar(tabla: str) -> int:
    """Cuenta filas de una tabla sin transferirlas a memoria."""
    if supabase is not None:
        try:
            res = supabase.table(tabla).select("id", count="exact", head=True).execute()
            return res.count or 0
        except Exception:
            pass

    conn = _conectar_pg()
    if conn is not None:
        try:
            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) AS total FROM {tabla}")
                row = cur.fetchone()
                return int(row["total"] if row else 0)
        except Exception:
            pass
        finally:
            conn.close()

    return 0


def _en_rango(fecha_val: Any, f_desde: Optional[str], f_hasta: Optional[str]) -> bool:
    """Verifica si una fecha/timestamp cae dentro del rango [f_desde, f_hasta]."""
    if not f_desde and not f_hasta:
        return True
    if not fecha_val:
        return True
    texto = str(fecha_val).strip()
    s = texto[:10]  # extrae YYYY-MM-DD
    if f_desde and s < f_desde:
        return False
    if f_hasta and s > f_hasta:
        return False
    return True


def _es_emergencia(ca: Dict[str, Any]) -> bool:
    """Identifica si un registro de cola_atencion corresponde a morbilidad/emergencia."""
    ruta = str(ca.get("ruta_atencion") or "").strip().upper()
    if ruta == "EMERGENCIA":
        return True
    esp = _sin_tildes(ca.get("especialidad"))
    return "emergenc" in esp


def _clasificar_estado_emergencia(ca: Dict[str, Any]) -> tuple[bool, bool, bool]:
    """Retorna (es_cancelado, es_finalizado, es_en_atencion)."""
    estado = str(ca.get("atencion_estado") or "").strip().upper()
    if estado in ("CANCELADO", "CANCELADA", "NO_ASISTIO", "NO_ASISTIÓ"):
        return True, False, False
    if estado in ("FINALIZADO", "FINALIZADA", "COMPLETADO", "ATENDIDO"):
        return False, True, False
    # RECEPCION, TRIAJE, EN_ESPERA_CONSULTA, EN_CONSULTA
    return False, False, True


def _prioridad_triaje(ca: Dict[str, Any]) -> str:
    """Estandariza la categoría de prioridad en ROJO, AMARILLO o VERDE."""
    p = str(ca.get("categoria_prioridad") or "").strip().upper()
    if "ROJ" in p or p == "1" or str(ca.get("nivel_prioridad")) == "1":
        return "ROJO"
    if "VERD" in p or p == "3" or str(ca.get("nivel_prioridad")) == "3":
        return "VERDE"
    return "AMARILLO"


def _parse_top_cie10(valor: Any) -> List[Dict[str, Any]]:
    """Normaliza el campo top_cie10 (lista o JSON string) a lista de dicts."""
    if valor is None:
        return []
    if isinstance(valor, list):
        return valor
    if isinstance(valor, str):
        try:
            import json

            parsed = json.loads(valor)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def _agregar_top_cie10(filas: List[Dict[str, Any]], limite: int = 5) -> List[Dict[str, Any]]:
    """Agrega el top CIE-10 de emergencia de todas las clínicas."""
    conteo: Dict[str, int] = {}
    for f in filas or []:
        for item in _parse_top_cie10(f.get("top_cie10")):
            diag = str(item.get("diagnostico") or "").strip()
            if not diag:
                continue
            conteo[diag] = conteo.get(diag, 0) + int(item.get("total") or 0)
    return [
        {"diagnostico": k, "total": v}
        for k, v in sorted(conteo.items(), key=lambda kv: -kv[1])[:limite]
    ]


def _top_cie10(diagnosticos: List[str], limite: int = 5) -> List[Dict[str, Any]]:
    """Calcula el top de diagnósticos CIE-10 / motivos de atención de emergencia."""
    conteo: Dict[str, int] = {}
    for diag in diagnosticos:
        texto = str(diag or "").strip()
        if not texto:
            continue
        # Capitalizar para consolidar variaciones de mayúsculas
        clave = texto[0].upper() + texto[1:].lower()
        conteo[clave] = conteo.get(clave, 0) + 1

    return [
        {"diagnostico": k, "total": v}
        for k, v in sorted(conteo.items(), key=lambda kv: -kv[1])[:limite]
    ]


@router.get("/resumen")
def resumen_panel(
    clinica_id: Optional[int] = Query(default=None, description="Filtrar por ID de clínica"),
    periodo: Optional[str] = Query(
        default=None, description="Filtro de período: hoy, semana, mes, anio, todo"
    ),
    fecha_desde: Optional[str] = Query(default=None, description="Fecha de inicio (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(default=None, description="Fecha de fin (YYYY-MM-DD)"),
    _: Dict[str, Any] = Depends(exigir_rol_global),
) -> Dict[str, Any]:
    """Resumen completo (totales y por centro) para el panel institucional."""
    clinicas = _traer("clinicas", "id, nombre, codigo, parroquia, activo")
    personal = _traer("personal", "id, clinica_id, cargo, especialidad, estado")
    total_pacientes_hc = _contar("historias_clinicas")
    citas_raw = _traer("citas", "id, paciente_id, centro_id, estado, especialidad, fecha_cita")
    consultas_raw = _traer_consultas()
    emergencias_resumen = _traer_emergencias_resumen()  # lee de interno_emergencias_resumen en Supabase
    recetas = _traer("recetas", "id, clinica_id, estado")
    stock = _traer("stock_clinica", "id, clinica_id, medicamento_id, cantidad_actual")
    usuarios = _traer("usuarios", "id, rol, activo")

    hoy_dt = datetime.now(TZ).date()
    hoy = hoy_dt.isoformat()

    # Cálculo de fechas del filtro de período
    f_desde = fecha_desde
    f_hasta = fecha_hasta
    p_norm = (periodo or "").strip().lower()
    if p_norm == "hoy":
        f_desde = hoy
        f_hasta = hoy
    elif p_norm == "semana":
        f_desde = (hoy_dt - timedelta(days=7)).isoformat()
        f_hasta = hoy
    elif p_norm == "mes":
        f_desde = (hoy_dt - timedelta(days=30)).isoformat()
        f_hasta = hoy
    elif p_norm == "anio":
        f_desde = (hoy_dt - timedelta(days=365)).isoformat()
        f_hasta = hoy

    # Filtrar citas por período si aplica
    citas = [c for c in citas_raw if _en_rango(c.get("fecha_cita"), f_desde, f_hasta)]

    # Centro de cada cita y médico para resolución de consultas
    clinica_de_cita = {c.get("id"): c.get("centro_id") for c in citas_raw}
    clinica_de_medico = {p.get("id"): p.get("clinica_id") for p in personal}

    # ── Clasificación de consultas (para evitar doble conteo con emergencias) ──
    consultas = [
        c for c in consultas_raw if _en_rango(c.get("created_at"), f_desde, f_hasta)
    ]

    consultas_prog_por_centro: Dict[Any, int] = {}
    consultas_emerg_por_centro: Dict[Any, int] = {}
    consultas_total_por_centro: Dict[Any, int] = {}
    pacientes_consulta: Dict[Any, set] = {}

    consultas_programadas: List[Dict[str, Any]] = []
    consultas_emergencia: List[Dict[str, Any]] = []

    for consulta in consultas:
        es_emerg = "emergenc" in _sin_tildes(consulta.get("especialidad"))

        centro = consulta.get("clinica_id")
        if centro is None:
            centro = clinica_de_cita.get(consulta.get("cita_id"))
        if centro is None:
            centro = clinica_de_medico.get(consulta.get("medico_id"))

        consultas_total_por_centro[centro] = consultas_total_por_centro.get(centro, 0) + 1

        paciente = consulta.get("paciente_id")
        if paciente:
            pacientes_consulta.setdefault(centro, set()).add(str(paciente))

        if es_emerg:
            consultas_emergencia.append(consulta)
            consultas_emerg_por_centro[centro] = consultas_emerg_por_centro.get(centro, 0) + 1
        else:
            consultas_programadas.append(consulta)
            consultas_prog_por_centro[centro] = consultas_prog_por_centro.get(centro, 0) + 1

    # ── Citas por centro y pacientes de citas ──
    citas_por_centro = _contar_por(citas, "centro_id")
    pacientes_cita: Dict[Any, set] = {}
    for cita in citas:
        paciente = cita.get("paciente_id")
        if paciente:
            pacientes_cita.setdefault(cita.get("centro_id"), set()).add(str(paciente))

    # ── Emergencias / Morbilidad desde interno_emergencias_resumen (Supabase) ──
    # El script sincronizar_interno.py sube aquí los datos de cola_atencion del
    # Postgres interno (bnasalud).  El filtro de período no aplica porque
    # el resumen siempre refleja el estado actual (acumulado total por clínica).
    emerg_por_centro: Dict[int, Dict[str, Any]] = {
        int(f["clinica_id"]): f for f in emergencias_resumen
    }

    total_emergencias_activas = sum(int(f.get("total_emergencias") or 0) for f in emergencias_resumen)
    total_emergencias_fin = sum(int(f.get("finalizadas") or 0) for f in emergencias_resumen)
    total_emergencias_en_aten = sum(int(f.get("en_atencion") or 0) for f in emergencias_resumen)
    total_emergencias_canc = sum(int(f.get("canceladas") or 0) for f in emergencias_resumen)
    total_prio = {
        "verde": sum(int(f.get("prio_verde") or 0) for f in emergencias_resumen),
        "amarillo": sum(int(f.get("prio_amarillo") or 0) for f in emergencias_resumen),
        "rojo": sum(int(f.get("prio_rojo") or 0) for f in emergencias_resumen),
    }
    total_pacientes_emergencia = sum(int(f.get("pacientes_distintos") or 0) for f in emergencias_resumen)

    # Personal y médicos por centro
    personal_por_centro = _contar_por(personal, "clinica_id")
    medicos_por_centro: Dict[Any, int] = {}
    for persona in personal:
        if "medic" in _sin_tildes(persona.get("cargo")) or persona.get("especialidad"):
            centro = persona.get("clinica_id")
            medicos_por_centro[centro] = medicos_por_centro.get(centro, 0) + 1

    recetas_por_centro = _contar_por(recetas, "clinica_id")

    stock_unidades: Dict[Any, int] = {}
    stock_agotados: Dict[Any, int] = {}
    stock_bajos: Dict[Any, int] = {}
    for item in stock:
        centro = item.get("clinica_id")
        cantidad = item.get("cantidad_actual") or 0
        stock_unidades[centro] = stock_unidades.get(centro, 0) + cantidad
        if cantidad <= 0:
            stock_agotados[centro] = stock_agotados.get(centro, 0) + 1
        elif cantidad <= STOCK_BAJO:
            stock_bajos[centro] = stock_bajos.get(centro, 0) + 1

    # Pacientes unificados globales (citas + consultas + emergencias del interno)
    todos_pacientes_unificados = set()
    for s in pacientes_cita.values():
        todos_pacientes_unificados.update(s)
    for s in pacientes_consulta.values():
        todos_pacientes_unificados.update(s)
    # Las emergencias del interno se cuentan aparte (cedulas distintas)
    # Sumamos como valor escalar para evitar doble conteo con pacientes Supabase
    pacientes_emergencia_total = total_pacientes_emergencia

    def centro_resumen(clinica: Dict[str, Any]) -> Dict[str, Any]:
        centro = clinica.get("id")
        citas_centro = [c for c in citas if c.get("centro_id") == centro]
        estados: Dict[str, int] = {}
        for cita in citas_centro:
            estado = _sin_tildes(cita.get("estado")) or "sin_estado"
            estados[estado] = estados.get(estado, 0) + 1
        pendientes = sum(
            total for estado, total in estados.items() if estado in ("pendiente", "confirmada")
        )
        personal_centro = personal_por_centro.get(centro, 0)
        activos = sum(
            1
            for p in personal
            if p.get("clinica_id") == centro
            and _sin_tildes(p.get("estado")) in ("activo", "", "true")
        )

        # Pacientes atendidos o citados en este centro
        pacientes_supabase = (
            pacientes_cita.get(centro, set()) | pacientes_consulta.get(centro, set())
        )
        # Pacientes de emergencia del interno (conteo del resumen sincronizado)
        er = emerg_por_centro.get(int(centro) if centro is not None else -1, {})
        pacientes_del_centro = len(pacientes_supabase) + int(er.get("pacientes_distintos") or 0)

        recetas_centro = [r for r in recetas if r.get("clinica_id") == centro]
        recetas_pendientes = sum(
            1 for r in recetas_centro if _sin_tildes(r.get("estado")) == "pendiente"
        )

        emerg_prios = {
            "verde": int(er.get("prio_verde") or 0),
            "amarillo": int(er.get("prio_amarillo") or 0),
            "rojo": int(er.get("prio_rojo") or 0),
        }

        return {
            "id": centro,
            "nombre": clinica.get("nombre") or f"Centro {centro}",
            "codigo": clinica.get("codigo"),
            "parroquia": clinica.get("parroquia"),
            "activo": clinica.get("activo", True),
            "citas": len(citas_centro),
            "citas_hoy": sum(1 for c in citas_centro if c.get("fecha_cita") == hoy),
            "citas_pendientes": pendientes,
            "citas_canceladas": estados.get("cancelada", 0),
            # Consultas programadas (evita doble conteo con emergencias)
            "consultas": consultas_prog_por_centro.get(centro, 0),
            "consultas_total": consultas_total_por_centro.get(centro, 0),
            "consultas_programadas": consultas_prog_por_centro.get(centro, 0),
            "consultas_emergencia": consultas_emerg_por_centro.get(centro, 0),
            # Métricas de Emergencias / Morbilidad (desde interno sincronizado)
            "emergencias": int(er.get("total_emergencias") or 0),
            "emergencias_finalizadas": int(er.get("finalizadas") or 0),
            "emergencias_en_atencion": int(er.get("en_atencion") or 0),
            "emergencias_canceladas": int(er.get("canceladas") or 0),
            "emergencias_por_prioridad": emerg_prios,
            "emergencias_top_cie10": _parse_top_cie10(er.get("top_cie10")),
            # Pacientes atendidos o citados (unificado)
            "pacientes": pacientes_del_centro,
            "personal": personal_centro,
            "personal_activos": activos,
            "medicos": medicos_por_centro.get(centro, 0),
            "recetas": len(recetas_centro),
            "recetas_pendientes": recetas_pendientes,
            "stock_unidades": stock_unidades.get(centro, 0),
            "stock_agotados": stock_agotados.get(centro, 0),
            "stock_bajos": stock_bajos.get(centro, 0),
            "citas_por_estado": [
                {"estado": estado, "total": total}
                for estado, total in sorted(estados.items(), key=lambda kv: -kv[1])
            ],
        }

    por_centro = [centro_resumen(c) for c in clinicas]

    estados_global = _contar_por(citas, "estado")
    especialidades = _contar_por(citas, "especialidad")
    cargos = _contar_por(personal, "cargo")
    roles = _contar_por(usuarios, "rol")

    def _top(conteo: Dict[Any, int], limite: int = 8) -> List[Dict[str, Any]]:
        return [
            {"nombre": str(nombre or "Sin dato"), "total": total}
            for nombre, total in sorted(conteo.items(), key=lambda kv: -kv[1])[:limite]
        ]

    usuarios_por_rol = []
    for rol, total in sorted(roles.items(), key=lambda kv: -kv[1]):
        activos = sum(
            1 for u in usuarios if u.get("rol") == rol and u.get("activo", True)
        )
        usuarios_por_rol.append(
            {"rol": str(rol or "sin_rol"), "total": total, "activos": activos}
        )

    total_stock = sum(stock_unidades.values())
    total_agotados = sum(stock_agotados.values())
    total_bajos = sum(stock_bajos.values())

    # Total unificado de pacientes (Supabase + emergencias del interno)
    total_pacientes_supabase = len(todos_pacientes_unificados)
    total_pacientes_unificados_num = max(
        total_pacientes_hc,
        total_pacientes_supabase + pacientes_emergencia_total,
    )

    totales_generales = {
        "centros": len(clinicas),
        "centros_activos": sum(1 for c in clinicas if c.get("activo", True)),
        "citas": len(citas),
        "citas_hoy": sum(1 for c in citas if c.get("fecha_cita") == hoy),
        "citas_pendientes": sum(
            total
            for estado, total in estados_global.items()
            if _sin_tildes(estado) in ("pendiente", "confirmada")
        ),
        "consultas": len(consultas_programadas),
        "consultas_total": len(consultas),
        "consultas_programadas": len(consultas_programadas),
        "consultas_emergencia": len(consultas_emergencia),
        "emergencias": total_emergencias_activas,
        "emergencias_finalizadas": total_emergencias_fin,
        "emergencias_en_atencion": total_emergencias_en_aten,
        "emergencias_canceladas": total_emergencias_canc,
        "emergencias_por_prioridad": total_prio,
        "emergencias_top_cie10": _agregar_top_cie10(emergencias_resumen),
        "pacientes": total_pacientes_unificados_num,
        "personal": len(personal),
        "personal_activos": sum(
            1 for p in personal if _sin_tildes(p.get("estado")) in ("activo", "", "true")
        ),
        "medicos": sum(medicos_por_centro.values()),
        "recetas": len(recetas),
        "recetas_pendientes": sum(
            1 for r in recetas if _sin_tildes(r.get("estado")) == "pendiente"
        ),
        "stock_unidades": total_stock,
        "stock_agotados": total_agotados,
        "stock_bajos": total_bajos,
    }

    # Si se especificó clinica_id por parámetro, se busca el centro correspondiente
    centro_especifico = None
    if clinica_id is not None:
        centro_especifico = next(
            (c for c in por_centro if c["id"] == clinica_id), None
        )

    return {
        "generado_en": datetime.now(TZ).isoformat(timespec="seconds"),
        "zona_horaria": "America/Caracas",
        "hoy": hoy,
        "filtro_aplicado": {
            "clinica_id": clinica_id,
            "periodo": periodo,
            "fecha_desde": f_desde,
            "fecha_hasta": f_hasta,
        },
        "centro_seleccionado": centro_especifico,
        "totales": totales_generales,
        "por_centro": por_centro,
        "citas_por_estado": [
            {"estado": str(estado or "sin_estado"), "total": total}
            for estado, total in sorted(estados_global.items(), key=lambda kv: -kv[1])
        ],
        "especialidades": _top(especialidades),
        "personal_por_cargo": [
            {"nombre": str(nombre or "Sin dato"), "total": total}
            for nombre, total in sorted(cargos.items(), key=lambda kv: -kv[1])
        ],
        "usuarios_por_rol": usuarios_por_rol,
    }
