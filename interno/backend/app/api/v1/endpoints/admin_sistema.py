"""Administración de Sistema: CRUD de usuarios, gestión de nómina y logs."""
import json
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user

router = APIRouter(tags=["Admin Sistema"])


# ─── SCHEMAS ──────────────────────────────────────────────────────

class UsuarioCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=60)
    password: str = Field(..., min_length=6, max_length=120)
    rol: str = Field(..., min_length=3, max_length=60)
    personal_id: Optional[int] = None
    activo: bool = True


class UsuarioUpdate(BaseModel):
    password: Optional[str] = Field(None, min_length=6, max_length=120)
    rol: Optional[str] = None
    activo: Optional[bool] = None
    personal_id: Optional[int] = None


class EmpleadoCreate(BaseModel):
    cedula: str = Field(..., min_length=5, max_length=20)
    nombre_completo: str = Field(..., min_length=2, max_length=200)
    edad: Optional[int] = None
    cargo: Optional[str] = None


class EmpleadoUpdate(BaseModel):
    cedula: Optional[str] = None
    nombre_completo: Optional[str] = None
    edad: Optional[int] = None
    cargo: Optional[str] = None
    activo: Optional[bool] = None


class BeneficiarioOut(BaseModel):
    id: str
    cedula: str
    nombre_completo: str
    parentesco: Optional[str] = None
    activo: bool


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
}


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
            f"SELECT u.id, u.username, u.rol, u.personal_id, u.activo, u.created_at, "
            f"p.nombre, p.apellido, p.cedula, p.cargo "
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
            "activo": r["activo"],
            "created_at": str(r["created_at"])[:19] if r["created_at"] else None,
            "nombre": r["nombre"] or "",
            "apellido": r["apellido"] or "",
            "cedula": r["cedula"] or "",
            "cargo": r["cargo"] or "",
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

    password_hash = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    new_id = uuid4()
    await db.execute(
        text(
            "INSERT INTO usuarios (id, username, password_hash, rol, personal_id, activo, created_at) "
            "VALUES (:id, :username, :pw, :rol, :pid, :activo, NOW())"
        ),
        {
            "id": new_id,
            "username": payload.username.lower().strip(),
            "pw": password_hash,
            "rol": payload.rol,
            "pid": payload.personal_id,
            "activo": payload.activo,
        },
    )
    return {"id": str(new_id), "message": "Usuario creado exitosamente."}


@router.put("/usuarios/{usuario_id}")
async def actualizar_usuario(usuario_id: str, payload: UsuarioUpdate, db: AsyncSession = Depends(get_db)):
    exists = await db.execute(text("SELECT id FROM usuarios WHERE id = :id"), {"id": usuario_id})
    if not exists.first():
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
    if payload.personal_id is not None:
        updates["personal_id"] = payload.personal_id

    if not updates:
        raise HTTPException(400, "Sin cambios para actualizar.")

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = usuario_id
    await db.execute(text(f"UPDATE usuarios SET {set_clause} WHERE id = :id"), updates)
    return {"message": "Usuario actualizado."}


@router.delete("/usuarios/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_usuario(usuario_id: str, db: AsyncSession = Depends(get_db)):
    exists = await db.execute(text("SELECT id, username FROM usuarios WHERE id = :id"), {"id": usuario_id})
    row = exists.first()
    if not row:
        raise HTTPException(404, "Usuario no encontrado.")
    if row[1] == "admin":
        raise HTTPException(403, "No se puede eliminar el usuario administrador principal.")
    await db.execute(text("DELETE FROM usuarios WHERE id = :id"), {"id": usuario_id})


# ─── EMPLOYEES (NÓMINA) CRUD ─────────────────────────────────────

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
        where += " AND (e.nombre_completo ILIKE :q OR e.cedula ILIKE :q OR e.cargo ILIKE :q)"
        params["q"] = f"%{q.strip()}%"

    count_result = await db.execute(
        text(f"SELECT COUNT(*) FROM empleados e {where}"), params
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * per_page
    result = await db.execute(
        text(
            f"SELECT e.id, e.cedula, e.nombre_completo, e.edad, e.cargo, e.activo, e.created_at, "
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
            "INSERT INTO empleados (id, cedula, nombre_completo, edad, cargo, activo, created_at) "
            "VALUES (:id, :ced, :nom, :edad, :car, TRUE, NOW())"
        ),
        {
            "id": new_id,
            "ced": payload.cedula.strip(),
            "nom": payload.nombre_completo.strip(),
            "edad": payload.edad,
            "car": payload.cargo,
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
