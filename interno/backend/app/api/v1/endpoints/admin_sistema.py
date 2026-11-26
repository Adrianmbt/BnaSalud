"""Administración de Sistema: CRUD de usuarios, gestión de nómina y logs."""
import csv
import io
import json
import re
import unicodedata
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from uuid import uuid4

import bcrypt
import openpyxl
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.services.certificaciones_horario import (
    registrar_certificacion,
    semanas_certificadas,
)
from app.services.afiliacion import GENERAL, categorias_por_cedula, normalizar_cedula
from app.services.reparto_citas import MAX_CUPOS_DIA, elegir_hueco

router = APIRouter(tags=["Admin Sistema"])


# ─── SCHEMAS ──────────────────────────────────────────────────────

class UsuarioCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=60)
    password: str = Field(..., min_length=6, max_length=120)
    rol: str = Field(..., min_length=3, max_length=60)
    personal_id: Optional[int] = None
    nombre: Optional[str] = Field(None, max_length=120)
    apellido: Optional[str] = Field(None, max_length=120)
    especialidad: Optional[str] = Field(None, max_length=120)
    cedula: Optional[str] = Field(None, max_length=20)
    clinica_id: Optional[int] = Field(None, ge=1, description="Centro de salud del usuario")
    activo: bool = True


class UsuarioUpdate(BaseModel):
    password: Optional[str] = Field(None, min_length=6, max_length=120)
    rol: Optional[str] = None
    activo: Optional[bool] = None
    personal_id: Optional[int] = None
    nombre: Optional[str] = Field(None, max_length=120)
    apellido: Optional[str] = Field(None, max_length=120)
    especialidad: Optional[str] = Field(None, max_length=120)
    cedula: Optional[str] = Field(None, max_length=20)
    clinica_id: Optional[int] = Field(None, ge=1)


class EmpleadoCreate(BaseModel):
    cedula: str = Field(..., min_length=5, max_length=20)
    nombre_completo: str = Field(..., min_length=2, max_length=200)
    edad: Optional[int] = None
    cargo: Optional[str] = None
    ente: Optional[str] = Field(None, max_length=120)


class EmpleadoUpdate(BaseModel):
    cedula: Optional[str] = None
    nombre_completo: Optional[str] = None
    edad: Optional[int] = None
    cargo: Optional[str] = None
    ente: Optional[str] = Field(None, max_length=120)
    activo: Optional[bool] = None


class BeneficiarioOut(BaseModel):
    id: str
    cedula: str
    nombre_completo: str
    parentesco: Optional[str] = None
    activo: bool


class HorarioDia(BaseModel):
    dia_semana: int = Field(..., ge=0, le=6, description="0=lunes ... 6=domingo")
    turno_ids: List[int] = Field(default_factory=list)


class HorarioMedicoUpdate(BaseModel):
    dias: List[HorarioDia] = Field(default_factory=list)


class BeneficiarioCreate(BaseModel):
    cedula: str = Field(..., min_length=5, max_length=20)
    nombre_completo: str = Field(..., min_length=2, max_length=200)
    parentesco: Optional[str] = None


class BeneficiarioUpdate(BaseModel):
    cedula: Optional[str] = None
    nombre_completo: Optional[str] = None
    parentesco: Optional[str] = None
    activo: Optional[bool] = None
    empleado_id: Optional[str] = None


# ─── AYUDA ─────────────────────────────────────────────────────────

async def _auditar(db: AsyncSession, accion: str, detalle: dict, usuario: str) -> None:
    """Registra la operación de nómina en system_logs (auditoría remota)."""
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS system_logs (
            id SERIAL PRIMARY KEY,
            nivel VARCHAR(20) NOT NULL DEFAULT 'INFO',
            mensaje TEXT NOT NULL,
            fuente VARCHAR(100),
            detalle TEXT,
            creado_en TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    await db.execute(
        text(
            "INSERT INTO system_logs (nivel, mensaje, fuente, detalle, creado_en) "
            "VALUES ('INFO', :mensaje, 'nomina', :detalle, NOW())"
        ),
        {"mensaje": f"Nómina: {accion}", "detalle": json.dumps({**detalle, "usuario": usuario}, ensure_ascii=False)},
    )
    # get_db cierra la sesión sin commit: confirmamos aquí la operación de nómina.
    await db.commit()


# ─── USERS CRUD ───────────────────────────────────────────────────

ROLES_PERMITIDOS = {
    "recepcionista", "medico_emergencia", "medico",
    "jefe_farmacia", "farmaceutico", "admin_sistemas",
    "historias_medicas", "recursos_humanos", "director",
    "jefe_almacen",
}

ROLES_MEDICO = {"medico", "medico_emergencia"}

# Etiqueta que se guarda en `personal.cargo` para cada rol.
CARGOS_POR_ROL = {
    "jefe_farmacia": "Jefe de Farmacia",
    "jefe_almacen": "Jefe de Almacén",
    "farmaceutico": "Farmacéutico",
    "recepcionista": "Recepcionista",
    "historias_medicas": "Historias Médicas",
    "recursos_humanos": "Recursos Humanos",
    "admin_sistemas": "Admin de Sistemas",
    "director": "Director",
}


def _cargo_por_rol(rol: str) -> str:
    return "Médico" if rol in ROLES_MEDICO else CARGOS_POR_ROL.get(rol, rol)


async def _crear_personal(
    db: AsyncSession,
    *,
    nombre: str,
    apellido: Optional[str],
    especialidad: Optional[str],
    cedula: Optional[str],
    rol: str,
    clinica_id: Optional[int] = None,
) -> int:
    """Crea la ficha en `personal` para un usuario nuevo.

    El centro se toma del formulario (antes se fijaba 2 a la fuerza, lo que
    dejaba al personal de otros centros apuntando a la clínica equivocada).
    """
    return (
        await db.execute(
            text(
                "INSERT INTO personal "
                "(cedula, nombre, apellido, especialidad, cargo, clinica_id) "
                "VALUES (:ced, :nom, :ape, :esp, :cargo, :clinica) "
                "RETURNING id"
            ),
            {
                "ced": (cedula or "").strip() or None,
                "nom": nombre.strip(),
                "ape": (apellido or "").strip() or None,
                "esp": (especialidad or "").strip() or None,
                "cargo": _cargo_por_rol(rol),
                "clinica": clinica_id,
            },
        )
    ).scalar_one()


async def _actualizar_personal(
    db: AsyncSession,
    personal_id: int,
    *,
    nombre: Optional[str],
    apellido: Optional[str],
    especialidad: Optional[str],
    cedula: Optional[str],
    clinica_id: Optional[int] = None,
) -> None:
    """Actualiza solo los campos enviados de la ficha del personal."""
    updates = {}
    if clinica_id is not None:
        updates["clinica_id"] = clinica_id
    if nombre is not None:
        updates["nombre"] = nombre.strip()
    if apellido is not None:
        updates["apellido"] = apellido.strip() or None
    if especialidad is not None:
        updates["especialidad"] = especialidad.strip() or None
    if cedula is not None:
        updates["cedula"] = cedula.strip() or None
    if not updates:
        return

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = personal_id
    await db.execute(
        text(f"UPDATE personal SET {set_clause} WHERE id = :id"), updates
    )


@router.get("/usuarios")
async def listar_usuarios(
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=8, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    where = "WHERE 1=1"
    params = {}
    if q.strip():
        where += " AND (u.username ILIKE :q OR p.nombre ILIKE :q OR p.apellido ILIKE :q)"
        params["q"] = f"%{q.strip()}%"

    count_result = await db.execute(
        text(f"SELECT COUNT(*) FROM usuarios u LEFT JOIN personal p ON p.id = u.personal_id {where}"),
        params,
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * per_page
    result = await db.execute(
        text(
            f"SELECT u.id, u.username, u.rol, u.personal_id, u.clinica_id, u.activo, u.created_at, "
            f"p.nombre, p.apellido, p.cedula, p.cargo, p.especialidad "
            f"FROM usuarios u "
            f"LEFT JOIN personal p ON p.id = u.personal_id "
            f"{where} "
            f"ORDER BY u.created_at DESC "
            f"LIMIT :limit OFFSET :offset"
        ),
        {**params, "limit": per_page, "offset": offset},
    )
    items = []
    for r in result.mappings():
        items.append({
            "id": str(r["id"]),
            "username": r["username"],
            "rol": r["rol"],
            "personal_id": r["personal_id"],
            "clinica_id": r["clinica_id"],
            "activo": r["activo"],
            "created_at": str(r["created_at"])[:19] if r["created_at"] else None,
            "nombre": r["nombre"] or "",
            "apellido": r["apellido"] or "",
            "cedula": r["cedula"] or "",
            "cargo": r["cargo"] or "",
            "especialidad": r["especialidad"] or "",
        })
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.post("/usuarios", status_code=status.HTTP_201_CREATED)
async def crear_usuario(payload: UsuarioCreate, db: AsyncSession = Depends(get_db)):
    if payload.rol not in ROLES_PERMITIDOS:
        raise HTTPException(400, f"Rol inválido. Roles permitidos: {', '.join(sorted(ROLES_PERMITIDOS))}")

    exists = await db.execute(
        text("SELECT id FROM usuarios WHERE username = :u"), {"u": payload.username.lower().strip()}
    )
    if exists.first():
        raise HTTPException(409, "Ya existe un usuario con ese username.")

    nombre = (payload.nombre or "").strip()
    personal_id = payload.personal_id
    if personal_id is not None:
        existe_personal = (
            await db.execute(
                text("SELECT id FROM personal WHERE id = :id"), {"id": personal_id}
            )
        ).first()
        if not existe_personal:
            # Antes esto bloqueaba la creación ("El personal indicado no
            # existe") cuando el operador escribía un ID que no estaba en
            # `personal`. Si envió los datos de la persona se crea su ficha.
            if not nombre:
                raise HTTPException(
                    404,
                    f"El Personal ID {personal_id} no existe. Deje el campo vacío "
                    "para crear la ficha con el nombre y el centro indicados.",
                )
            personal_id = await _crear_personal(
                db,
                nombre=nombre,
                apellido=payload.apellido,
                especialidad=payload.especialidad,
                cedula=payload.cedula,
                rol=payload.rol,
                clinica_id=payload.clinica_id,
            )
        elif any(
            v is not None
            for v in (
                payload.nombre, payload.apellido, payload.especialidad,
                payload.cedula, payload.clinica_id,
            )
        ):
            await _actualizar_personal(
                db,
                personal_id,
                nombre=payload.nombre,
                apellido=payload.apellido,
                especialidad=payload.especialidad,
                cedula=payload.cedula,
                clinica_id=payload.clinica_id,
            )
    elif nombre:
        personal_id = await _crear_personal(
            db,
            nombre=nombre,
            apellido=payload.apellido,
            especialidad=payload.especialidad,
            cedula=payload.cedula,
            rol=payload.rol,
            clinica_id=payload.clinica_id,
        )
    elif payload.rol in ROLES_MEDICO:
        raise HTTPException(
            400,
            "Para un usuario médico indica al menos el nombre, la especialidad y el horario.",
        )

    password_hash = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    new_id = uuid4()
    try:
        await db.execute(
            text(
                "INSERT INTO usuarios "
                "(id, username, password_hash, rol, personal_id, clinica_id, activo, created_at) "
                "VALUES (:id, :username, :pw, :rol, :pid, :clinica, :activo, NOW())"
            ),
            {
                "id": new_id,
                "username": payload.username.lower().strip(),
                "pw": password_hash,
                "rol": payload.rol,
                "pid": personal_id,
                "clinica": payload.clinica_id,
                "activo": payload.activo,
            },
        )
        await db.commit()
    except IntegrityError as exc:
        # Las restricciones de la BD no deben llegar al navegador como 500:
        # se traducen a un mensaje accionable para el administrador.
        await db.rollback()
        detalle = str(getattr(exc, "orig", exc))
        if "usuarios_rol_check" in detalle:
            raise HTTPException(
                400,
                "El rol indicado no está habilitado en la base de datos. "
                "Aplique la migración 022_almacen_ordenes_entrega.sql.",
            )
        if "username" in detalle:
            raise HTTPException(409, "Ya existe un usuario con ese username.")
        if "personal_id" in detalle:
            raise HTTPException(400, "El Personal ID indicado no existe.")
        if "clinica_id" in detalle:
            raise HTTPException(400, "El centro indicado no existe.")
        raise HTTPException(400, "No se pudo crear el usuario con los datos indicados.")
    return {"id": str(new_id), "message": "Usuario creado exitosamente."}


@router.put("/usuarios/{usuario_id}")
async def actualizar_usuario(usuario_id: str, payload: UsuarioUpdate, db: AsyncSession = Depends(get_db)):
    fila = (
        await db.execute(
            text("SELECT id, rol, personal_id FROM usuarios WHERE id = :id"),
            {"id": usuario_id},
        )
    ).first()
    if not fila:
        raise HTTPException(404, "Usuario no encontrado.")

    updates = {}
    if payload.password is not None:
        updates["password_hash"] = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    if payload.rol is not None:
        if payload.rol not in ROLES_PERMITIDOS:
            raise HTTPException(400, f"Rol inválido.")
        updates["rol"] = payload.rol
    if payload.activo is not None:
        updates["activo"] = payload.activo
    if payload.clinica_id is not None:
        updates["clinica_id"] = payload.clinica_id

    personal_id = payload.personal_id if payload.personal_id is not None else fila[2]
    if payload.personal_id is not None:
        existe_personal = (
            await db.execute(
                text("SELECT id FROM personal WHERE id = :id"),
                {"id": payload.personal_id},
            )
        ).first()
        if not existe_personal:
            raise HTTPException(404, "El personal indicado no existe.")
        updates["personal_id"] = payload.personal_id

    campos_personal = any(
        v is not None
        for v in (
            payload.nombre, payload.apellido, payload.especialidad,
            payload.cedula, payload.clinica_id,
        )
    )
    if campos_personal:
        if personal_id is None:
            nombre = (payload.nombre or "").strip()
            if not nombre:
                raise HTTPException(
                    400,
                    "Indica el nombre del médico para crear su ficha de personal.",
                )
            personal_id = await _crear_personal(
                db,
                nombre=nombre,
                apellido=payload.apellido,
                especialidad=payload.especialidad,
                cedula=payload.cedula,
                rol=updates.get("rol", fila[1]),
                clinica_id=payload.clinica_id,
            )
            updates["personal_id"] = personal_id
        else:
            await _actualizar_personal(
                db,
                personal_id,
                nombre=payload.nombre,
                apellido=payload.apellido,
                especialidad=payload.especialidad,
                cedula=payload.cedula,
                clinica_id=payload.clinica_id,
            )

    if not updates and not campos_personal:
        raise HTTPException(400, "Sin cambios para actualizar.")

    if updates:
        set_clause = ", ".join(f"{k} = :{k}" for k in updates)
        updates["id"] = usuario_id
        try:
            await db.execute(text(f"UPDATE usuarios SET {set_clause} WHERE id = :id"), updates)
            await db.commit()
        except IntegrityError as exc:
            # Si la BD rechaza el rol (usuarios_rol_check viejo) el panel debe
            # decir por qué, no quedarse con un 500 y un "no guardó".
            await db.rollback()
            raise HTTPException(409, f"La base de datos rechazó el cambio: {exc.orig}")
    else:
        await db.commit()

    # Se devuelve lo que quedó realmente guardado: el panel lo muestra como
    # confirmación para que un cambio no aplicado no parezca "guardado".
    guardado = (
        await db.execute(
            text(
                "SELECT u.rol, u.activo, u.personal_id, p.nombre, p.apellido, p.especialidad "
                "FROM usuarios u LEFT JOIN personal p ON p.id = u.personal_id "
                "WHERE u.id = :id"
            ),
            {"id": usuario_id},
        )
    ).mappings().first()
    return {
        "message": "Usuario actualizado.",
        "usuario": {
            "rol": guardado["rol"],
            "activo": guardado["activo"],
            "personal_id": guardado["personal_id"],
            "nombre": guardado["nombre"] or "",
            "apellido": guardado["apellido"] or "",
            "especialidad": guardado["especialidad"] or "",
        } if guardado else None,
    }


@router.delete("/usuarios/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_usuario(usuario_id: str, db: AsyncSession = Depends(get_db)):
    exists = await db.execute(text("SELECT id, username FROM usuarios WHERE id = :id"), {"id": usuario_id})
    row = exists.first()
    if not row:
        raise HTTPException(404, "Usuario no encontrado.")
    if row[1] == "admin":
        raise HTTPException(403, "No se puede eliminar el usuario administrador principal.")
    try:
        await db.execute(text("DELETE FROM usuarios WHERE id = :id"), {"id": usuario_id})
        await db.commit()
    except IntegrityError:
        # Hay FKs en RESTRICT (por ejemplo ordenes_medicas.medico_id).
        await db.rollback()
        raise HTTPException(
            409,
            "No se puede eliminar el usuario porque tiene registros asociados "
            "(por ejemplo órdenes médicas). Desactívalo con el botón de estado.",
        )


# ─── HORARIOS DE MÉDICOS ─────────────────────────────────────────

DIAS_SEMANA = [
    "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo",
]


def _es_turno_24h(hora_inicio, hora_fin) -> bool:
    """Un turno de 20 h o más se considera cobertura 24 horas."""
    inicio = datetime.combine(date.min, hora_inicio)
    fin = datetime.combine(date.min, hora_fin)
    return fin - inicio >= timedelta(hours=20)


def _hhmm(hora) -> str:
    return str(hora)[:5]


async def _medico_especialista(db: AsyncSession, medico_id: int) -> dict:
    fila = (
        await db.execute(
            text(
                "SELECT p.id, p.nombre, p.apellido, COALESCE(p.especialidad, '') AS especialidad, "
                "       EXISTS(SELECT 1 FROM usuarios u "
                "              WHERE u.personal_id = p.id AND u.rol = 'medico_emergencia') AS emergencia "
                "FROM personal p "
                "WHERE p.id = :mid "
                "  AND ( (LOWER(COALESCE(p.cargo, '')) IN ('medico', 'médico') "
                "         AND p.especialidad IS NOT NULL) "
                "         OR EXISTS(SELECT 1 FROM usuarios u "
                "                   WHERE u.personal_id = p.id AND u.rol = 'medico_emergencia') )"
            ),
            {"mid": medico_id},
        )
    ).mappings().first()
    if not fila:
        raise HTTPException(404, f"No existe un médico especialista con id {medico_id}.")
    return dict(fila)


@router.get("/medicos")
async def listar_medicos_horarios(
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=5, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Médicos especialistas con el número de días que tienen horario cargado."""
    params = {}
    filtro_q = ""
    if q.strip():
        filtro_q = " AND (p.nombre ILIKE :q OR p.apellido ILIKE :q OR p.especialidad ILIKE :q)"
        params["q"] = f"%{q.strip()}%"

    # Contar total
    count_result = await db.execute(
        text(
            "SELECT COUNT(*) FROM personal p "
            "WHERE ( (LOWER(COALESCE(p.cargo, '')) IN ('medico', 'médico') "
            "         AND p.especialidad IS NOT NULL) "
            "     OR EXISTS(SELECT 1 FROM usuarios u "
            "                WHERE u.personal_id = p.id AND u.rol = 'medico_emergencia') ) "
            f"{filtro_q}"
        ),
        params,
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * per_page

    result = await db.execute(
        text(
            "SELECT p.id, p.nombre, p.apellido, COALESCE(p.especialidad, '') AS especialidad, "
            "       EXISTS(SELECT 1 FROM usuarios u "
            "              WHERE u.personal_id = p.id AND u.rol = 'medico_emergencia') AS emergencia, "
            "       (SELECT count(DISTINCT a.dia_semana) FROM agenda_medicos a "
            "         WHERE a.medico_id = p.id AND a.activo) AS dias_con_horario "
            "FROM personal p "
            "WHERE ( (LOWER(COALESCE(p.cargo, '')) IN ('medico', 'médico') "
            "         AND p.especialidad IS NOT NULL) "
            "     OR EXISTS(SELECT 1 FROM usuarios u "
            "                WHERE u.personal_id = p.id AND u.rol = 'medico_emergencia') ) "
            f"{filtro_q} "
            "ORDER BY p.especialidad NULLS LAST, p.nombre "
            "LIMIT :limit OFFSET :offset"
        ),
        {**params, "limit": per_page, "offset": offset},
    )
    items = [
        {
            "id": f["id"],
            "nombre": f"{f['nombre']} {f['apellido']}".strip(),
            "especialidad": f["especialidad"],
            "emergencia": bool(f["emergencia"]),
            "dias_con_horario": f["dias_con_horario"] or 0,
        }
        for f in result.mappings()
    ]
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.get("/turnos")
async def listar_turnos(db: AsyncSession = Depends(get_db)):
    """Catálogo de turnos disponibles para configurar horarios."""
    result = await db.execute(
        text("SELECT id, nombre, hora_inicio, hora_fin FROM turnos ORDER BY hora_inicio")
    )
    return [
        {
            "id": f["id"],
            "nombre": f["nombre"],
            "hora_inicio": _hhmm(f["hora_inicio"]),
            "hora_fin": _hhmm(f["hora_fin"]),
            "es_24h": _es_turno_24h(f["hora_inicio"], f["hora_fin"]),
        }
        for f in result.mappings()
    ]


@router.get("/medicos/{medico_id}/horario")
async def obtener_horario_medico(medico_id: int, db: AsyncSession = Depends(get_db)):
    """Horario semanal de un médico (días y turnos) más el catálogo de turnos."""
    medico = await _medico_especialista(db, medico_id)

    turnos = (
        await db.execute(
            text("SELECT id, nombre, hora_inicio, hora_fin FROM turnos ORDER BY hora_inicio")
        )
    ).mappings().all()

    filas = (
        await db.execute(
            text(
                "SELECT dia_semana, turno_id FROM agenda_medicos "
                "WHERE medico_id = :mid AND activo = TRUE"
            ),
            {"mid": medico_id},
        )
    ).mappings().all()

    por_dia: dict = {dia: [] for dia in range(7)}
    for f in filas:
        por_dia.setdefault(f["dia_semana"], []).append(f["turno_id"])

    # Medicina General y Emergencias son los únicos que cubren 24 horas.
    permite_24h = (
        medico["emergencia"]
        or "medicina general" in (medico["especialidad"] or "").lower()
    )

    def _turno_ofrecido(t) -> bool:
        """Especialistas: Mañana y Tarde. Medicina General/Emergencias: + 24 h."""
        if _es_turno_24h(t["hora_inicio"], t["hora_fin"]):
            return permite_24h
        nombre = (t["nombre"] or "").strip().lower()
        return nombre in ("mañana", "manana", "tarde")

    return {
        "medico": {
            "id": medico["id"],
            "nombre": f"{medico['nombre']} {medico['apellido']}".strip(),
            "especialidad": medico["especialidad"],
            "emergencia": bool(medico["emergencia"]),
            "permite_24h": permite_24h,
        },
        "turnos": [
            {
                "id": t["id"],
                "nombre": t["nombre"],
                "hora_inicio": _hhmm(t["hora_inicio"]),
                "hora_fin": _hhmm(t["hora_fin"]),
                "es_24h": _es_turno_24h(t["hora_inicio"], t["hora_fin"]),
            }
            for t in turnos
            if _turno_ofrecido(t)
        ],
        "dias": [
            {
                "dia_semana": dia,
                "nombre": DIAS_SEMANA[dia],
                "turno_ids": sorted(set(por_dia.get(dia, []))),
            }
            for dia in range(7)
        ],
    }


@router.put("/medicos/{medico_id}/horario")
async def actualizar_horario_medico(
    medico_id: int,
    payload: HorarioMedicoUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Reemplaza el horario semanal del médico.

    Solo Medicina General y Emergencias pueden tener turnos de 24 horas; el
    resto de especialistas trabaja por turnos de mañana y tarde.
    """
    medico = await _medico_especialista(db, medico_id)

    # Evita que dos ediciones simultáneas del mismo médico se pisen.
    await db.execute(
        text("SELECT pg_advisory_xact_lock(:mid)"), {"mid": medico_id}
    )

    turnos = {
        f["id"]: f
        for f in (
            await db.execute(
                text("SELECT id, nombre, hora_inicio, hora_fin FROM turnos")
            )
        ).mappings()
    }

    permite_24h = (
        medico["emergencia"]
        or "medicina general" in (medico["especialidad"] or "").lower()
    )

    seleccion = set()
    for dia in payload.dias:
        for turno_id in dia.turno_ids:
            if turno_id not in turnos:
                raise HTTPException(400, f"El turno {turno_id} no existe.")
            turno = turnos[turno_id]
            if _es_turno_24h(turno["hora_inicio"], turno["hora_fin"]) and not permite_24h:
                raise HTTPException(
                    400,
                    "Solo Medicina General y Emergencias pueden tener cobertura 24 horas. "
                    "Use los turnos Mañana o Tarde.",
                )
            seleccion.add((dia.dia_semana, turno_id))

    await db.execute(
        text("DELETE FROM agenda_medicos WHERE medico_id = :mid"), {"mid": medico_id}
    )
    for dia_semana, turno_id in sorted(seleccion):
        await db.execute(
            text(
                "INSERT INTO agenda_medicos (medico_id, dia_semana, turno_id, activo) "
                "VALUES (:mid, :dia, :turno, TRUE)"
            ),
            {"mid": medico_id, "dia": dia_semana, "turno": turno_id},
        )

    await _auditar(
        db,
        "horario de médico actualizado",
        {
            "medico_id": medico_id,
            "dias": sorted({d.dia_semana for d in payload.dias if d.turno_ids}),
            "turnos": sorted({t for _, t in seleccion}),
        },
        user.get("sub", ""),
    )
    return {
        "message": "Horario actualizado.",
        "dias_configurados": len({d for d, _ in seleccion}),
        "citas_preasignadas_asignadas": await _asignar_citas_preasignadas_de_medico(db, medico_id)
        if settings.REPARTO_AUTOMATICO
        else 0,
    }


async def _asegurar_columnas_certificacion(db: AsyncSession) -> None:
    """Sin Alembic: agrega las columnas de certificación si todavía no existen."""
    await db.execute(
        text(
            "ALTER TABLE agenda_medicos "
            "ADD COLUMN IF NOT EXISTS certificado BOOLEAN DEFAULT FALSE, "
            "ADD COLUMN IF NOT EXISTS certificado_en TIMESTAMPTZ, "
            "ADD COLUMN IF NOT EXISTS certificado_por TEXT"
        )
    )
    await db.commit()


def _inicio_de_semana(semana_desde: Optional[str], hoy: date) -> date:
    """Lunes de la semana pedida (cualquier día de esa semana sirve como entrada)."""
    if not semana_desde:
        return hoy - timedelta(days=hoy.weekday())
    try:
        fecha = datetime.strptime(semana_desde, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400, detail="semana_desde inválida (YYYY-MM-DD)."
        )
    return fecha - timedelta(days=fecha.weekday())


async def _certificar_dias_de_medico(
    db: AsyncSession, medico_id: int, certificado_por: str, inicio_semana: date
) -> int:
    """Certifica la semana indicada para el médico.

    Marca la plantilla (`agenda_medicos`) y registra la fila de
    `agenda_certificaciones_semana`, que es la que abre esa semana concreta en
    la agenda de recepción. Devuelve cuántos días (lunes a viernes) quedaron
    certificados.
    """
    await db.execute(
        text(
            "UPDATE agenda_medicos "
            "SET certificado = TRUE, certificado_en = NOW(), certificado_por = :por "
            "WHERE medico_id = :mid AND activo AND dia_semana BETWEEN 0 AND 4"
        ),
        {"por": certificado_por, "mid": medico_id},
    )
    dias = {
        f["dia_semana"]
        for f in (
            await db.execute(
                text(
                    "SELECT dia_semana FROM agenda_medicos "
                    "WHERE medico_id = :mid AND activo AND dia_semana BETWEEN 0 AND 4"
                ),
                {"mid": medico_id},
            )
        ).mappings()
    }
    if dias:
        await registrar_certificacion(
            db, medico_id, inicio_semana, len(dias), certificado_por
        )
    return len(dias)


@router.post("/medicos/{medico_id}/horario/certificar")
async def certificar_horario_medico(
    medico_id: int,
    semana_desde: Optional[str] = Query(
        None, description="Lunes de la semana a certificar (YYYY-MM-DD). Por defecto la semana actual."
    ),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Certifica (ratifica) el horario semanal de un médico especialista.

    Solo recursos_humanos o admin_sistemas pueden certificar. Marca todos los
    turnos de agenda_medicos de ese médico en la semana indicada como
    certificados, con fecha y usuario que certificó.
    """
    await _asegurar_columnas_certificacion(db)

    hoy = (await db.execute(text("SELECT CURRENT_DATE AS hoy"))).scalar_one()
    inicio_semana = _inicio_de_semana(semana_desde, hoy)
    fin_semana = inicio_semana + timedelta(days=4)  # Lunes a viernes

    # Verificar que el médico exista y tenga horario en esa semana.
    medico = await _medico_especialista(db, medico_id)

    dias_certificados = await _certificar_dias_de_medico(
        db, medico_id, user.get("sub", ""), inicio_semana
    )
    if not dias_certificados:
        raise HTTPException(
            400,
            f"El médico {medico['nombre']} no tiene horario cargado para certificar.",
        )

    # Los pacientes que esperan cupo en esa semana se reparten en los días cargados.
    citas_asignadas = (
        await _asignar_citas_preasignadas_de_medico(db, medico_id, inicio_semana)
        if settings.REPARTO_AUTOMATICO
        else 0
    )
    await db.commit()

    await _auditar(
        db,
        "horario de médico certificado",
        {
            "medico_id": medico_id,
            "medico_nombre": medico["nombre"],
            "semana_desde": inicio_semana.isoformat(),
            "semana_hasta": fin_semana.isoformat(),
            "dias_certificados": dias_certificados,
            "citas_asignadas": citas_asignadas,
            "certificado_por": user.get("sub", ""),
        },
        user.get("sub", ""),
    )

    return {
        "message": "Horario certificado exitosamente.",
        "medico_id": medico_id,
        "medico_nombre": medico["nombre"],
        "semana_desde": inicio_semana.isoformat(),
        "semana_hasta": fin_semana.isoformat(),
        "dias_certificados": dias_certificados,
        "citas_asignadas": citas_asignadas,
    }


@router.post("/medicos/horario/certificar")
async def certificar_horarios_de_la_semana(
    semana_desde: Optional[str] = Query(
        None, description="Lunes de la semana a certificar (YYYY-MM-DD). Por defecto la semana actual."
    ),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Certifica el horario semanal de todos los especialistas y reparte la cola.

    Se toma la semana elegida, se certifican los días que cada médico tiene
    cargados y luego se asignan las citas preasignadas (pacientes en cola) de
    esa semana sobre esos días: primero trabajadores y beneficiarios de la
    nómina y después público general, con 10 cupos por día de atención y horas
    escalonadas cada 30 minutos.
    """
    await _asegurar_columnas_certificacion(db)

    hoy = (await db.execute(text("SELECT CURRENT_DATE AS hoy"))).scalar_one()
    inicio_semana = _inicio_de_semana(semana_desde, hoy)
    fin_semana = inicio_semana + timedelta(days=4)  # Lunes a viernes

    medicos = (
        await db.execute(
            text(
                "SELECT p.id, p.nombre, p.apellido FROM personal p "
                "WHERE EXISTS (SELECT 1 FROM agenda_medicos a "
                "              WHERE a.medico_id = p.id AND a.activo "
                "                AND a.dia_semana BETWEEN 0 AND 4) "
                "  AND ( (LOWER(COALESCE(p.cargo, '')) IN ('medico', 'médico') "
                "         AND p.especialidad IS NOT NULL) "
                "     OR EXISTS (SELECT 1 FROM usuarios u "
                "                WHERE u.personal_id = p.id "
                "                  AND u.rol = 'medico_emergencia') ) "
                "ORDER BY p.especialidad NULLS LAST, p.nombre"
            )
        )
    ).mappings().all()

    detalle = []
    total_dias = 0
    total_asignadas = 0
    total_sin_cupo = 0

    for medico in medicos:
        dias = await _certificar_dias_de_medico(
            db, medico["id"], user.get("sub", ""), inicio_semana
        )
        asignadas = (
            await _asignar_citas_preasignadas_de_medico(db, medico["id"], inicio_semana)
            if settings.REPARTO_AUTOMATICO
            else 0
        )
        sin_cupo = (
            await db.execute(
                text(
                    "SELECT COUNT(*) FROM citas "
                    "WHERE medico_id = :mid AND estado = 'preasignada' "
                    "  AND fecha_cita BETWEEN :ini AND :fin"
                ),
                {"mid": medico["id"], "ini": inicio_semana, "fin": fin_semana},
            )
        ).scalar() or 0

        total_dias += dias
        total_asignadas += asignadas
        total_sin_cupo += sin_cupo
        detalle.append(
            {
                "medico_id": medico["id"],
                "medico_nombre": f"{medico['nombre']} {medico['apellido']}".strip(),
                "dias_certificados": dias,
                "citas_asignadas": asignadas,
                "citas_sin_cupo": sin_cupo,
            }
        )

    await db.commit()

    await _auditar(
        db,
        "horarios de médicos certificados",
        {
            "semana_desde": inicio_semana.isoformat(),
            "semana_hasta": fin_semana.isoformat(),
            "medicos": len(medicos),
            "dias_certificados": total_dias,
            "citas_asignadas": total_asignadas,
            "citas_sin_cupo": total_sin_cupo,
            "certificado_por": user.get("sub", ""),
        },
        user.get("sub", ""),
    )

    return {
        "message": "Horarios certificados.",
        "semana_desde": inicio_semana.isoformat(),
        "semana_hasta": fin_semana.isoformat(),
        "total_medicos": len(medicos),
        "total_dias_certificados": total_dias,
        "total_citas_asignadas": total_asignadas,
        "total_citas_sin_cupo": total_sin_cupo,
        "medicos": detalle,
    }


# Prioridad de nómina en la cola de preasignación (menor = antes).
PRIORIDAD_AFILIACION = {"trabajador": 0, "beneficiario": 1, GENERAL: 2}


async def _ocupacion_semana(
    db: AsyncSession, medico_id: int, inicio_semana: date
) -> dict:
    """{fecha: ['HH:MM', ...]} con las horas ya ocupadas de lunes a viernes."""
    ocupacion = {inicio_semana + timedelta(days=i): [] for i in range(5)}
    filas = (
        await db.execute(
            text(
                "SELECT fecha_cita, to_char(hora_inicio, 'HH24:MI') AS h "
                "FROM citas "
                "WHERE medico_id = :mid AND fecha_cita BETWEEN :ini AND :fin "
                "  AND estado IN ('confirmada', 'pendiente')"
            ),
            {
                "mid": medico_id,
                "ini": inicio_semana,
                "fin": inicio_semana + timedelta(days=4),
            },
        )
    ).mappings()
    for fila in filas:
        if fila["h"]:
            ocupacion.setdefault(fila["fecha_cita"], []).append(fila["h"])
    return ocupacion


async def _asignar_citas_preasignadas_de_medico(
    db: AsyncSession, medico_id: int, semana_desde: Optional[date] = None
) -> int:
    """Reparte las citas preasignadas del médico en los días que va a atender.

    Reglas del reparto:
    - Solo semanas certificadas por RRHH (`agenda_certificaciones_semana`).
    - Prioridad de nómina: trabajadores, luego beneficiarios, luego público
      general; dentro de cada grupo se respeta el orden de solicitud (FIFO).
    - Cupo: 10 pacientes por día de atención (1 día = 10, 2 = 20, 3 = 30…),
      sin tope semanal extra, y ningún turno pasa de 10 citas.
    - Horas escalonadas: cada cita ocupa el primer bloque libre de 30 minutos
      del turno (08:00, 08:30, 09:00…), no todos a la hora de apertura.

    Si se indica `semana_desde` solo se consideran las citas en cola de esa
    semana.
    """
    agenda_filas = (
        await db.execute(
            text(
                "SELECT a.dia_semana, t.id AS turno_id, t.nombre AS turno_nombre, "
                "       t.hora_inicio, t.hora_fin "
                "FROM agenda_medicos a "
                "JOIN turnos t ON t.id = a.turno_id "
                "WHERE a.medico_id = :mid AND a.activo = TRUE "
                "  AND a.dia_semana BETWEEN 0 AND 4 "
                "ORDER BY a.dia_semana ASC, t.hora_inicio ASC"
            ),
            {"mid": medico_id},
        )
    ).mappings().all()

    dias_atendidos = sorted({f["dia_semana"] for f in agenda_filas})
    if not dias_atendidos:
        return 0

    # 10 cupos por cada día de atención activo (sin tope semanal de 20).
    cupo_semanal = MAX_CUPOS_DIA * len(dias_atendidos)

    filtro_semana = ""
    params: dict = {"mid": medico_id}
    if semana_desde:
        filtro_semana = " AND c.fecha_cita BETWEEN :ini AND :fin"
        params["ini"] = semana_desde
        params["fin"] = semana_desde + timedelta(days=4)

    preasignadas = (
        await db.execute(
            text(
                "SELECT c.id, c.fecha_cita, c.created_at, h.cedula AS paciente_cedula "
                "FROM citas c "
                "LEFT JOIN historias_clinicas h ON h.id = c.paciente_id "
                "WHERE c.medico_id = :mid AND c.estado = 'preasignada'"
                + filtro_semana
                + " ORDER BY c.created_at ASC"
            ),
            params,
        )
    ).mappings().all()

    if not preasignadas:
        return 0

    # Prioridad institucional: trabajadores y beneficiarios entran primero.
    categorias = await categorias_por_cedula(
        db, [c["paciente_cedula"] for c in preasignadas]
    )

    def _orden(cita) -> tuple:
        categoria = categorias.get(normalizar_cedula(cita["paciente_cedula"]), GENERAL)
        return (
            PRIORIDAD_AFILIACION.get(categoria, PRIORIDAD_AFILIACION[GENERAL]),
            cita["created_at"] or datetime.min,
        )

    preasignadas = sorted(preasignadas, key=_orden)

    # Solo se reparte en las semanas que RRHH certificó explícitamente.
    semanas_ref = {
        c["fecha_cita"] - timedelta(days=c["fecha_cita"].weekday())
        for c in preasignadas
    }
    certificadas = await semanas_certificadas(
        db, medico_id, min(semanas_ref), max(semanas_ref)
    )

    hoy = (await db.execute(text("SELECT CURRENT_DATE AS hoy"))).scalar_one()

    # Turnos agrupados por día para la función pura de reparto.
    turnos_por_dia: dict = {}
    for fila in agenda_filas:
        turnos_por_dia.setdefault(fila["dia_semana"], []).append(fila)

    total_asignadas = 0
    cupos_por_semana: dict = {}
    ocupacion_por_semana: dict = {}

    for cita in preasignadas:
        fecha_ref = cita["fecha_cita"]
        inicio_sem = fecha_ref - timedelta(days=fecha_ref.weekday())

        if inicio_sem not in certificadas:
            # Semana sin certificar: la cita sigue en cola de preasignación.
            continue

        if inicio_sem not in cupos_por_semana:
            usadas = (
                await db.execute(
                    text(
                        "SELECT COUNT(*) FROM citas "
                        "WHERE medico_id = :mid "
                        "  AND fecha_cita BETWEEN :ini AND :fin "
                        "  AND estado IN ('confirmada', 'pendiente')"
                    ),
                    {
                        "mid": medico_id,
                        "ini": inicio_sem,
                        "fin": inicio_sem + timedelta(days=4),
                    },
                )
            ).scalar() or 0
            cupos_por_semana[inicio_sem] = max(cupo_semanal - usadas, 0)

        if cupos_por_semana[inicio_sem] <= 0:
            # Semana completa: la cita sigue preasignada para otra semana.
            continue

        ocupacion = ocupacion_por_semana.get(inicio_sem)
        if ocupacion is None:
            ocupacion = await _ocupacion_semana(db, medico_id, inicio_sem)
            ocupacion_por_semana[inicio_sem] = ocupacion

        # Tope por día + por turno + bloques de 30 minutos (ver reparto_citas).
        hueco = elegir_hueco(
            inicio_sem, dias_atendidos, turnos_por_dia, hoy, ocupacion
        )
        if hueco is None:
            continue
        cur_dia, hora_asignada = hueco

        await db.execute(
            text(
                "UPDATE citas SET "
                "  fecha_cita = :fec, hora_inicio = :hora, estado = 'confirmada', "
                "  motivo = COALESCE(motivo, 'Asignada automáticamente al certificar horario') "
                "WHERE id = :id"
            ),
            {"fec": cur_dia, "hora": hora_asignada, "id": cita["id"]},
        )
        # La hora queda tomada para el resto del reparto de esa semana.
        ocupacion.setdefault(cur_dia, []).append(_hhmm(hora_asignada))
        total_asignadas += 1
        cupos_por_semana[inicio_sem] -= 1

    return total_asignadas


# ─── EMPLOYEES (NÓMINA) CRUD ─────────────────────────────────────

# Columnas reconocidas en la planilla de nómina (los alias ya llegan
# normalizados: minúsculas y sin tildes).
ALIAS_CEDULA_TITULAR = {
    "cedula", "cedula titular", "cedula del titular", "cedula trabajador",
    "cedula de identidad", "ci", "documento",
}
ALIAS_CEDULA_CARGA = {
    "cedula del asegurado", "cedula asegurado", "cedula beneficiario",
    "cedula del beneficiario", "cedula familiar", "cedula del familiar",
    "cedula del hijo", "cedula carga",
}
ALIAS_PARENTESCO = {"parentesco", "relacion", "vinculo"}
ALIAS_NOMBRE = {
    "nombre", "nombres", "nombre completo", "nombre y apellido",
    "nombre del trabajador", "trabajador",
}
ALIAS_PARTES_NOMBRE = {
    "primer apellido", "segundo apellido", "primer nombre", "segundo nombre",
}
ALIAS_FECHA_NAC = {"fecha de nacimiento", "fecha nacimiento", "f. nacimiento"}
ALIAS_GENERO = {"genero", "sexo"}
ALIAS_EDAD = {"edad"}
ALIAS_CARGO = {"cargo", "tipo de nomina", "profesion", "cargo o profesion"}
ALIAS_ENTE = {
    "ente", "organismo", "institucion", "institucion o ente",
    "dependencia", "entidad",
}
ALIAS_ESTADO = {"estado", "activo", "status"}

TODOS_LOS_ALIAS = (
    ALIAS_CEDULA_TITULAR | ALIAS_CEDULA_CARGA | ALIAS_PARENTESCO | ALIAS_NOMBRE
    | ALIAS_PARTES_NOMBRE | ALIAS_FECHA_NAC | ALIAS_GENERO | ALIAS_EDAD
    | ALIAS_CARGO | ALIAS_ENTE | ALIAS_ESTADO
)

PARENTESCO_TITULAR = ("titular", "trabajador", "cotizante", "asegurado")
MAX_FILAS_IMPORT = 20000


def _norm_texto(valor) -> str:
    """Texto de celda a minúsculas, sin tildes ni espacios repetidos."""
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    texto = unicodedata.normalize("NFKD", str(valor)).encode("ascii", "ignore").decode("ascii")
    return " ".join(texto.split()).rstrip(":").strip().lower()


def _texto(valor) -> str:
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    return " ".join(str(valor).split())


def _cedula(valor) -> str:
    """Cédula tal como se guarda en `empleados`: solo dígitos."""
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    texto = str(valor).strip()
    if texto.endswith(".0"):
        texto = texto[:-2]
    texto = re.sub(r"^[vejcg][-\s.]?", "", texto, flags=re.IGNORECASE)
    # Las cédulas pueden venir con puntos de miles: 1.166.094
    return re.sub(r"[\s\-.]", "", texto)


def _entero(valor):
    """Entero opcional; devuelve (valor, error)."""
    if valor is None or str(valor).strip() == "":
        return None, None
    if isinstance(valor, bool):
        return None, "no es un número"
    if isinstance(valor, (int, float)):
        numero = int(valor)
    else:
        limpio = re.sub(r"[^0-9-]", "", str(valor))
        if not limpio or not re.fullmatch(r"-?\d+", limpio):
            return None, "no es un número"
        numero = int(limpio)
    if not 0 <= numero <= 120:
        return None, "debe estar entre 0 y 120"
    return numero, None


def _booleano(valor):
    """Estado activo/inactivo; devuelve (valor|None si está vacío, error)."""
    if valor is None or str(valor).strip() == "":
        return None, None
    texto = _norm_texto(valor)
    if texto in {"si", "s", "true", "1", "activo", "act", "habilitado"}:
        return True, None
    if texto in {"no", "n", "false", "0", "inactivo", "desactivo", "deshabilitado"}:
        return False, None
    return None, "usa ACTIVO o INACTIVO"


def _fecha(valor):
    """Fecha opcional (celda de Excel, DD/MM/AAAA o AAAA-MM-DD)."""
    if valor is None or str(valor).strip() == "":
        return None, None
    if isinstance(valor, datetime):
        return valor.date(), None
    if isinstance(valor, date):
        return valor, None
    texto = str(valor).strip()
    for formato in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%d-%m-%Y", "%d-%m-%y"):
        try:
            return datetime.strptime(texto, formato).date(), None
        except ValueError:
            continue
    return None, "fecha inválida (usa DD/MM/AAAA)"


def _genero(valor):
    if valor is None or str(valor).strip() == "":
        return None, None
    texto = _norm_texto(valor)
    if texto in {"m", "masculino", "masc", "varon", "hombre"}:
        return "M", None
    if texto in {"f", "femenino", "fem", "mujer"}:
        return "F", None
    return _texto(valor)[:20] or None, None


def _parentesco(valor) -> str:
    texto = _norm_texto(valor).replace(" ", "")
    mapa = {
        "hijo(a)": "HIJO(A)",
        "hijo": "HIJO(A)",
        "hija": "HIJO(A)",
        "madre": "MADRE",
        "padre": "PADRE",
        "esposo(a)": "ESPOSO(A)",
        "esposo": "ESPOSO(A)",
        "esposa": "ESPOSO(A)",
        "concubino(a)": "CONCUBINO(A)",
        "concubino": "CONCUBINO(A)",
        "concubina": "CONCUBINO(A)",
        "hermano(a)": "HERMANO(A)",
        "hermano": "HERMANO(A)",
        "hermana": "HERMANO(A)",
    }
    return mapa.get(texto, texto.upper())


async def _leer_planilla(file: UploadFile) -> list:
    """Lee .xlsx/.xls/.csv y devuelve todas las filas con datos."""
    datos = await file.read()
    if not datos:
        raise HTTPException(400, "El archivo está vacío.")

    nombre = (file.filename or "").lower()
    if nombre.endswith((".csv", ".txt", ".tsv")):
        try:
            texto = datos.decode("utf-8-sig")
        except UnicodeDecodeError:
            texto = datos.decode("latin-1")
        lineas = [l for l in texto.splitlines() if l.strip()]
        if not lineas:
            raise HTTPException(400, "El archivo no tiene filas.")
        separador = ";" if lineas[0].count(";") >= lineas[0].count(",") else ","
        filas = list(csv.reader(lineas, delimiter=separador))
    else:
        try:
            libro = openpyxl.load_workbook(io.BytesIO(datos), read_only=True, data_only=True)
        except Exception:
            raise HTTPException(
                400, "No se pudo leer el archivo. Usa .xlsx, .xls o .csv válido."
            )
        try:
            hoja = libro.active
            filas = [
                [("" if c is None else c) for c in fila]
                for fila in hoja.iter_rows(values_only=True)
            ]
        finally:
            libro.close()

    filas = [
        f for f in filas
        if any(c is not None and str(c).strip() != "" for c in f)
    ]
    if not filas:
        raise HTTPException(400, "El archivo no tiene filas.")
    return filas


def _fila_cabecera(filas: list) -> int:
    """Localiza el encabezado aunque arriba haya filas vacías o de título."""
    for indice, fila in enumerate(filas[:15]):
        coincidencias = sum(1 for c in fila if _norm_texto(c) in TODOS_LOS_ALIAS)
        if coincidencias >= 2:
            return indice
    raise HTTPException(
        400,
        {
            "mensaje": (
                "No se encontraron los encabezados de la planilla. La primera fila "
                "con datos debe tener columnas como Cédula, Nombre, Parentesco..."
            ),
            "columnas": [],
        },
    )


def _mapear_columnas(cabecera: list) -> dict:
    hdr = [_norm_texto(c) for c in cabecera]

    def buscar(alias):
        for indice, encabezado in enumerate(hdr):
            if encabezado in alias:
                return indice
        return None

    cedula = buscar(ALIAS_CEDULA_TITULAR)
    cedula_carga = buscar(ALIAS_CEDULA_CARGA)
    parentesco = buscar(ALIAS_PARENTESCO)
    nombre = buscar(ALIAS_NOMBRE)

    modo = (
        "nomina"
        if cedula is not None and cedula_carga is not None and parentesco is not None
        else "resumen"
    )

    columnas = {
        "modo": modo,
        "cedula": cedula,
        "nombre": nombre,
        "edad": buscar(ALIAS_EDAD),
        "cargo": buscar(ALIAS_CARGO),
        "ente": buscar(ALIAS_ENTE),
        "activo": buscar(ALIAS_ESTADO),
        "fecha_nac": buscar(ALIAS_FECHA_NAC),
        "genero": buscar(ALIAS_GENERO),
    }

    faltantes = []
    if cedula is None:
        faltantes.append("Cédula del titular")

    if modo == "nomina":
        columnas["cedula_carga"] = cedula_carga
        columnas["parentesco"] = parentesco
        partes = [i for i, h in enumerate(hdr) if h in ALIAS_PARTES_NOMBRE]
        columnas["partes_titular"] = [i for i in partes if cedula < i < cedula_carga][:4]
        columnas["partes_carga"] = [i for i in partes if cedula_carga < i < parentesco][:4]
        if not columnas["partes_titular"] and nombre is None:
            faltantes.append("Nombre del titular")
        if not columnas["partes_carga"]:
            faltantes.append("Nombre de la carga (apellidos y nombres)")
    elif nombre is None:
        faltantes.append("Nombre")

    if faltantes:
        raise HTTPException(
            400,
            {
                "mensaje": "Faltan columnas obligatorias en la planilla.",
                "faltantes": faltantes,
                "columnas": [c for c in hdr if c],
            },
        )
    return columnas


def _nombre_de_fila(fila: list, indices: list) -> str:
    """Arma 'Nombres Apellidos' desde PRIMER/SEGUNDO NOMBRE y APELLIDO."""
    valores = [str(fila[i] or "").strip() if i < len(fila) else "" for i in indices]
    if len(valores) >= 4:
        p_ap, s_ap, p_nom, s_nom = valores[:4]
        return " ".join(x for x in (p_nom, s_nom, p_ap, s_ap) if x)
    return " ".join(x for x in valores if x)


def _validar_filas(datos: list, col: dict, primera_fila: int) -> tuple:
    """Valida titulares y cargas. Devuelve (titulares, cargas, errores, repetidas)."""
    modo = col["modo"]

    def val(fila, clave):
        indice = col.get(clave)
        if indice is None or indice >= len(fila):
            return None
        return fila[indice]

    titulares = {}
    cargas = {}
    errores = []
    vistos = {}
    cargas_repetidas = 0

    for offset, fila in enumerate(datos):
        numero = primera_fila + offset
        problemas = []

        cedula = _cedula(val(fila, "cedula"))
        if not re.fullmatch(r"\d{4,12}", cedula):
            problemas.append("cédula del titular inválida (solo dígitos, 4 a 12)")

        if modo == "nomina":
            nombre = _nombre_de_fila(fila, col["partes_titular"])
        else:
            nombre = _texto(val(fila, "nombre"))
        if not nombre:
            problemas.append("nombre del titular vacío")
        elif len(nombre) > 200:
            problemas.append("nombre del titular demasiado largo (máx. 200)")

        if modo == "resumen" and cedula:
            if cedula in vistos:
                problemas.append(f"cédula duplicada (ya aparece en la fila {vistos[cedula]})")
            else:
                vistos[cedula] = numero

        cedula_carga = _cedula(val(fila, "cedula_carga")) if modo == "nomina" else ""
        parentesco = _texto(val(fila, "parentesco")) if modo == "nomina" else ""
        parentesco_norm = _parentesco(parentesco)
        es_carga = (
            bool(cedula_carga)
            and cedula_carga != cedula
            and not parentesco_norm.lower().startswith(PARENTESCO_TITULAR)
        )

        nombre_carga = ""
        if es_carga:
            nombre_carga = _nombre_de_fila(fila, col["partes_carga"])
            if not re.fullmatch(r"\d{4,12}", cedula_carga):
                problemas.append(f"cédula de la carga inválida ({cedula_carga or 'vacía'})")
            if not parentesco:
                problemas.append("parentesco de la carga vacío")
            if not nombre_carga:
                problemas.append("nombre de la carga vacío")
            elif len(nombre_carga) > 200:
                problemas.append("nombre de la carga demasiado largo (máx. 200)")

        edad, error_edad = _entero(val(fila, "edad"))
        if error_edad:
            problemas.append(f"edad {error_edad}")

        fecha_nac, error_fecha = _fecha(val(fila, "fecha_nac"))
        if error_fecha:
            problemas.append(error_fecha)

        genero, error_genero = _genero(val(fila, "genero"))
        if error_genero:
            problemas.append(error_genero)

        cargo = _texto(val(fila, "cargo"))
        if len(cargo) > 150:
            problemas.append("cargo demasiado largo (máx. 150)")

        ente = _texto(val(fila, "ente"))
        if len(ente) > 120:
            problemas.append("ente demasiado largo (máx. 120)")

        activo, error_activo = _booleano(val(fila, "activo"))
        if error_activo:
            problemas.append(f"estado {error_activo}")

        if problemas:
            errores.append({
                "fila": numero,
                "cedula": cedula or cedula_carga,
                "error": "; ".join(problemas),
            })
            continue

        titular = titulares.setdefault(cedula, {"cedula": cedula})
        titular["nombre"] = nombre
        if cargo:
            titular["cargo"] = cargo
        if ente:
            titular["ente"] = ente

        if es_carga:
            if cedula_carga in cargas:
                cargas_repetidas += 1
                continue
            cargas[cedula_carga] = {
                "cedula": cedula_carga,
                "titular": cedula,
                "nombre": nombre_carga,
                "parentesco": parentesco_norm,
                "edad": edad,
                "fecha_nacimiento": fecha_nac,
                "genero": genero,
            }
        else:
            # La fila describe al titular: edad, fecha y género son suyos.
            if edad is not None:
                titular["edad"] = edad
            if fecha_nac:
                titular["fecha_nacimiento"] = fecha_nac
            if genero:
                titular["genero"] = genero
            if activo is not None:
                titular["activo"] = activo

    return titulares, cargas, errores, cargas_repetidas


@router.post("/empleados/importar")
async def importar_nomina(
    file: UploadFile = File(...),
    modo: str = Query("validar", description="validar | aplicar"),
    ente: Optional[str] = Query(
        None,
        description="Ente u organismo por defecto si el archivo no trae columna ENTE",
    ),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Ingesta masiva de nómina desde Excel/CSV (trabajadores y cargas).

    `modo=validar` solo valida y devuelve el resumen (sin escribir).
    `modo=aplicar` inserta y actualiza en una sola transacción: o se aplican
    todas las filas o ninguna. El cruce es por cédula, nunca se borra a quien
    no esté en el archivo y las celdas vacías no borran datos existentes.

    Acepta dos formatos:
    - Resumen: cédula, nombre, edad, cargo, estado, ente.
    - Nómina completa: el layout del sistema (cédula titular + datos del
      titular + cédula del asegurado + datos de la carga + parentesco...),
      donde la misma cédula titular se repite una vez por cada carga.
    """
    if modo not in {"validar", "aplicar"}:
        raise HTTPException(400, "modo inválido: debe ser validar o aplicar.")

    ente_param = (ente or "").strip() or None

    filas = await _leer_planilla(file)
    indice_cabecera = _fila_cabecera(filas)
    col = _mapear_columnas(filas[indice_cabecera])
    datos = filas[indice_cabecera + 1:]

    if len(datos) > MAX_FILAS_IMPORT:
        raise HTTPException(400, f"Máximo {MAX_FILAS_IMPORT} filas por importación.")

    titulares, cargas, errores, cargas_repetidas = _validar_filas(
        datos, col, primera_fila=indice_cabecera + 2
    )

    for registro in titulares.values():
        if not registro.get("ente") and ente_param:
            registro["ente"] = ente_param

    # ── Estado actual en la base para separar altas de actualizaciones ──
    cedulas_titular = list(titulares)
    id_por_cedula = {}
    if cedulas_titular:
        r = await db.execute(
            text("SELECT cedula, id::text FROM empleados WHERE cedula = ANY(:c)"),
            {"c": cedulas_titular},
        )
        id_por_cedula = {f[0]: f[1] for f in r.all()}

    cedulas_carga = list(cargas)
    carga_existente = {}
    if cedulas_carga:
        r = await db.execute(
            text(
                "SELECT cedula, empleado_id::text FROM beneficiarios "
                "WHERE cedula = ANY(:c)"
            ),
            {"c": cedulas_carga},
        )
        carga_existente = {f[0]: f[1] for f in r.all()}

    a_crear = [t for t in titulares.values() if t["cedula"] not in id_por_cedula]
    a_actualizar = [t for t in titulares.values() if t["cedula"] in id_por_cedula]
    cargas_crear = [c for c in cargas.values() if c["cedula"] not in carga_existente]
    cargas_actualizar = [c for c in cargas.values() if c["cedula"] in carga_existente]
    cargas_reasignadas = sum(
        1
        for c in cargas_actualizar
        if carga_existente.get(c["cedula"])
        and id_por_cedula.get(c["titular"])
        and carga_existente[c["cedula"]] != id_por_cedula[c["titular"]]
    )

    resumen = {
        "modo": modo,
        "modo_planilla": col["modo"],
        "archivo": file.filename or "",
        "filas": len(datos),
        "titulares": len(titulares),
        "a_crear": len(a_crear),
        "a_actualizar": len(a_actualizar),
        "cargas": len(cargas),
        "cargas_crear": len(cargas_crear),
        "cargas_actualizar": len(cargas_actualizar),
        "cargas_reasignadas": cargas_reasignadas,
        "cargas_repetidas": cargas_repetidas,
        "ente": ente_param,
        "columnas": [c for c in [_norm_texto(x) for x in filas[indice_cabecera]] if c],
        "errores": errores,
    }

    if modo == "validar":
        return resumen
    if errores:
        return JSONResponse(
            status_code=400,
            content={
                **resumen,
                "mensaje": "Corrige las filas con errores y vuelve a importar.",
            },
        )

    try:
        if a_crear:
            await db.execute(
                text(
                    "INSERT INTO empleados "
                    "(cedula, nombre_completo, edad, cargo, activo, "
                    " fecha_nacimiento, genero, ente) "
                    "VALUES (:cedula, :nombre, :edad, :cargo, :activo, "
                    "        :fecha_nacimiento, :genero, :ente)"
                ),
                [
                    {
                        "cedula": t["cedula"],
                        "nombre": t["nombre"],
                        "edad": t.get("edad"),
                        "cargo": t.get("cargo"),
                        "activo": t.get("activo", True),
                        "fecha_nacimiento": t.get("fecha_nacimiento"),
                        "genero": t.get("genero"),
                        "ente": t.get("ente"),
                    }
                    for t in a_crear
                ],
            )

        if a_actualizar:
            # COALESCE: si la celda vino vacía (None) se conserva el valor actual.
            await db.execute(
                text(
                    "UPDATE empleados SET "
                    "  nombre_completo = :nombre, "
                    "  edad = COALESCE(:edad, edad), "
                    "  cargo = COALESCE(:cargo, cargo), "
                    "  activo = COALESCE(:activo, activo), "
                    "  fecha_nacimiento = COALESCE(:fecha_nacimiento, fecha_nacimiento), "
                    "  genero = COALESCE(:genero, genero), "
                    "  ente = COALESCE(:ente, ente) "
                    "WHERE cedula = :cedula"
                ),
                [
                    {
                        "cedula": t["cedula"],
                        "nombre": t["nombre"],
                        "edad": t.get("edad"),
                        "cargo": t.get("cargo"),
                        "activo": t.get("activo"),
                        "fecha_nacimiento": t.get("fecha_nacimiento"),
                        "genero": t.get("genero"),
                        "ente": t.get("ente"),
                    }
                    for t in a_actualizar
                ],
            )

        if cargas:
            # Los titulares nuevos ya existen: se releen los ids para enlazar.
            r = await db.execute(
                text("SELECT cedula, id::text FROM empleados WHERE cedula = ANY(:c)"),
                {"c": cedulas_titular},
            )
            id_por_cedula = {f[0]: f[1] for f in r.all()}

            def params_carga(c):
                return {
                    "empleado_id": id_por_cedula[c["titular"]],
                    "cedula": c["cedula"],
                    "nombre": c["nombre"],
                    "parentesco": c["parentesco"],
                    "fecha_nacimiento": c.get("fecha_nacimiento"),
                    "genero": c.get("genero"),
                }

            if cargas_crear:
                await db.execute(
                    text(
                        "INSERT INTO beneficiarios "
                        "(empleado_id, cedula, nombre_completo, parentesco, activo, "
                        " fecha_nacimiento, genero) "
                        "VALUES (:empleado_id, :cedula, :nombre, :parentesco, TRUE, "
                        "        :fecha_nacimiento, :genero)"
                    ),
                    [params_carga(c) for c in cargas_crear],
                )

            if cargas_actualizar:
                await db.execute(
                    text(
                        "UPDATE beneficiarios SET "
                        "  empleado_id = :empleado_id, "
                        "  nombre_completo = :nombre, "
                        "  parentesco = :parentesco, "
                        "  fecha_nacimiento = COALESCE(:fecha_nacimiento, fecha_nacimiento), "
                        "  genero = COALESCE(:genero, genero) "
                        "WHERE cedula = :cedula"
                    ),
                    [params_carga(c) for c in cargas_actualizar],
                )

        await db.commit()
    except Exception as err:
        await db.rollback()
        raise HTTPException(
            500,
            f"No se aplicó nada (transacción revertida): {err}",
        )

    try:
        await _auditar(
            db,
            "importación masiva de nómina",
            {
                "archivo": file.filename or "",
                "ente": ente_param,
                "creados": len(a_crear),
                "actualizados": len(a_actualizar),
                "cargas_creadas": len(cargas_crear),
                "cargas_actualizadas": len(cargas_actualizar),
            },
            user.get("sub", ""),
        )
    except Exception:
        pass  # la auditoría no debe hacer fallar una importación ya aplicada

    return {
        **resumen,
        "modo": "aplicar",
        "creados": len(a_crear),
        "actualizados": len(a_actualizar),
        "mensaje": (
            f"{len(a_crear)} trabajador(es) nuevos, "
            f"{len(a_actualizar)} actualizado(s), "
            f"{len(cargas_crear)} carga(s) nuevas y "
            f"{len(cargas_actualizar)} actualizada(s)."
        ),
    }


@router.get("/empleados")
async def listar_empleados(
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=8, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    where = "WHERE 1=1"
    params = {}
    if q.strip():
        where += (
            " AND (e.nombre_completo ILIKE :q OR e.cedula ILIKE :q "
            "OR e.cargo ILIKE :q OR e.ente ILIKE :q)"
        )
        params["q"] = f"%{q.strip()}%"

    count_result = await db.execute(
        text(f"SELECT COUNT(*) FROM empleados e {where}"), params
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * per_page
    result = await db.execute(
        text(
            f"SELECT e.id, e.cedula, e.nombre_completo, e.edad, e.cargo, e.ente, "
            f"e.activo, e.created_at, "
            f"(SELECT COUNT(*) FROM beneficiarios b WHERE b.empleado_id = e.id) AS num_beneficiarios "
            f"FROM empleados e "
            f"{where} "
            f"ORDER BY e.created_at DESC "
            f"LIMIT :limit OFFSET :offset"
        ),
        {**params, "limit": per_page, "offset": offset},
    )
    items = []
    for r in result.mappings():
        items.append({
            "id": str(r["id"]),
            "cedula": r["cedula"],
            "nombre_completo": r["nombre_completo"],
            "edad": r["edad"],
            "cargo": r["cargo"] or "",
            "ente": r["ente"] or "",
            "activo": r["activo"],
            "created_at": str(r["created_at"])[:19] if r["created_at"] else None,
            "num_beneficiarios": r["num_beneficiarios"] or 0,
        })
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.get("/empleados/opciones")
async def opciones_empleados(db: AsyncSession = Depends(get_db)):
    """Lista ligera de empleados activos (para transferir beneficiarios)."""
    result = await db.execute(
        text("SELECT id, cedula, nombre_completo FROM empleados WHERE activo = TRUE ORDER BY nombre_completo")
    )
    return [{"id": str(r["id"]), "cedula": r["cedula"], "nombre_completo": r["nombre_completo"]} for r in result.mappings()]


@router.post("/empleados", status_code=status.HTTP_201_CREATED)
async def crear_empleado(
    payload: EmpleadoCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    exists = await db.execute(
        text("SELECT id FROM empleados WHERE cedula = :c"), {"c": payload.cedula.strip()}
    )
    if exists.first():
        raise HTTPException(409, "Ya existe un empleado con esa cédula.")

    new_id = uuid4()
    await db.execute(
        text(
            "INSERT INTO empleados (id, cedula, nombre_completo, edad, cargo, ente, activo, created_at) "
            "VALUES (:id, :ced, :nom, :edad, :car, :ente, TRUE, NOW())"
        ),
        {
            "id": new_id,
            "ced": payload.cedula.strip(),
            "nom": payload.nombre_completo.strip(),
            "edad": payload.edad,
            "car": payload.cargo,
            "ente": (payload.ente or "").strip() or None,
        },
    )
    await _auditar(db, "empleado creado", {"empleado_id": str(new_id), "cedula": payload.cedula.strip()}, user.get("sub", ""))
    return {"id": str(new_id), "message": "Empleado creado exitosamente."}


@router.put("/empleados/{empleado_id}")
async def actualizar_empleado(
    empleado_id: str,
    payload: EmpleadoUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    exists = await db.execute(text("SELECT id, activo FROM empleados WHERE id = :id"), {"id": empleado_id})
    fila = exists.first()
    if not fila:
        raise HTTPException(404, "Empleado no encontrado.")

    updates = {}
    if payload.cedula is not None:
        updates["cedula"] = payload.cedula.strip()
    if payload.nombre_completo is not None:
        updates["nombre_completo"] = payload.nombre_completo.strip()
    if payload.edad is not None:
        updates["edad"] = payload.edad
    if payload.cargo is not None:
        updates["cargo"] = payload.cargo
    if payload.ente is not None:
        updates["ente"] = payload.ente.strip() or None
    if payload.activo is not None:
        updates["activo"] = payload.activo

    if not updates:
        raise HTTPException(400, "Sin cambios para actualizar.")

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = empleado_id
    await db.execute(text(f"UPDATE empleados SET {set_clause} WHERE id = :id"), updates)

    # Cascada: activar/desactivar trabajador propaga a sus beneficiarios.
    if payload.activo is not None and payload.activo != fila[1]:
        await db.execute(
            text("UPDATE beneficiarios SET activo = :a WHERE empleado_id = :id"),
            {"a": payload.activo, "id": empleado_id},
        )
        await _auditar(
            db,
            "empleado reactivado" if payload.activo else "empleado desactivado",
            {"empleado_id": empleado_id, "activo": payload.activo},
            user.get("sub", ""),
        )
    return {"message": "Empleado actualizado."}


@router.delete("/empleados/{empleado_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_empleado(
    empleado_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    exists = await db.execute(text("SELECT id, cedula FROM empleados WHERE id = :id"), {"id": empleado_id})
    fila = exists.first()
    if not fila:
        raise HTTPException(404, "Empleado no encontrado.")

    # Borrado blando: desactiva al trabajador y a todos sus beneficiarios.
    await db.execute(text("UPDATE empleados SET activo = FALSE WHERE id = :id"), {"id": empleado_id})
    await db.execute(
        text("UPDATE beneficiarios SET activo = FALSE WHERE empleado_id = :id"),
        {"id": empleado_id},
    )
    await _auditar(
        db, "empleado borrado (desactivado con beneficiarios)",
        {"empleado_id": empleado_id, "cedula": fila[1]}, user.get("sub", ""),
    )


# ─── CARGAS FAMILIARES (BENEFICIARIOS) ───────────────────────────

async def _empleado_activo(db: AsyncSession, empleado_id: str):
    fila = await db.execute(
        text("SELECT id, activo FROM empleados WHERE id = :id"), {"id": empleado_id}
    )
    row = fila.first()
    if not row:
        raise HTTPException(404, "Trabajador no encontrado.")
    if not row[1]:
        raise HTTPException(409, "El trabajador está inactivo; active primero al trabajador.")
    return row


@router.get("/empleados/{empleado_id}/beneficiarios", response_model=list[BeneficiarioOut])
async def listar_beneficiarios(
    empleado_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("SELECT id, cedula, nombre_completo, parentesco, activo FROM beneficiarios "
             "WHERE empleado_id = :id ORDER BY created_at DESC"),
        {"id": empleado_id},
    )
    return [
        {
            "id": str(r["id"]),
            "cedula": r["cedula"],
            "nombre_completo": r["nombre_completo"],
            "parentesco": r["parentesco"],
            "activo": r["activo"],
        }
        for r in result.mappings()
    ]


@router.post("/empleados/{empleado_id}/beneficiarios",
             response_model=BeneficiarioOut, status_code=status.HTTP_201_CREATED)
async def crear_beneficiario(
    empleado_id: str,
    payload: BeneficiarioCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    await _empleado_activo(db, empleado_id)
    exists = await db.execute(
        text("SELECT id FROM beneficiarios WHERE cedula = :c"), {"c": payload.cedula.strip()}
    )
    if exists.first():
        raise HTTPException(409, "Ya existe un beneficiario con esa cédula.")

    new_id = uuid4()
    await db.execute(
        text("INSERT INTO beneficiarios (id, empleado_id, cedula, nombre_completo, parentesco, activo, created_at) "
             "VALUES (:id, :emp, :ced, :nom, :par, TRUE, NOW())"),
        {
            "id": new_id, "emp": empleado_id, "ced": payload.cedula.strip(),
            "nom": payload.nombre_completo.strip(), "par": payload.parentesco,
        },
    )
    await _auditar(db, "carga familiar agregada",
                   {"beneficiario_id": str(new_id), "empleado_id": empleado_id, "cedula": payload.cedula.strip()},
                   user.get("sub", ""))
    return {"id": str(new_id), "cedula": payload.cedula.strip(),
            "nombre_completo": payload.nombre_completo.strip(), "parentesco": payload.parentesco, "activo": True}


@router.put("/beneficiarios/{beneficiario_id}", response_model=BeneficiarioOut)
async def actualizar_beneficiario(
    beneficiario_id: str,
    payload: BeneficiarioUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    exists = await db.execute(
        text("SELECT id, empleado_id, cedula, activo FROM beneficiarios WHERE id = :id"), {"id": beneficiario_id}
    )
    fila = exists.first()
    if not fila:
        raise HTTPException(404, "Beneficiario no encontrado.")

    if payload.cedula is not None:
        dup = await db.execute(
            text("SELECT id FROM beneficiarios WHERE cedula = :c AND id <> :id"),
            {"c": payload.cedula.strip(), "id": beneficiario_id},
        )
        if dup.first():
            raise HTTPException(409, "Ya existe un beneficiario con esa cédula.")

    updates = {}
    if payload.cedula is not None:
        updates["cedula"] = payload.cedula.strip()
    if payload.nombre_completo is not None:
        updates["nombre_completo"] = payload.nombre_completo.strip()
    if payload.parentesco is not None:
        updates["parentesco"] = payload.parentesco
    if payload.activo is not None:
        updates["activo"] = payload.activo
    if payload.empleado_id is not None and payload.empleado_id != fila[1]:
        # Transferencia entre trabajadores: el destino debe existir y estar activo.
        await _empleado_activo(db, payload.empleado_id)
        updates["empleado_id"] = payload.empleado_id

    if not updates:
        raise HTTPException(400, "Sin cambios para actualizar.")

    # Invariante: un beneficiario activo solo puede pertenecer a un trabajador activo.
    empleado_final = updates.get("empleado_id", fila[1])
    activo_final = updates.get("activo", fila[3])
    if activo_final:
        await _empleado_activo(db, empleado_final)

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = beneficiario_id
    await db.execute(text(f"UPDATE beneficiarios SET {set_clause} WHERE id = :id"), updates)
    await _auditar(db, "carga familiar actualizada",
                   {"beneficiario_id": beneficiario_id, "cambios": {k: str(v) for k, v in updates.items() if k != "id"}},
                   user.get("sub", ""))

    result = await db.execute(
        text("SELECT id, cedula, nombre_completo, parentesco, activo FROM beneficiarios WHERE id = :id"),
        {"id": beneficiario_id},
    )
    r = result.first()
    return {"id": str(r[0]), "cedula": r[1], "nombre_completo": r[2], "parentesco": r[3], "activo": r[4]}


@router.delete("/beneficiarios/{beneficiario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_beneficiario(
    beneficiario_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    exists = await db.execute(text("SELECT id, cedula FROM beneficiarios WHERE id = :id"), {"id": beneficiario_id})
    fila = exists.first()
    if not fila:
        raise HTTPException(404, "Beneficiario no encontrado.")
    await db.execute(text("UPDATE beneficiarios SET activo = FALSE WHERE id = :id"), {"id": beneficiario_id})
    await _auditar(db, "carga familiar desactivada",
                   {"beneficiario_id": beneficiario_id, "cedula": fila[1]}, user.get("sub", ""))


@router.post("/beneficiarios/{beneficiario_id}/promover", status_code=status.HTTP_201_CREATED)
async def promover_beneficiario(
    beneficiario_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """El beneficiario pasa a ser empleado: crea el trabajador y desactiva la carga."""
    exists = await db.execute(
        text("SELECT id, empleado_id, cedula, nombre_completo, parentesco FROM beneficiarios WHERE id = :id"),
        {"id": beneficiario_id},
    )
    fila = exists.first()
    if not fila:
        raise HTTPException(404, "Beneficiario no encontrado.")

    exists_emp = await db.execute(
        text("SELECT id FROM empleados WHERE cedula = :c"), {"c": fila[2]}
    )
    if exists_emp.first():
        raise HTTPException(409, "Esa cédula ya es empleado.")

    new_id = uuid4()
    await db.execute(
        text("INSERT INTO empleados (id, cedula, nombre_completo, cargo, activo, created_at) "
             "VALUES (:id, :ced, :nom, :car, TRUE, NOW())"),
        {"id": new_id, "ced": fila[2], "nom": fila[3], "car": fila[4]},
    )
    await db.execute(text("UPDATE beneficiarios SET activo = FALSE WHERE id = :id"), {"id": beneficiario_id})
    await _auditar(db, "beneficiario promovido a empleado",
                   {"beneficiario_id": beneficiario_id, "cedula": fila[2], "nuevo_empleado_id": str(new_id)},
                   user.get("sub", ""))
    return {"id": str(new_id), "message": "Beneficiario promovido a empleado."}


# ─── SYSTEM LOGS ──────────────────────────────────────────────────

@router.get("/logs")
async def listar_logs(
    nivel: str = Query(default="", description="Filtrar por nivel: ERROR, WARNING, INFO"),
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    # Asegurar que la tabla de logs existe
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS system_logs (
            id SERIAL PRIMARY KEY,
            nivel VARCHAR(20) NOT NULL DEFAULT 'INFO',
            mensaje TEXT NOT NULL,
            fuente VARCHAR(100),
            detalle TEXT,
            creado_en TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    await db.commit()

    where = "WHERE 1=1"
    params = {}
    if nivel.strip():
        where += " AND nivel = :nivel"
        params["nivel"] = nivel.strip().upper()
    if q.strip():
        where += " AND (mensaje ILIKE :q OR fuente ILIKE :q)"
        params["q"] = f"%{q.strip()}%"

    count_result = await db.execute(
        text(f"SELECT COUNT(*) FROM system_logs {where}"), params
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * per_page
    result = await db.execute(
        text(
            f"SELECT id, nivel, mensaje, fuente, detalle, creado_en "
            f"FROM system_logs {where} "
            f"ORDER BY creado_en DESC "
            f"LIMIT :limit OFFSET :offset"
        ),
        {**params, "limit": per_page, "offset": offset},
    )
    items = []
    for r in result.mappings():
        items.append({
            "id": r["id"],
            "nivel": r["nivel"],
            "mensaje": r["mensaje"],
            "fuente": r["fuente"] or "",
            "detalle": r["detalle"] or "",
            "creado_en": str(r["creado_en"])[:19] if r["creado_en"] else None,
        })
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.post("/logs", status_code=status.HTTP_201_CREATED)
async def crear_log(
    nivel: str = "INFO",
    mensaje: str = "",
    fuente: str = "",
    detalle: str = "",
    db: AsyncSession = Depends(get_db),
):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS system_logs (
            id SERIAL PRIMARY KEY,
            nivel VARCHAR(20) NOT NULL DEFAULT 'INFO',
            mensaje TEXT NOT NULL,
            fuente VARCHAR(100),
            detalle TEXT,
            creado_en TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    await db.execute(
        text(
            "INSERT INTO system_logs (nivel, mensaje, fuente, detalle, creado_en) "
            "VALUES (:nivel, :mensaje, :fuente, :detalle, NOW())"
        ),
        {"nivel": nivel.upper(), "mensaje": mensaje, "fuente": fuente, "detalle": detalle},
    )
    return {"message": "Log registrado."}


@router.delete("/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_log(log_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM system_logs WHERE id = :id"), {"id": log_id})


@router.get("/logs/stats")
async def stats_logs(db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS system_logs (
            id SERIAL PRIMARY KEY,
            nivel VARCHAR(20) NOT NULL DEFAULT 'INFO',
            mensaje TEXT NOT NULL,
            fuente VARCHAR(100),
            detalle TEXT,
            creado_en TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    result = await db.execute(text(
        "SELECT nivel, COUNT(*) as total FROM system_logs GROUP BY nivel ORDER BY total DESC"
    ))
    stats = [{"nivel": r.nivel, "total": r.total} for r in result.mappings()]

    total_result = await db.execute(text("SELECT COUNT(*) FROM system_logs"))
    total = total_result.scalar() or 0

    return {"total": total, "por_nivel": stats}
