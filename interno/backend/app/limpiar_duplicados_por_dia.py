"""Limpieza 1-vez: deja un único registro por cédula por día en cola y consultas.

Regla (aprobada): por cada (cédula, día) se conserva la PRIMERA consulta del día
y su registro de cola ligado (si lo tiene; si no, el primer registro de cola).
El resto de colas (+ su historial de estados) y consultas se eliminan.

Luego crea un índice único parcial (1 por cédula por día) para reforzar la regla
en la base de datos con las mismas condiciones que la validación del backend.

Uso:
    python -m app.limpiar_duplicados_por_dia
"""
import asyncio
import datetime
import sys

import asyncpg

from app.core.config import settings

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def _url_asyncpg() -> str:
    url = settings.DATABASE_URL
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


def _fecha_dia(valor: object) -> str:
    """Normaliza un timestamp/datetime/str a 'YYYY-MM-DD'."""
    if isinstance(valor, str):
        return valor[:10]
    return str(valor)[:10]


def _dia_date(valor: object):
    """Devuelve el objeto datetime.date de un valor date/timestamp de Postgres."""
    if isinstance(valor, datetime.date):
        return valor
    return datetime.datetime.strptime(_fecha_dia(valor), "%Y-%m-%d").date()


async def _grupos_a_procesar(conn: asyncpg.Connection) -> list[tuple[str, object]]:
    """Devuelve la lista única de (cédula, día) con duplicados en cola o consultas."""
    colas = await conn.fetch(
        """
        SELECT paciente_cedula, creado_en::date AS dia
        FROM cola_atencion
        GROUP BY paciente_cedula, creado_en::date
        HAVING COUNT(*) > 1
        """
    )
    consultas = await conn.fetch(
        """
        SELECT h.cedula AS paciente_cedula, c.created_at::date AS dia
        FROM consultas c
        JOIN historias_clinicas h ON h.id::text = c.paciente_id::text
        GROUP BY h.cedula, c.created_at::date
        HAVING COUNT(*) > 1
        """
    )
    claves = set()
    for r in list(colas) + list(consultas):
        claves.add((str(r["paciente_cedula"]), _dia_date(r["dia"])))
    return sorted(claves, key=lambda k: k[0])


async def limpiar(conn: asyncpg.Connection) -> None:
    grupos = await _grupos_a_procesar(conn)
    if not grupos:
        print("No hay días con registros duplicados en la cola ni en consultas.")
        return

    for cedula, dia in grupos:
        historias_id = None
        historia = await conn.fetchrow(
            "SELECT id FROM historias_clinicas WHERE cedula = $1", cedula
        )
        if historia:
            historias_id = historia["id"]

        # Consultas registradas ese día para esa cédula (por fecha del historial)
        consultas = []
        if historias_id:
            consultas = await conn.fetch(
                """
                SELECT id, cola_id, comprobante_ref, created_at
                FROM consultas
                WHERE paciente_id = $1 AND created_at::date = $2::date
                ORDER BY created_at ASC, id ASC
                """,
                historias_id,
                dia,
            )
        colas = await conn.fetch(
            """
            SELECT id, token, consulta_id, atencion_estado, creado_en
            FROM cola_atencion
            WHERE paciente_cedula = $1 AND creado_en::date = $2::date
            ORDER BY creado_en ASC, id ASC
            """,
            cedula,
            dia,
        )

        conservar_consulta = consultas[0] if consultas else None
        ids_consulta_a_borrar = [c["id"] for c in consultas[1:]] if consultas else []

        # Cola a conservar: la ligada a la consulta conservada, si existe; si no, la 1ª.
        conservar_cola = None
        if colas:
            conservar_cola = colas[0]
            if conservar_consulta and conservar_consulta["cola_id"] is not None:
                for c in colas:
                    if c["id"] == conservar_consulta["cola_id"]:
                        conservar_cola = c
                        break
        ids_cola_a_borrar = [c["id"] for c in colas if c["id"] != conservar_cola["id"]] if conservar_cola else [c["id"] for c in colas]

        print(f"\n=== {cedula} · {dia} ===")
        if conservar_consulta:
            print(f"  CONSERVA consulta {str(conservar_consulta['id'])[:8]} {conservar_consulta['comprobante_ref']}")
        else:
            print("  CONSERVA consulta: (ninguna ese día)")
        for c in ids_consulta_a_borrar:
            print(f"  ELIMINA consulta {str(c)[:8]}")
        if conservar_cola:
            print(f"  CONSERVA cola #{conservar_cola['id']} {conservar_cola['token']} ({conservar_cola['atencion_estado']})")
        for c in ids_cola_a_borrar:
            print(f"  ELIMINA cola #{c}")

        for cid in ids_cola_a_borrar:
            await conn.execute(
                "DELETE FROM atencion_historial_estados WHERE cola_id = $1", cid
            )
        for cid in ids_cola_a_borrar:
            await conn.execute("DELETE FROM cola_atencion WHERE id = $1", cid)
        for cid in ids_consulta_a_borrar:
            await conn.execute("DELETE FROM consultas WHERE id = $1", cid)

    # Refuerza la regla a nivel de base de datos. La zona horaria se fija de forma
    # explícita porque date(timestamptz) no es IMMUTABLE y no puede indexarse.
    await conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_cola_paciente_por_dia
        ON cola_atencion (paciente_cedula, ((creado_en AT TIME ZONE 'America/Caracas')::date))
        WHERE atencion_estado NOT IN ('CANCELADO', 'NO_ASISTIO')
        """
    )
    print("\nÍndice único parcial uq_cola_paciente_por_dia creado/verificado.")


async def main() -> None:
    conn = await asyncpg.connect(_url_asyncpg())
    try:
        async with conn.transaction():
            await limpiar(conn)
        print("\nLimpieza completada.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())