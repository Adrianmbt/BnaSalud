"""Certificación de horarios por semana concreta (Recursos Humanos).

La certificación anterior marcaba la plantilla de `agenda_medicos` con un
booleano, así que certificar una vez abría todas las semanas. Aquí se guarda
una fila por médico y semana (siempre con el lunes como referencia) en
`agenda_certificaciones_semana`, que es la fuente de verdad para saber si
recepción puede asignar días de esa semana concreta.

Sin Alembic: el esquema canónico está en
`backend/migrations/021_agenda_certificaciones_semana.sql`; `asegurar_tabla`
lo crea de forma perezosa para que un despliegue sin la migración aplicada no
deje la agenda inutilizable.
"""
from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

TABLA = "public.agenda_certificaciones_semana"

# DDL idempotente una sola vez por proceso.
_tabla_lista = False


async def asegurar_tabla(db: AsyncSession) -> None:
    """Crea la tabla de certificaciones semanales si todavía no existe."""
    global _tabla_lista
    if _tabla_lista:
        return
    await db.execute(
        text(
            f"CREATE TABLE IF NOT EXISTS {TABLA} ("
            "  id BIGSERIAL PRIMARY KEY,"
            "  medico_id INTEGER NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,"
            "  semana_desde DATE NOT NULL,"
            "  semana_hasta DATE NOT NULL,"
            "  dias_certificados SMALLINT NOT NULL DEFAULT 0,"
            "  certificado_por TEXT,"
            "  certificado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),"
            "  CONSTRAINT agenda_certificaciones_semana_unica "
            "    UNIQUE (medico_id, semana_desde),"
            "  CONSTRAINT agenda_certificaciones_semana_lunes "
            "    CHECK (EXTRACT(ISODOW FROM semana_desde) = 1),"
            "  CONSTRAINT agenda_certificaciones_semana_rango "
            "    CHECK (semana_hasta >= semana_desde)"
            ")"
        )
    )
    await db.execute(
        text(
            f"CREATE INDEX IF NOT EXISTS ix_agenda_cert_semana_semana "
            f"ON {TABLA} (semana_desde)"
        )
    )
    await db.commit()
    _tabla_lista = True


async def semana_certificada(
    db: AsyncSession, medico_id: int, inicio_semana: date
) -> bool:
    """True si el médico tiene certificada esa semana (lunes `inicio_semana`)."""
    await asegurar_tabla(db)
    fila = (
        await db.execute(
            text(
                f"SELECT 1 FROM {TABLA} "
                "WHERE medico_id = :mid AND semana_desde = :ini LIMIT 1"
            ),
            {"mid": medico_id, "ini": inicio_semana},
        )
    ).first()
    return fila is not None


async def semanas_certificadas(
    db: AsyncSession, medico_id: int, desde: date, hasta: date
) -> set[date]:
    """Semanas (lunes) certificadas del médico entre dos fechas."""
    await asegurar_tabla(db)
    return set(
        (
            await db.execute(
                text(
                    f"SELECT semana_desde FROM {TABLA} "
                    "WHERE medico_id = :mid AND semana_desde BETWEEN :desde AND :hasta"
                ),
                {"mid": medico_id, "desde": desde, "hasta": hasta},
            )
        ).scalars()
    )


async def registrar_certificacion(
    db: AsyncSession,
    medico_id: int,
    inicio_semana: date,
    dias_certificados: int,
    certificado_por: str,
) -> None:
    """Registra o actualiza la certificación del médico para esa semana."""
    await asegurar_tabla(db)
    await db.execute(
        text(
            f"INSERT INTO {TABLA} "
            "  (medico_id, semana_desde, semana_hasta, dias_certificados, "
            "   certificado_por, certificado_en) "
            "VALUES (:mid, :ini, :fin, :dias, :por, NOW()) "
            "ON CONFLICT (medico_id, semana_desde) DO UPDATE SET "
            "  semana_hasta = EXCLUDED.semana_hasta, "
            "  dias_certificados = EXCLUDED.dias_certificados, "
            "  certificado_por = EXCLUDED.certificado_por, "
            "  certificado_en = NOW()"
        ),
        {
            "mid": medico_id,
            "ini": inicio_semana,
            "fin": inicio_semana + timedelta(days=4),
            "dias": dias_certificados,
            "por": certificado_por,
        },
    )
