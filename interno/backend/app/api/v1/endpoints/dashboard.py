"""Dashboard Ejecutivo: KPIs analiticos para direccion y administracion."""
from datetime import date, timedelta
from unicodedata import normalize

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(tags=["Dashboard"])

TZ = "America/Caracas"


def _dedup_especialidad(rows, value_keys=None):
    """Colapsa especialidades duplicadas por diferencias de tildes, sumando todas las keys numericas."""
    if value_keys is None:
        value_keys = ["total"]
    merged: dict[str, dict] = {}
    for r in rows:
        d = dict(r)
        norm = normalize("NFD", d.get("especialidad", "")).encode("ascii", "ignore").decode("utf-8").lower().strip()
        if norm in merged:
            for k in value_keys:
                merged[norm][k] = merged[norm].get(k, 0) + (d.get(k) or 0)
        else:
            merged[norm] = d
    return sorted(merged.values(), key=lambda x: x.get(value_keys[0], 0), reverse=True)


def _rango_fechas(start_date: str | None, end_date: str | None):
    """Devuelve SQL snippet y parametros para filtrar por rango de fechas."""
    params = {}
    where = ""
    if start_date:
        where += " AND c.created_at::date >= :start_date"
        params["start_date"] = start_date
    if end_date:
        where += " AND c.created_at::date <= :end_date"
        params["end_date"] = end_date
    return where, params


# ─── SUMMARY ──────────────────────────────────────────────────────

@router.get("/summary")
async def summary(db: AsyncSession = Depends(get_db)):
    """KPIs de nivel ejecutivo para las tarjetas superiores."""
    result = await db.execute(text("""
        WITH hoy AS (
            SELECT CURRENT_DATE AS fecha
        ),
        consultas_hoy AS (
            SELECT COUNT(*) AS total
            FROM consultas c, hoy h
            WHERE c.created_at::date = h.fecha
        ),
        pacientes_en_cola AS (
            SELECT COUNT(*) AS total
            FROM cola_atencion
            WHERE atencion_estado IN ('EN_ESPERA_CONSULTA', 'EN_CONSULTA', 'TRIAJE')
        ),
        medicamentos_stock_bajo AS (
            SELECT COUNT(*) AS total
            FROM medicamentos_catalogo
            WHERE activo = TRUE AND stock_actual <= stock_minimo
        ),
        insumos_stock_bajo AS (
            SELECT COUNT(*) AS total
            FROM insumos_catalogo
            WHERE activo = TRUE AND stock_actual <= stock_minimo
        ),
        lotes_vencidos AS (
            SELECT COUNT(*) AS total
            FROM lotes
            WHERE activo = TRUE AND fecha_vencimiento < (SELECT fecha FROM hoy)
        ),
        lotes_por_vencer AS (
            SELECT COUNT(*) AS total
            FROM lotes
            WHERE activo = TRUE
              AND fecha_vencimiento >= (SELECT fecha FROM hoy)
              AND fecha_vencimiento <= (SELECT fecha FROM hoy) + INTERVAL '30 days'
        ),
        atenciones_mes AS (
            SELECT COUNT(*) AS total
            FROM cola_atencion ca
            WHERE ca.atencion_estado = 'FINALIZADO'
              AND ca.creado_en >= date_trunc('month', (SELECT fecha FROM hoy))
              AND ca.creado_en < date_trunc('month', (SELECT fecha FROM hoy)) + INTERVAL '1 month'
        ),
        atenciones_mes_ant AS (
            SELECT COUNT(*) AS total
            FROM cola_atencion ca
            WHERE ca.atencion_estado = 'FINALIZADO'
              AND ca.creado_en >= date_trunc('month', (SELECT fecha FROM hoy)) - INTERVAL '1 month'
              AND ca.creado_en < date_trunc('month', (SELECT fecha FROM hoy))
        ),
        stock_total AS (
            SELECT COALESCE(SUM(stock_actual), 0) AS total
            FROM medicamentos_catalogo WHERE activo = TRUE
        ),
        consumo_30d AS (
            SELECT COALESCE(SUM(mi.cantidad), 0) AS total
            FROM movimientos_inventario mi
            WHERE mi.tipo = 'SALIDA'
              AND mi.created_at::date >= (SELECT fecha FROM hoy) - INTERVAL '30 days'
        ),
        cobertura AS (
            SELECT
                COUNT(CASE WHEN e.id IS NOT NULL THEN 1 END) AS trabajadores,
                COUNT(CASE WHEN b.id IS NOT NULL THEN 1 END) AS beneficiarios,
                COUNT(CASE WHEN e.id IS NULL AND b.id IS NULL THEN 1 END) AS publico_general
            FROM cola_atencion ca
            LEFT JOIN historias_clinicas hc ON hc.id = ca.paciente_id
            LEFT JOIN empleados e ON e.cedula = hc.cedula
            LEFT JOIN beneficiarios b ON b.cedula = hc.cedula
            WHERE ca.atencion_estado = 'FINALIZADO'
              AND ca.creado_en >= date_trunc('month', (SELECT fecha FROM hoy))
              AND ca.creado_en < date_trunc('month', (SELECT fecha FROM hoy)) + INTERVAL '1 month'
        ),
        promedio_diario_mes AS (
            SELECT
                CASE
                    WHEN EXTRACT(DAY FROM (SELECT fecha FROM hoy)) > 1
                    THEN ROUND(am.total::numeric / (EXTRACT(DAY FROM (SELECT fecha FROM hoy)) - 1), 1)
                    ELSE 0
                END AS promedio
            FROM atenciones_mes am
        )
        SELECT
            ch.total AS consultas_hoy,
            pc.total AS pacientes_en_cola,
            msb.total AS meds_stock_bajo,
            isb.total AS ins_stock_bajo,
            lv.total AS lotes_vencidos,
            lpv.total AS lotes_por_vencer,
            am.total AS total_atenciones_mes,
            CASE
                WHEN ama.total > 0 THEN ROUND(((am.total - ama.total)::numeric / ama.total) * 100, 1)
                ELSE 0
            END AS variacion_atenciones_pct,
            CASE
                WHEN c30.total > 0 THEN ROUND(st.total::numeric / (c30.total / 30.0), 1)
                ELSE st.total
            END AS dias_autonomia_inventario_promedio,
            CASE
                WHEN (st.total + msb.total + isb.total) > 0
                THEN ROUND((msb.total + isb.total)::numeric / NULLIF(st.total + msb.total + isb.total, 0) * 100, 1)
                ELSE 0
            END AS porcentaje_insumos_criticos,
            cb.trabajadores,
            cb.beneficiarios,
            cb.publico_general,
            pdm.promedio AS promedio_diario_mes,
            CASE
                WHEN pdm.promedio > 0 AND ch.total > 0
                THEN ROUND(((ch.total - pdm.promedio)::numeric / pdm.promedio) * 100, 1)
                ELSE 0
            END AS variacion_vs_promedio_diario
        FROM consultas_hoy ch, pacientes_en_cola pc,
             medicamentos_stock_bajo msb, insumos_stock_bajo isb,
             lotes_vencidos lv, lotes_por_vencer lpv,
             atenciones_mes am, atenciones_mes_ant ama,
             stock_total st, consumo_30d c30, cobertura cb,
             promedio_diario_mes pdm
    """))
    r = result.mappings().first()
    if not r:
        return {}
    d = dict(r)
    d["cobertura_social"] = {
        "trabajadores": d.pop("trabajadores", 0),
        "beneficiarios": d.pop("beneficiarios", 0),
        "publico_general": d.pop("publico_general", 0),
    }
    return d


# ─── SERVICIOS POR CENTROS ────────────────────────────────────────

@router.get("/servicios-centros")
async def servicios_centros(
    centro_id: str = Query(default="general"),
    db: AsyncSession = Depends(get_db),
):
    """Servicios y demanda por centro de salud."""
    centro_filter = ""
    params: dict = {}
    if centro_id and centro_id != "general":
        centro_filter = " AND ca.clinica_id = :clinica_id"
        # Resolver el centro por código desde la DB (los ids legacy 1-6 y los
        # nuevos 13-18 conviven; se prefiere el registro más reciente).
        codigo = {
            "citab": "CITAB",
            "clinica_mujer": "CMUJER",
            "clinica_ninos": "CNINOS",
            "oncologico": "OMARUJA",
            "adulto_mayor": "CAMAYOR",
            "jornadas": "JORNADAS",
        }.get(centro_id)
        params["clinica_id"] = 0
        if codigo:
            fila = (await db.execute(
                text(
                    "SELECT id FROM clinicas "
                    "WHERE codigo = :cod OR codigo = 'CLN-' || :cod "
                    "ORDER BY CASE WHEN codigo = :cod THEN 1 ELSE 2 END, id DESC LIMIT 1"
                ),
                {"cod": codigo},
            )).first()
            if fila:
                params["clinica_id"] = fila[0]

    # 1. Top motivos de consulta por centro (reemplaza CIE-10 que no es relevante por centro)
    r1 = (await db.execute(text(f"""
        SELECT
            COALESCE(NULLIF(c.motivo_consulta, ''), 'Sin especificar') AS motivo,
            COUNT(*) AS total
        FROM consultas c
        INNER JOIN cola_atencion ca ON ca.id::text = c.cola_id::text
        WHERE c.motivo_consulta IS NOT NULL AND c.motivo_consulta != ''
          {centro_filter}
        GROUP BY c.motivo_consulta
        ORDER BY total DESC
        LIMIT 5
    """), params)).mappings().all()

    # 2. Capacidad vs atendidos por clinica
    r2 = (await db.execute(text(f"""
        SELECT
            cl.nombre AS clinica,
            COUNT(*) AS total_atendidos,
            COUNT(CASE WHEN ca.ruta_atencion = 'CITA' THEN 1 END) AS citas,
            COUNT(CASE WHEN ca.ruta_atencion = 'EMERGENCIA' THEN 1 END) AS emergencias
        FROM cola_atencion ca
        LEFT JOIN clinicas cl ON cl.id = ca.clinica_id
        WHERE ca.atencion_estado = 'FINALIZADO'
          {centro_filter}
        GROUP BY cl.nombre
        ORDER BY total_atendidos DESC
    """), params)).mappings().all()

    # 3. Cobertura por centro (tipo de paciente)
    r3 = (await db.execute(text(f"""
        SELECT
            COALESCE(cl.nombre, 'Sin asignar') AS clinica,
            COUNT(CASE WHEN e.id IS NOT NULL THEN 1 END) AS trabajadores,
            COUNT(CASE WHEN b.id IS NOT NULL THEN 1 END) AS beneficiarios,
            COUNT(CASE WHEN e.id IS NULL AND b.id IS NULL THEN 1 END) AS publico_general
        FROM cola_atencion ca
        LEFT JOIN clinicas cl ON cl.id = ca.clinica_id
        LEFT JOIN historias_clinicas hc ON hc.id = ca.paciente_id
        LEFT JOIN empleados e ON e.cedula = hc.cedula
        LEFT JOIN beneficiarios b ON b.cedula = hc.cedula
        WHERE ca.atencion_estado = 'FINALIZADO'
          {centro_filter}
        GROUP BY cl.nombre
        ORDER BY SUM(CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END +
                     CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END +
                     CASE WHEN e.id IS NULL AND b.id IS NULL THEN 1 ELSE 0 END) DESC
    """), params)).mappings().all()

    # 4. Médicos por centro (derivado de consultas → cola_atencion)
    r4 = (await db.execute(text(f"""
        SELECT
            COALESCE(cl.nombre, 'Sin asignar') AS clinica,
            COUNT(DISTINCT ca.medico_id) AS total_medicos,
            COUNT(*) AS total_consultas,
            COUNT(DISTINCT c.medico_id) AS medicos_en_consultas
        FROM cola_atencion ca
        LEFT JOIN clinicas cl ON cl.id = ca.clinica_id
        INNER JOIN consultas c ON c.cola_id::text = ca.id::text
        WHERE ca.atencion_estado = 'FINALIZADO'
          AND ca.medico_id IS NOT NULL
          {centro_filter}
        GROUP BY cl.nombre
        ORDER BY total_medicos DESC
    """), params)).mappings().all()

    # 5. Especialidades por centro
    r5 = (await db.execute(text(f"""
        SELECT
            COALESCE(cl.nombre, 'Sin asignar') AS clinica,
            COALESCE(NULLIF(c.especialidad, ''), 'Sin especialidad') AS especialidad,
            COUNT(*) AS consultas
        FROM cola_atencion ca
        LEFT JOIN clinicas cl ON cl.id = ca.clinica_id
        INNER JOIN consultas c ON c.cola_id::text = ca.id::text
        WHERE ca.atencion_estado = 'FINALIZADO'
          {centro_filter}
        GROUP BY cl.nombre, c.especialidad
        ORDER BY cl.nombre, consultas DESC
    """), params)).mappings().all()

    # Agrupar especialidades por clínica
    esp_por_clinica = {}
    for row in r5:
        clinica = row["clinica"]
        if clinica not in esp_por_clinica:
            esp_por_clinica[clinica] = []
        esp_por_clinica[clinica].append({
            "especialidad": row["especialidad"],
            "consultas": row["consultas"],
        })

    return {
        "top_motivos_por_centro": [dict(x) for x in r1],
        "capacidad_vs_atendidos": [dict(x) for x in r2],
        "cobertura_por_centro": [dict(x) for x in r3],
        "medicos_por_centro": [dict(x) for x in r4],
        "especialidades_por_clinica": esp_por_clinica,
    }


# ─── COMPRAS E INVENTARIO ─────────────────────────────────────────

@router.get("/compras-inventario")
async def compras_inventario(db: AsyncSession = Depends(get_db)):
    """Inteligencia de cadena de suministro y compras."""
    # 1. Autonomia por producto (medicamentos + insumos)
    autonomia_meds = (await db.execute(text("""
        SELECT
            mc.id,
            mc.nombre,
            mc.stock_actual,
            mc.stock_minimo,
            'medicamento' AS tipo,
            COALESCE(consumo.total_consumo, 0) AS consumo_30d,
            CASE
                WHEN COALESCE(consumo.total_consumo, 0) > 0
                THEN ROUND(mc.stock_actual::numeric / (consumo.total_consumo / 30.0), 1)
                ELSE mc.stock_actual
            END AS dias_autonomia
        FROM medicamentos_catalogo mc
        LEFT JOIN (
            SELECT
                (elem->>'insumo_id')::int AS producto_id,
                SUM((elem->>'cantidad')::int) AS total_consumo
            FROM consultas c,
                 LATERAL jsonb_array_elements(c.insumos) AS elem
            WHERE c.insumos IS NOT NULL
              AND elem->>'insumo_id' IS NOT NULL
              AND c.created_at::date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY elem->>'insumo_id'
        ) consumo ON consumo.producto_id = mc.id
        WHERE mc.activo = TRUE
        ORDER BY dias_autonomia ASC NULLS FIRST
        LIMIT 15
    """))).mappings().all()

    autonomia_ins = (await db.execute(text("""
        SELECT
            ic.id,
            ic.nombre,
            ic.stock_actual,
            ic.stock_minimo,
            'insumo' AS tipo,
            COALESCE(consumo.total_consumo, 0) AS consumo_30d,
            CASE
                WHEN COALESCE(consumo.total_consumo, 0) > 0
                THEN ROUND(ic.stock_actual::numeric / (consumo.total_consumo / 30.0), 1)
                ELSE ic.stock_actual
            END AS dias_autonomia
        FROM insumos_catalogo ic
        LEFT JOIN (
            SELECT
                (elem->>'insumo_id')::int AS producto_id,
                SUM((elem->>'cantidad')::int) AS total_consumo
            FROM consultas c,
                 LATERAL jsonb_array_elements(c.insumos) AS elem
            WHERE c.insumos IS NOT NULL
              AND elem->>'insumo_id' IS NOT NULL
              AND c.created_at::date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY elem->>'insumo_id'
        ) consumo ON consumo.producto_id = ic.id
        WHERE ic.activo = TRUE
        ORDER BY dias_autonomia ASC NULLS FIRST
        LIMIT 15
    """))).mappings().all()

    # 2. Orden de compra sugerida (stock <= minimo)
    orden_compra = (await db.execute(text("""
        SELECT id, nombre, stock_actual, stock_minimo, 'medicamento' AS tipo,
               (stock_minimo * 2 - stock_actual) AS cantidad_sugerida
        FROM medicamentos_catalogo
        WHERE activo = TRUE AND stock_actual <= stock_minimo
        UNION ALL
        SELECT id, nombre, stock_actual, stock_minimo, 'insumo' AS tipo,
               (stock_minimo * 2 - stock_actual) AS cantidad_sugerida
        FROM insumos_catalogo
        WHERE activo = TRUE AND stock_actual <= stock_minimo
        ORDER BY cantidad_sugerida DESC
    """))).mappings().all()

    # 3. Valor de riesgo por vencimiento (30, 60, 90 dias)
    riesgo_30 = (await db.execute(text("""
        SELECT COALESCE(SUM(l.cantidad), 0) AS total
        FROM lotes l
        WHERE l.activo = TRUE
          AND l.fecha_vencimiento >= CURRENT_DATE
          AND l.fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days'
    """))).scalar() or 0

    riesgo_60 = (await db.execute(text("""
        SELECT COALESCE(SUM(l.cantidad), 0) AS total
        FROM lotes l
        WHERE l.activo = TRUE
          AND l.fecha_vencimiento > CURRENT_DATE + INTERVAL '30 days'
          AND l.fecha_vencimiento <= CURRENT_DATE + INTERVAL '60 days'
    """))).scalar() or 0

    riesgo_90 = (await db.execute(text("""
        SELECT COALESCE(SUM(l.cantidad), 0) AS total
        FROM lotes l
        WHERE l.activo = TRUE
          AND l.fecha_vencimiento > CURRENT_DATE + INTERVAL '60 days'
          AND l.fecha_vencimiento <= CURRENT_DATE + INTERVAL '90 days'
    """))).scalar() or 0

    return {
        "autonomia_por_producto": [dict(x) for x in list(autonomia_meds) + list(autonomia_ins)],
        "orden_compra_sugerida": [dict(x) for x in orden_compra],
        "valor_riesgo_vencimiento": {
            "dias_30": int(riesgo_30),
            "dias_60": int(riesgo_60),
            "dias_90": int(riesgo_90),
        },
    }


# ─── MEDICOS ──────────────────────────────────────────────────────

@router.get("/medicos")
async def medicos(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    medico_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """KPIs de rendimiento medico."""
    where_extra, params_extra = _rango_fechas(start_date, end_date)
    medico_filter = ""
    if medico_id:
        medico_filter = " AND c.medico_id = :medico_id"
        params_extra["medico_id"] = medico_id

    # 1. Total consultas + duracion promedio
    r1 = (await db.execute(text(f"""
        SELECT
            COUNT(*) AS total_consultas,
            COALESCE(AVG(
                EXTRACT(EPOCH FROM (ca.fin_en - ca.iniciado_en)) / 60
            ), 0) AS duracion_promedio_min
        FROM consultas c
        LEFT JOIN cola_atencion ca ON ca.id::text = c.cola_id::text
        WHERE 1=1 {where_extra} {medico_filter}
    """), params_extra)).mappings().first()

    # 2. Top 5 motivos de consulta
    r2 = (await db.execute(text(f"""
        SELECT
            COALESCE(NULLIF(c.motivo_consulta, ''), 'Sin especificar') AS motivo,
            COUNT(*) AS total
        FROM consultas c
        WHERE c.motivo_consulta IS NOT NULL AND c.motivo_consulta != ''
          {where_extra} {medico_filter}
        GROUP BY c.motivo_consulta
        ORDER BY total DESC
        LIMIT 5
    """), params_extra)).mappings().all()

    # 3. Consultas por especialidad (para pie chart) — deduplicado en Python
    r3 = (await db.execute(text(f"""
        SELECT
            COALESCE(NULLIF(c.especialidad, ''), 'Sin especialidad') AS especialidad,
            COUNT(*) AS total
        FROM consultas c
        WHERE 1=1 {where_extra} {medico_filter}
        GROUP BY c.especialidad
        ORDER BY total DESC
    """), params_extra)).mappings().all()

    # 4. Consultas por hora del dia
    r4 = (await db.execute(text(f"""
        SELECT
            EXTRACT(HOUR FROM c.created_at)::int AS hora,
            COUNT(*) AS total
        FROM consultas c
        WHERE 1=1 {where_extra} {medico_filter}
        GROUP BY EXTRACT(HOUR FROM c.created_at)
        ORDER BY hora
    """), params_extra)).mappings().all()

    # 5. Tasa de remision general
    r5 = (await db.execute(text(f"""
        SELECT
            COUNT(*) AS total,
            COUNT(CASE WHEN ca.derivado_a_especialista = TRUE THEN 1 END) AS remitidos
        FROM consultas c
        LEFT JOIN cola_atencion ca ON ca.id::text = c.cola_id::text
        WHERE 1=1 {where_extra} {medico_filter}
    """), params_extra)).mappings().first()

    # 6. Tasa de remision por especialidad
    r6 = (await db.execute(text(f"""
        SELECT
            COALESCE(NULLIF(c.especialidad, ''), 'Sin especialidad') AS especialidad,
            COUNT(*) AS total_consultas,
            COUNT(CASE WHEN ca.derivado_a_especialista = TRUE THEN 1 END) AS remitidos,
            ROUND(
                (COUNT(CASE WHEN ca.derivado_a_especialista = TRUE THEN 1 END)::numeric
                 / NULLIF(COUNT(*), 0)) * 100, 1
            ) AS tasa_remision
        FROM consultas c
        LEFT JOIN cola_atencion ca ON ca.id::text = c.cola_id::text
        WHERE 1=1 {where_extra} {medico_filter}
        GROUP BY c.especialidad
        ORDER BY total_consultas DESC
    """), params_extra)).mappings().all()

    return {
        "total_consultas": r1["total_consultas"],
        "duracion_promedio_min": round(float(r1["duracion_promedio_min"] or 0), 1),
        "top_motivos": [dict(x) for x in r2],
        "por_especialidad": _dedup_especialidad(r3),
        "consultas_por_hora": [dict(x) for x in r4],
        "tasa_remision": round(
            (r5["remitidos"] / r5["total"] * 100) if r5["total"] else 0, 1
        ),
        "remision_por_especialidad": _dedup_especialidad(r6, value_keys=["total_consultas", "remitidos"]),
    }


# ─── PACIENTES ────────────────────────────────────────────────────

@router.get("/pacientes")
async def pacientes(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """KPIs de demografia y flujo de pacientes."""
    date_filter = ""
    params = {}
    if start_date:
        date_filter += " AND ca.creado_en::date >= :start_date"
        params["start_date"] = start_date
    if end_date:
        date_filter += " AND ca.creado_en::date <= :end_date"
        params["end_date"] = end_date

    # 1. Total pacientes procesados (FINALIZADO)
    r1 = (await db.execute(text(f"""
        SELECT COUNT(*) AS total
        FROM cola_atencion ca
        WHERE ca.atencion_estado = 'FINALIZADO' {date_filter}
    """), params)).scalar() or 0

    # 2. Breakdown por categoria
    r2 = (await db.execute(text(f"""
        SELECT
            CASE
                WHEN e.id IS NOT NULL THEN 'Trabajador'
                WHEN b.id IS NOT NULL THEN 'Beneficiario'
                ELSE 'Publico General'
            END AS categoria,
            COUNT(*) AS total
        FROM cola_atencion ca
        LEFT JOIN historias_clinicas hc ON hc.id = ca.paciente_id
        LEFT JOIN empleados e ON e.cedula = hc.cedula
        LEFT JOIN beneficiarios b ON b.cedula = hc.cedula
        WHERE ca.atencion_estado = 'FINALIZADO' {date_filter}
        GROUP BY categoria
        ORDER BY total DESC
    """), params)).mappings().all()

    # 3. Breakdown por ruta
    r3 = (await db.execute(text(f"""
        SELECT
            COALESCE(ca.ruta_atencion::text, 'SIN RUTA') AS ruta,
            COUNT(*) AS total
        FROM cola_atencion ca
        WHERE ca.atencion_estado = 'FINALIZADO' {date_filter}
        GROUP BY ca.ruta_atencion
    """), params)).mappings().all()

    # 4. Eficiencia de asistencia
    r4 = (await db.execute(text(f"""
        SELECT
            ca.atencion_estado AS estado,
            COUNT(*) AS total
        FROM cola_atencion ca
        WHERE ca.atencion_estado IN ('FINALIZADO', 'CANCELADO', 'NO_ASISTIO')
          {date_filter}
        GROUP BY ca.atencion_estado
    """), params)).mappings().all()

    # 5. Estado actual de la cola (tiempo real)
    r5 = (await db.execute(text("""
        SELECT
            ca.atencion_estado AS estado,
            COUNT(*) AS total
        FROM cola_atencion ca
        WHERE ca.atencion_estado IN ('RECEPCION', 'TRIAJE', 'EN_ESPERA_CONSULTA', 'EN_CONSULTA')
        GROUP BY ca.atencion_estado
    """))).mappings().all()

    # 6. Pacientes por clinica
    r6 = (await db.execute(text(f"""
        SELECT
            cl.nombre AS clinica,
            COUNT(*) AS total
        FROM cola_atencion ca
        LEFT JOIN clinicas cl ON cl.id = ca.clinica_id
        WHERE ca.atencion_estado = 'FINALIZADO' {date_filter}
        GROUP BY cl.nombre
        ORDER BY total DESC
    """), params)).mappings().all()

    return {
        "total_procesados": r1,
        "por_categoria": [dict(x) for x in r2],
        "por_ruta": [dict(x) for x in r3],
        "eficiencia_asistencia": [dict(x) for x in r4],
        "cola_actual": [dict(x) for x in r5],
        "por_clinica": [dict(x) for x in r6],
    }


# ─── INVENTARIO ───────────────────────────────────────────────────

@router.get("/inventario")
async def inventario(db: AsyncSession = Depends(get_db)):
    """KPIs de inventario, alertas de stock y vencimiento."""
    # 1. Alertas criticas de stock (medicamentos)
    meds_bajo = (await db.execute(text("""
        SELECT id, nombre, stock_actual, stock_minimo,
               ROUND((stock_actual::numeric / NULLIF(stock_minimo, 0)) * 100, 1) AS pct
        FROM medicamentos_catalogo
        WHERE activo = TRUE AND stock_actual <= stock_minimo
        ORDER BY pct ASC NULLS FIRST
        LIMIT 15
    """))).mappings().all()

    # 2. Alertas criticas de stock (insumos)
    ins_bajo = (await db.execute(text("""
        SELECT id, nombre, stock_actual, stock_minimo,
               ROUND((stock_actual::numeric / NULLIF(stock_minimo, 0)) * 100, 1) AS pct
        FROM insumos_catalogo
        WHERE activo = TRUE AND stock_actual <= stock_minimo
        ORDER BY pct ASC NULLS FIRST
        LIMIT 15
    """))).mappings().all()

    # 3. Lotes vencidos
    lotes_vencidos = (await db.execute(text("""
        SELECT l.id, l.codigo_lote, l.fecha_vencimiento,
               COALESCE(mc.nombre, ic.nombre) AS producto,
               l.cantidad
        FROM lotes l
        LEFT JOIN medicamentos_catalogo mc ON mc.id = l.medicamento_id
        LEFT JOIN insumos_catalogo ic ON ic.id = l.insumo_id
        WHERE l.activo = TRUE AND l.fecha_vencimiento < CURRENT_DATE
        ORDER BY l.fecha_vencimiento ASC
    """))).mappings().all()

    # 4. Lotes proximos a vencer (30 dias)
    lotes_por_vencer = (await db.execute(text("""
        SELECT l.id, l.codigo_lote, l.fecha_vencimiento,
               COALESCE(mc.nombre, ic.nombre) AS producto,
               l.cantidad
        FROM lotes l
        LEFT JOIN medicamentos_catalogo mc ON mc.id = l.medicamento_id
        LEFT JOIN insumos_catalogo ic ON ic.id = l.insumo_id
        WHERE l.activo = TRUE
          AND l.fecha_vencimiento >= CURRENT_DATE
          AND l.fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days'
        ORDER BY l.fecha_vencimiento ASC
    """))).mappings().all()

    # 5. Medicamentos mas aplicados
    meds_aplicados = (await db.execute(text("""
        SELECT
            elem->>'nombre' AS nombre,
            SUM((elem->>'cantidad')::int) AS total_cantidad
        FROM consultas c,
             LATERAL jsonb_array_elements(c.insumos) AS elem
        WHERE c.insumos IS NOT NULL
          AND elem->>'insumo_id' IS NOT NULL
          AND elem->>'nombre' IS NOT NULL
        GROUP BY elem->>'nombre'
        ORDER BY total_cantidad DESC
        LIMIT 10
    """))).mappings().all()

    # 6. Tendencia de movimientos (ultimos 30 dias)
    movimientos = (await db.execute(text("""
        SELECT
            mi.tipo,
            SUM(mi.cantidad) AS total_cantidad,
            COUNT(*) AS total_movimientos
        FROM movimientos_inventario mi
        WHERE mi.created_at::date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY mi.tipo
    """))).mappings().all()

    # 7. Valor total del inventario
    valor_meds = (await db.execute(text("""
        SELECT COALESCE(SUM(stock_actual), 0) AS total
        FROM medicamentos_catalogo WHERE activo = TRUE
    """))).scalar() or 0

    valor_ins = (await db.execute(text("""
        SELECT COALESCE(SUM(stock_actual), 0) AS total
        FROM insumos_catalogo WHERE activo = TRUE
    """))).scalar() or 0

    return {
        "medicamentos_stock_bajo": [dict(x) for x in meds_bajo],
        "insumos_stock_bajo": [dict(x) for x in ins_bajo],
        "lotes_vencidos": [dict(x) for x in lotes_vencidos],
        "lotes_por_vencer": [dict(x) for x in lotes_por_vencer],
        "meds_aplicados": [dict(x) for x in meds_aplicados],
        "movimientos_30d": [dict(x) for x in movimientos],
        "stock_total_medicamentos": int(valor_meds),
        "stock_total_insumos": int(valor_ins),
    }
