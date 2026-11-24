"""Semilla de citas de prueba para el flujo de remisión por turnos y postergación.

Genera datos para probar sin depender de producción:

- Citas de HOY con su registro en `cola_atencion` para especialistas que tienen
  usuario de login, de modo que se pueda probar "Postponer citas restantes"
  desde la interfaz del especialista.
- Citas en las semanas siguientes, asignadas solo a los días en que el doctor
  tiene agenda (los horarios cambian cuando RRHH avisa al admin de sistemas).
- Un reporte de capacidad por semana y por médico (cupos totales, ocupados y
  libres) para verificar que la semana tiene cupo disponible.

Las citas se agendan por semanas: al consolidarse el horario de la semana, los
pacientes se reparten en los días que atiende cada doctor. `_crear_cita` lee la
agenda vigente en cada corrida, así que si el admin cambia el horario y se
vuelve a ejecutar la semilla, las citas nuevas van a los días correctos.

Es idempotente: no duplica pacientes (por cédula) ni citas demo del mismo
paciente en la misma fecha, y no modifica horarios ni citas existentes.

Uso:
    python -m app.seed_citas_demo
"""
import asyncio
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings

SLOT_MINUTOS = 30
MAX_MEDICOS = 3
CITAS_HOY_POR_MEDICO = 2
CITAS_POR_MEDICO_SEMANA = 2
SEMANAS_SEMILLA = 4  # semana actual + 3 siguientes

PACIENTES_DEMO = [
    {
        "cedula": "90000101",
        "nombre_completo": "Laura",
        "apellido": "Méndez Demo",
        "telefono": "0414-9000101",
        "tipo_sangre": "O+",
        "numero_historia": "HC-DEMO-0001",
    },
    {
        "cedula": "90000102",
        "nombre_completo": "Jorge",
        "apellido": "Salas Demo",
        "telefono": "0414-9000102",
        "tipo_sangre": "A+",
        "numero_historia": "HC-DEMO-0002",
    },
    {
        "cedula": "90000103",
        "nombre_completo": "Carmen",
        "apellido": "Rivas Demo",
        "telefono": "0414-9000103",
        "tipo_sangre": "B+",
        "numero_historia": "HC-DEMO-0003",
    },
    {
        "cedula": "90000104",
        "nombre_completo": "Pedro",
        "apellido": "Aguilar Demo",
        "telefono": "0414-9000104",
        "tipo_sangre": "AB+",
        "numero_historia": "HC-DEMO-0004",
    },
    {
        "cedula": "90000105",
        "nombre_completo": "Daniela",
        "apellido": "Suárez Demo",
        "telefono": "0414-9000105",
        "tipo_sangre": "O-",
        "numero_historia": "HC-DEMO-0005",
    },
    {
        "cedula": "90000106",
        "nombre_completo": "Luis",
        "apellido": "Moreno Demo",
        "telefono": "0414-9000106",
        "tipo_sangre": "A-",
        "numero_historia": "HC-DEMO-0006",
    },
    {
        "cedula": "90000107",
        "nombre_completo": "Gabriela",
        "apellido": "Paredes Demo",
        "telefono": "0414-9000107",
        "tipo_sangre": "B-",
        "numero_historia": "HC-DEMO-0007",
    },
    {
        "cedula": "90000108",
        "nombre_completo": "Andrés",
        "apellido": "Rojas Demo",
        "telefono": "0414-9000108",
        "tipo_sangre": "AB-",
        "numero_historia": "HC-DEMO-0008",
    },
]


def _slots(hora_inicio, hora_fin):
    """Inicios de franja de SLOT_MINUTOS dentro del turno."""
    inicio = datetime.combine(date.min, hora_inicio)
    fin = datetime.combine(date.min, hora_fin)
    if fin <= inicio:
        fin = inicio + timedelta(minutes=SLOT_MINUTOS)
    paso = timedelta(minutes=SLOT_MINUTOS)
    cur = inicio
    while cur + paso <= fin:
        yield cur.time()
        cur += paso


async def _paciente_id(db, paciente: dict) -> str:
    fila = (
        await db.execute(
            text("SELECT id FROM historias_clinicas WHERE cedula = :c"),
            {"c": paciente["cedula"]},
        )
    ).first()
    if fila:
        return str(fila[0])

    insertado = (
        await db.execute(
            text(
                "INSERT INTO historias_clinicas "
                "(id, tipo_cedula, cedula, nombre_completo, apellido, telefono, "
                " tipo_sangre, numero_historia) "
                "VALUES (gen_random_uuid(), 'V', :ced, :nom, :ape, :tel, :ts, :nh) "
                "RETURNING id"
            ),
            {
                "ced": paciente["cedula"],
                "nom": paciente["nombre_completo"],
                "ape": paciente["apellido"],
                "tel": paciente["telefono"],
                "ts": paciente["tipo_sangre"],
                "nh": paciente["numero_historia"],
            },
        )
    ).scalar_one()
    print(f"[ok] paciente demo {paciente['cedula']} {paciente['nombre_completo']}")
    return str(insertado)


async def _agenda_especialistas(db) -> dict:
    """Agenda vigente por médico: día de la semana -> turnos."""
    filas = (
        await db.execute(
            text(
                "SELECT p.id AS medico_id, COALESCE(p.especialidad, '') AS especialidad, "
                "       a.dia_semana, t.id AS turno_id, t.nombre AS turno_nombre, "
                "       t.hora_inicio, t.hora_fin "
                "FROM personal p "
                "JOIN agenda_medicos a ON a.medico_id = p.id AND a.activo = TRUE "
                "JOIN turnos t ON t.id = a.turno_id "
                "WHERE p.especialidad IS NOT NULL "
                "  AND LOWER(COALESCE(p.cargo, '')) IN ('medico', 'médico') "
                "ORDER BY p.id, a.dia_semana, t.hora_inicio"
            )
        )
    ).mappings().all()

    agenda: dict = {}
    for f in filas:
        medico = agenda.setdefault(
            f["medico_id"], {"especialidad": f["especialidad"], "dias": {}}
        )
        medico["dias"].setdefault(f["dia_semana"], []).append(f)
    return agenda


async def _medicos_con_login(db) -> set:
    filas = (
        await db.execute(
            text(
                "SELECT DISTINCT personal_id FROM usuarios "
                "WHERE personal_id IS NOT NULL AND activo = TRUE "
                "  AND rol IN ('medico', 'medico_emergencia')"
            )
        )
    ).scalars().all()
    return set(filas)


async def _ausente(db, medico_id: int, fecha: date) -> bool:
    fila = (
        await db.execute(
            text(
                "SELECT 1 FROM ausencias_medicos "
                "WHERE medico_id = :mid AND estado = 'activa' "
                "  AND fecha_desde <= :fec AND fecha_hasta >= :fec"
            ),
            {"mid": medico_id, "fec": fecha},
        )
    ).first()
    return fila is not None


async def _horas_ocupadas(db, medico_id: int, fecha: date, cache: dict) -> set:
    clave = (medico_id, fecha)
    if clave not in cache:
        filas = (
            await db.execute(
                text(
                    "SELECT to_char(hora_inicio, 'HH24:MI') AS h FROM citas "
                    "WHERE medico_id = :mid AND fecha_cita = :fec "
                    "  AND estado <> 'cancelada'"
                ),
                {"mid": medico_id, "fec": fecha},
            )
        ).mappings().all()
        cache[clave] = {f["h"] for f in filas}
    return cache[clave]


async def _crear_cita(
    db,
    *,
    paciente: dict,
    paciente_id: str,
    medico_id: int,
    fecha: date,
    turnos: list,
    ocupadas_cache: dict,
    reservados: set,
    crear_cola: bool,
) -> str:
    """Crea una cita demo en la primera franja libre del día.

    Devuelve 'creada', 'existente' o 'sin_cupo'.
    """
    ya = (
        await db.execute(
            text(
                "SELECT 1 FROM citas WHERE paciente_id = :pid AND fecha_cita = :fec "
                "  AND origen = 'demo' LIMIT 1"
            ),
            {"pid": paciente_id, "fec": fecha},
        )
    ).first()
    if ya:
        return "existente"

    ocupadas = await _horas_ocupadas(db, medico_id, fecha, ocupadas_cache)
    libre = None
    for turno in sorted(turnos, key=lambda t: t["hora_inicio"]):
        for slot in _slots(turno["hora_inicio"], turno["hora_fin"]):
            hh = slot.strftime("%H:%M")
            if hh in ocupadas or (medico_id, fecha, hh) in reservados:
                continue
            libre = (turno, slot, hh)
            break
        if libre:
            break
    if not libre:
        return "sin_cupo"

    turno, hora_slot, hora = libre
    reservados.add((medico_id, fecha, hora))
    ocupadas.add(hora)

    codigo = (
        f"DEMO-{paciente['cedula']}-{fecha.isoformat()}-{hora.replace(':', '')}"
    )
    cita_id = (
        await db.execute(
            text(
                "INSERT INTO citas "
                "(id, paciente_id, centro_id, centro_salud, especialidad, medico_id, "
                " fecha_cita, hora_inicio, motivo, origen, estado, codigo_confirmacion) "
                "VALUES (gen_random_uuid(), :pid, 2, 'CITAB', :esp, :mid, :fec, :hora, "
                "        :motivo, 'demo', 'pendiente', :cod) "
                "RETURNING id"
            ),
            {
                "pid": paciente_id,
                "esp": turno["especialidad"] or "",
                "mid": medico_id,
                "fec": fecha,
                "hora": hora_slot,
                "motivo": f"Cita demo para probar turno {turno['turno_nombre']}",
                "cod": codigo,
            },
        )
    ).scalar_one()

    if crear_cola:
        # Un paciente solo puede tener una cola activa por día (uq_cola_paciente_por_dia).
        cola_existente = (
            await db.execute(
                text(
                    "SELECT id FROM cola_atencion "
                    "WHERE paciente_cedula = :ced AND atencion_estado NOT IN "
                    "      ('CANCELADO', 'NO_ASISTIO') "
                    "  AND (creado_en AT TIME ZONE 'America/Caracas')::date = :fec "
                    "LIMIT 1"
                ),
                {"ced": paciente["cedula"], "fec": fecha},
            )
        ).first()
        if cola_existente:
            await db.execute(
                text("UPDATE citas SET cola_id = :cid WHERE id = :cita"),
                {"cid": cola_existente[0], "cita": cita_id},
            )
        else:
            cola_id = (
                await db.execute(
                    text(
                        "INSERT INTO cola_atencion "
                        "(token, paciente_id, paciente_cedula, paciente_nombre, clinica_id, "
                        " atencion_estado, ruta_atencion, prioridad, motivo_consulta, "
                        " especialidad, medico_id, cita_id, fec_encolada, categoria_prioridad) "
                        "VALUES (:tok, :pid, :ced, :nom, 2, 'EN_ESPERA_CONSULTA', 'CITA', 3, "
                        "        :motivo, :esp, :mid, :cita, now(), 'AMARILLO') "
                        "RETURNING id"
                    ),
                    {
                        "tok": f"DEMO-{paciente['cedula']}-{fecha.isoformat()}",
                        "pid": paciente_id,
                        "ced": paciente["cedula"],
                        "nom": f"{paciente['nombre_completo']} {paciente['apellido']}",
                        "motivo": f"Control de {turno['especialidad']}",
                        "esp": turno["especialidad"] or "",
                        "mid": medico_id,
                        "cita": cita_id,
                    },
                )
            ).scalar_one()
            await db.execute(
                text("UPDATE citas SET cola_id = :cid WHERE id = :cita"),
                {"cid": cola_id, "cita": cita_id},
            )

    return "creada"


async def _reporte_semanal(db, agenda: dict, medicos: list, hoy: date) -> None:
    """Cupos totales, ocupados y libres por semana y médico."""
    lunes_actual = hoy - timedelta(days=hoy.weekday())
    print("\n[cupos] Capacidad disponible por semana (solo días con agenda):")
    for semana in range(SEMANAS_SEMILLA):
        inicio = lunes_actual + timedelta(weeks=semana)
        fin = inicio + timedelta(days=6)
        print(f"  Semana {inicio.isoformat()} al {fin.isoformat()}")
        for medico_id in medicos:
            total = usado = dias = 0
            for offset in range(7):
                fecha = inicio + timedelta(days=offset)
                if fecha < hoy:
                    continue
                turnos = agenda[medico_id]["dias"].get(fecha.weekday(), [])
                if not turnos or await _ausente(db, medico_id, fecha):
                    continue
                dias += 1
                total += sum(
                    len(list(_slots(t["hora_inicio"], t["hora_fin"]))) for t in turnos
                )
                usado += (
                    await db.execute(
                        text(
                            "SELECT count(*) FROM citas "
                            "WHERE medico_id = :mid AND fecha_cita = :fec "
                            "  AND estado <> 'cancelada'"
                        ),
                        {"mid": medico_id, "fec": fecha},
                    )
                ).scalar_one()
            if dias:
                print(
                    f"    Medico {medico_id} ({agenda[medico_id]['especialidad']}): "
                    f"{dias} dia(s), {total} cupos, {usado} ocupados, "
                    f"{max(total - usado, 0)} libres"
                )


async def seed():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as db:
        agenda = await _agenda_especialistas(db)
        if not agenda:
            print("[warn] no hay especialistas con agenda; corra app.seed_agenda primero")
            await engine.dispose()
            return

        hoy = (await db.execute(text("SELECT CURRENT_DATE AS hoy"))).scalar_one()
        con_login = await _medicos_con_login(db)

        # Médicos de prueba: primero los que tienen usuario para poder iniciar
        # sesión y probar la postergación desde su interfaz.
        candidatos = [m for m in sorted(agenda) if m in con_login] or sorted(agenda)
        medicos = candidatos[:MAX_MEDICOS]

        pacientes = []
        for p in PACIENTES_DEMO:
            pacientes.append((p, await _paciente_id(db, p)))

        ocupadas_cache: dict = {}
        reservados: set = set()
        creadas = existentes = sin_cupo = 0
        cola_creadas = 0

        # ── 1) Citas de HOY con cola, para probar postergación ────────────
        dow_hoy = hoy.weekday()
        medicos_hoy = [m for m in medicos if dow_hoy in agenda[m]["dias"]]
        indice_paciente = 0
        for medico_id in medicos_hoy:
            turnos = agenda[medico_id]["dias"][dow_hoy]
            for _ in range(CITAS_HOY_POR_MEDICO):
                paciente, paciente_id = pacientes[indice_paciente % len(pacientes)]
                indice_paciente += 1
                resultado = await _crear_cita(
                    db,
                    paciente=paciente,
                    paciente_id=paciente_id,
                    medico_id=medico_id,
                    fecha=hoy,
                    turnos=turnos,
                    ocupadas_cache=ocupadas_cache,
                    reservados=reservados,
                    crear_cola=True,
                )
                if resultado == "creada":
                    creadas += 1
                    cola_creadas += 1
                elif resultado == "existente":
                    existentes += 1
                else:
                    sin_cupo += 1

        # ── 2) Citas de las próximas semanas ─────────────────────────────
        lunes_actual = hoy - timedelta(days=hoy.weekday())
        for semana in range(SEMANAS_SEMILLA):
            inicio_semana = lunes_actual + timedelta(weeks=semana)
            for medico_id in medicos:
                fechas = [
                    inicio_semana + timedelta(days=dia)
                    for dia in sorted(agenda[medico_id]["dias"])
                ]
                # Solo días futuros (hoy ya se cubrió arriba) y con cupo.
                fechas = [f for f in fechas if f > hoy]
                creadas_semana = 0
                for fecha in fechas:
                    if creadas_semana >= CITAS_POR_MEDICO_SEMANA:
                        break
                    if await _ausente(db, medico_id, fecha):
                        continue
                    paciente, paciente_id = pacientes[indice_paciente % len(pacientes)]
                    indice_paciente += 1
                    resultado = await _crear_cita(
                        db,
                        paciente=paciente,
                        paciente_id=paciente_id,
                        medico_id=medico_id,
                        fecha=fecha,
                        turnos=agenda[medico_id]["dias"][fecha.weekday()],
                        ocupadas_cache=ocupadas_cache,
                        reservados=reservados,
                        crear_cola=False,
                    )
                    if resultado == "creada":
                        creadas += 1
                        creadas_semana += 1
                    elif resultado == "existente":
                        existentes += 1
                        creadas_semana += 1
                    else:
                        sin_cupo += 1

        print(
            f"[ok] citas demo: {creadas} creadas, {existentes} ya existían, "
            f"{sin_cupo} sin cupo ({len(pacientes)} pacientes, "
            f"{len(medicos)} médicos)."
        )
        print(f"[ok] citas de hoy con cola: {cola_creadas} ({hoy.isoformat()}).")

        await _reporte_semanal(db, agenda, medicos, hoy)

    await engine.dispose()
    print("\nSeed de citas demo listo.")


if __name__ == "__main__":
    asyncio.run(seed())
