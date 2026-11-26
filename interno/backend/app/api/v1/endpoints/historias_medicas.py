"""Endpoints del módulo de Historia Clínica Integral (formato CITAB).

El módulo cubre: búsqueda y alta básica de pacientes, ficha integral versionada,
atenciones que se reflejan en `consultas`, reposos médicos con folio y métricas
para dirección.
"""
import json
from datetime import date, datetime, timezone
from typing import Any, Mapping, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.schemas.historias_medicas import (
    AtencionIntegralCreate,
    AtencionIntegralOut,
    ColaHistoriaItem,
    FichaIntegralOut,
    FichaIntegralUpsert,
    MedicoOut,
    MetricaRepososOut,
    PacienteContactoUpdate,
    PacienteCreate,
    PacienteDetalleOut,
    PacienteOut,
    ReposoAnular,
    ReposoCreate,
    ReposoIndicacion,
    ReposoOut,
    ResumenHistoriasOut,
)

router = APIRouter(tags=["Historias Médicas"])

# Lectura clínica: el personal médico y recepción consultan; escritura solo el rol.
LECTURA = require_roles(
    "historias_medicas",
    "medico",
    "medico_emergencia",
    "recepcionista",
    "admin_sistemas",
    "director",
)
ESCRITURA = require_roles("historias_medicas")
# Recepción corrige datos de contacto capturados con errores al agendar.
ESCRITURA_CONTACTO = require_roles(
    "historias_medicas", "recepcionista", "admin_sistemas", "director"
)
ANULACION = require_roles("historias_medicas", "admin_sistemas", "director")

CLINICA_CITAB_ID = 2

_SELECT_REPOSO = """
SELECT r.id, r.folio, r.historia_clinica_id,
       h.cedula AS paciente_cedula, h.nombre_completo AS paciente_nombre,
       r.consulta_id, r.medico_id,
       COALESCE(
           NULLIF(r.medico_nombre, ''),
           NULLIF(trim(p.nombre || ' ' || COALESCE(p.apellido, '')), '')
       ) AS medico_nombre,
       r.empleado_id, r.beneficiario_id,
       COALESCE(e.nombre_completo, b.nombre_completo) AS trabajador_nombre,
       r.fecha_emision, r.fecha_inicio, r.fecha_fin, r.dias,
       r.diagnostico, r.descripcion, r.estado,
       r.anulado_por, r.anulado_en, r.motivo_anulacion, r.created_at
  FROM reposos_medicos r
  JOIN historias_clinicas h ON h.id = r.historia_clinica_id
  LEFT JOIN personal p ON p.id = r.medico_id
  LEFT JOIN empleados e ON e.id = r.empleado_id
  LEFT JOIN beneficiarios b ON b.id = r.beneficiario_id
"""


# ─── SERIALIZACIÓN ────────────────────────────────────────────────

def _texto(valor: Any) -> Optional[str]:
    if valor is None:
        return None
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()
    return str(valor)


def _json(valor: Any) -> Any:
    if valor is None:
        return {}
    if isinstance(valor, str):
        try:
            return json.loads(valor)
        except (ValueError, TypeError):
            return {}
    return valor


def _clinica_id(usuario: dict) -> int:
    valor = usuario.get("clinica_id")
    try:
        return int(valor) if valor is not None else CLINICA_CITAB_ID
    except (TypeError, ValueError):
        return CLINICA_CITAB_ID


def _serializar_paciente(fila: Mapping) -> dict:
    return {
        "id": str(fila["id"]),
        "cedula": fila["cedula"],
        "tipo_cedula": fila.get("tipo_cedula") or "V",
        "nombre_completo": fila["nombre_completo"],
        "fecha_nacimiento": _texto(fila.get("fecha_nacimiento")),
        "telefono": fila.get("telefono"),
        "direccion": fila.get("direccion"),
        "numero_historia": fila.get("numero_historia"),
        "tiene_ficha": bool(fila.get("tiene_ficha")),
        "numero_carpeta": fila.get("numero_carpeta"),
        "es_trabajador": bool(fila.get("es_trabajador")),
        "es_beneficiario": bool(fila.get("es_beneficiario")),
    }


def _serializar_ficha(fila: Mapping) -> dict:
    return {
        "id": str(fila["id"]),
        "historia_clinica_id": str(fila["historia_clinica_id"]),
        "clinica_id": fila.get("clinica_id"),
        "numero_carpeta": fila.get("numero_carpeta"),
        "datos": _json(fila.get("datos")),
        "version": fila.get("version") or 1,
        "creado_por": fila.get("creado_por"),
        "actualizado_por": fila.get("actualizado_por"),
        "created_at": _texto(fila.get("created_at")),
        "updated_at": _texto(fila.get("updated_at")),
    }


def _serializar_reposo(fila: Mapping) -> dict:
    return {
        "id": str(fila["id"]),
        "folio": fila["folio"],
        "historia_clinica_id": str(fila["historia_clinica_id"]),
        "paciente_cedula": fila.get("paciente_cedula"),
        "paciente_nombre": fila.get("paciente_nombre"),
        "consulta_id": _texto(fila.get("consulta_id")),
        "medico_id": fila.get("medico_id"),
        "medico_nombre": fila.get("medico_nombre"),
        "empleado_id": _texto(fila.get("empleado_id")),
        "beneficiario_id": _texto(fila.get("beneficiario_id")),
        "trabajador_nombre": fila.get("trabajador_nombre"),
        "fecha_emision": _texto(fila.get("fecha_emision")),
        "fecha_inicio": _texto(fila.get("fecha_inicio")),
        "fecha_fin": _texto(fila.get("fecha_fin")),
        "dias": fila.get("dias") or 0,
        "diagnostico": fila.get("diagnostico"),
        "descripcion": fila.get("descripcion"),
        "estado": fila.get("estado") or "vigente",
        "anulado_por": fila.get("anulado_por"),
        "anulado_en": _texto(fila.get("anulado_en")),
        "motivo_anulacion": fila.get("motivo_anulacion"),
        "created_at": _texto(fila.get("created_at")),
    }


def _serializar_atencion(fila: Mapping) -> dict:
    insumos = _json(fila.get("insumos")) or []
    recetas = _json(fila.get("recetas")) or []
    reposos = _json(fila.get("reposos")) or []
    signos = None
    diag_secundario = None
    if isinstance(insumos, list):
        for item in insumos:
            if not isinstance(item, dict):
                continue
            if item.get("tipo") == "signos_vitales":
                signos = item.get("datos")
            elif item.get("tipo") == "diagnostico_secundario":
                diag_secundario = item.get("valor")
    return {
        "id": str(fila["id"]),
        "created_at": _texto(fila.get("created_at")),
        "medico_nombre": fila.get("medico_nombre"),
        "motivo_consulta": fila.get("motivo_consulta"),
        "examen_fisico": fila.get("examen_fisico"),
        "cie10_codigo": fila.get("cie10_codigo"),
        "cie10_descripcion": fila.get("cie10_descripcion"),
        "tratamiento": fila.get("tratamiento"),
        "recetas": recetas if isinstance(recetas, list) else [],
        "recomendaciones": fila.get("recomendaciones"),
        "proxima_consulta": fila.get("proxima_consulta"),
        "comprobante_ref": fila.get("comprobante_ref"),
        "signos_vitales": signos,
        "diagnostico_secundario": diag_secundario,
        "reposo": reposos[0] if isinstance(reposos, list) and reposos else None,
    }


async def _paciente_o_404(db: AsyncSession, historia_id: str) -> Mapping:
    fila = (
        await db.execute(
            text(
                "SELECT id, cedula, tipo_cedula, nombre_completo, fecha_nacimiento, "
                "telefono, direccion, numero_historia FROM historias_clinicas WHERE id = :id"
            ),
            {"id": historia_id},
        )
    ).mappings().first()
    if not fila:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Paciente no encontrado.")
    return fila


async def _reposo_por_id(db: AsyncSession, reposo_id: str) -> Mapping:
    fila = (
        await db.execute(
            text(f"{_SELECT_REPOSO} WHERE r.id = :id"), {"id": reposo_id}
        )
    ).mappings().first()
    if not fila:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reposo no encontrado.")
    return fila


async def _nombre_personal(db: AsyncSession, personal_id: Optional[int]) -> Optional[str]:
    if personal_id is None:
        return None
    fila = (
        await db.execute(
            text(
                "SELECT trim(nombre || ' ' || COALESCE(apellido, '')) AS nombre "
                "FROM personal WHERE id = :id"
            ),
            {"id": personal_id},
        )
    ).first()
    return fila[0] if fila and fila[0] else None


async def _insertar_reposo(
    db: AsyncSession,
    *,
    historia_id: str,
    paciente_cedula: str,
    consulta_id: Optional[str],
    medico_id: Optional[int],
    medico_nombre: str,
    datos: ReposoIndicacion,
    empleado_id: Optional[str] = None,
) -> str:
    """Inserta un reposo y resuelve el vínculo con nómina por cédula.

    No hace commit: la transacción la cierra el endpoint que lo invoca.
    """
    empleado = empleado_id
    beneficiario_id = None
    if not empleado:
        fila_empleado = (
            await db.execute(
                text(
                    "SELECT id FROM empleados WHERE cedula = :c AND activo = TRUE "
                    "ORDER BY created_at DESC LIMIT 1"
                ),
                {"c": paciente_cedula},
            )
        ).first()
        if fila_empleado:
            empleado = str(fila_empleado[0])
        else:
            fila_benef = (
                await db.execute(
                    text(
                        "SELECT id FROM beneficiarios WHERE cedula = :c AND activo = TRUE "
                        "ORDER BY created_at DESC LIMIT 1"
                    ),
                    {"c": paciente_cedula},
                )
            ).first()
            if fila_benef:
                beneficiario_id = str(fila_benef[0])

    nueva = (
        await db.execute(
            text(
                "INSERT INTO reposos_medicos "
                "(historia_clinica_id, consulta_id, medico_id, medico_nombre, "
                " empleado_id, beneficiario_id, fecha_inicio, fecha_fin, dias, "
                " diagnostico, descripcion) "
                "VALUES (:hid, :consulta, :mid, :mnom, :emp, :ben, "
                "        COALESCE(CAST(:inicio AS date), CURRENT_DATE), "
                "        COALESCE(CAST(:inicio AS date), CURRENT_DATE) + (:dias - 1), "
                "        :dias, :diag, :desc) "
                "RETURNING id"
            ),
            {
                "hid": historia_id,
                "consulta": consulta_id,
                "mid": medico_id,
                "mnom": medico_nombre,
                "emp": empleado,
                "ben": beneficiario_id,
                "inicio": datos.fecha_inicio,
                "dias": datos.dias,
                "diag": datos.diagnostico,
                "desc": datos.descripcion,
            },
        )
    ).first()
    return str(nueva[0])


# ─── COLA DE CONSULTA ────────────────────────────────────────────

@router.get("/cola", response_model=list[ColaHistoriaItem])
async def cola_consultas(
    fecha: Optional[date] = None,
    incluir_espera: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(LECTURA),
):
    """Pacientes que pasaron por consulta médica y requieren su historia integral.

    Toma la cola de la clínica del usuario (CITAB por defecto). Por defecto
    muestra EN_CONSULTA y FINALIZADO; `incluir_espera` agrega EN_ESPERA_CONSULTA.
    """
    cid = _clinica_id(usuario)
    fecha = fecha or date.today()
    estados = ["EN_CONSULTA", "FINALIZADO"]
    if incluir_espera:
        estados.append("EN_ESPERA_CONSULTA")

    filas = (
        await db.execute(
            text(
                "SELECT ca.id AS cola_id, ca.paciente_id, "
                "       COALESCE(NULLIF(hc.cedula, ''), ca.paciente_cedula) AS cedula, "
                "       COALESCE(NULLIF(hc.nombre_completo, ''), ca.paciente_nombre) AS nombre_completo, "
                "       ca.atencion_estado::text AS estado, "
                "       ca.medico_id, "
                "       NULLIF(trim(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellido, '')), '') AS medico_nombre, "
                "       ca.motivo_consulta, ca.creado_en, ca.iniciado_en, ca.fin_en, ca.consulta_id, "
                "       EXISTS (SELECT 1 FROM historias_integrales hi "
                "                WHERE hi.historia_clinica_id = ca.paciente_id) AS tiene_ficha, "
                "       EXISTS (SELECT 1 FROM consultas c "
                "                WHERE c.cola_id = ca.id AND c.origen = 'historia_integral') AS tiene_atencion_integral, "
                "       (SELECT COUNT(*) FROM reposos_medicos r "
                "         WHERE r.historia_clinica_id = ca.paciente_id AND r.estado = 'vigente') AS reposos_vigentes "
                "  FROM cola_atencion ca "
                "  LEFT JOIN historias_clinicas hc ON hc.id = ca.paciente_id "
                "  LEFT JOIN personal p ON p.id = ca.medico_id "
                " WHERE ca.clinica_id = :cid "
                "   AND ca.atencion_estado::text = ANY(:estados) "
                "   AND COALESCE(ca.fin_en, ca.iniciado_en, ca.creado_en)::date = :fecha "
                " ORDER BY COALESCE(ca.fin_en, ca.iniciado_en, ca.creado_en) DESC"
            ),
            {"cid": cid, "estados": estados, "fecha": fecha},
        )
    ).mappings().all()

    return [
        ColaHistoriaItem(
            cola_id=f["cola_id"],
            paciente_id=str(f["paciente_id"]) if f["paciente_id"] else None,
            cedula=f["cedula"] or "",
            nombre_completo=f["nombre_completo"] or "Paciente sin nombre",
            estado=f["estado"],
            medico_id=f["medico_id"],
            medico_nombre=f["medico_nombre"],
            motivo_consulta=f["motivo_consulta"],
            creado_en=_texto(f["creado_en"]),
            iniciado_en=_texto(f["iniciado_en"]),
            fin_en=_texto(f["fin_en"]),
            consulta_id=_texto(f["consulta_id"]),
            tiene_ficha=bool(f["tiene_ficha"]),
            tiene_atencion_integral=bool(f["tiene_atencion_integral"]),
            reposos_vigentes=int(f["reposos_vigentes"] or 0),
        )
        for f in filas
    ]


# ─── PACIENTES ────────────────────────────────────────────────────

@router.get("/pacientes", response_model=list[PacienteOut])
async def buscar_pacientes(
    q: str = Query(default="", max_length=100),
    limite: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _usuario: dict = Depends(LECTURA),
):
    """Busca pacientes por cédula o nombre. La cédula exacta va primero."""
    termino = q.strip()
    if len(termino) < 2:
        return []
    filas = (
        await db.execute(
            text(
                "SELECT h.id, h.cedula, h.tipo_cedula, h.nombre_completo, h.fecha_nacimiento, "
                "       h.telefono, h.direccion, h.numero_historia, "
                "       f.numero_carpeta, (f.id IS NOT NULL) AS tiene_ficha, "
                "       EXISTS (SELECT 1 FROM empleados e "
                "               WHERE e.cedula = h.cedula AND e.activo = TRUE) AS es_trabajador, "
                "       EXISTS (SELECT 1 FROM beneficiarios b "
                "               WHERE b.cedula = h.cedula AND b.activo = TRUE) AS es_beneficiario "
                "  FROM historias_clinicas h "
                "  LEFT JOIN historias_integrales f ON f.historia_clinica_id = h.id "
                " WHERE h.cedula ILIKE :q OR h.nombre_completo ILIKE :q "
                " ORDER BY (h.cedula = :exacto) DESC, h.nombre_completo "
                " LIMIT :limite"
            ),
            {"q": f"%{termino}%", "exacto": termino, "limite": limite},
        )
    ).mappings().all()
    return [_serializar_paciente(f) for f in filas]


@router.post("/pacientes", response_model=PacienteOut, status_code=status.HTTP_201_CREATED)
async def crear_paciente(
    payload: PacienteCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(ESCRITURA),
):
    """Alta básica de un paciente sin historia clínica previa."""
    cedula = payload.cedula.strip()
    if not cedula:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La cédula es obligatoria.")

    existe = (
        await db.execute(
            text("SELECT id FROM historias_clinicas WHERE cedula = :c"), {"c": cedula}
        )
    ).first()
    if existe:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una historia con esa cédula.")

    nombre_completo = f"{payload.nombres.strip()} {payload.apellidos.strip()}".strip()
    folio = f"HC-{cedula}"
    fila = (
        await db.execute(
            text(
                "INSERT INTO historias_clinicas "
                "(tipo_cedula, cedula, nombre_completo, apellido, fecha_nacimiento, "
                " telefono, direccion, email, numero_historia, created_at) "
                "VALUES (:tipo, :ced, :nombre, :apellido, :fnac, :tel, :dir, :email, :folio, NOW()) "
                "RETURNING id, cedula, tipo_cedula, nombre_completo, fecha_nacimiento, "
                "          telefono, direccion, numero_historia"
            ),
            {
                "tipo": payload.tipo_cedula.strip().upper() or "V",
                "ced": cedula,
                "nombre": nombre_completo,
                "apellido": payload.apellidos.strip() or None,
                "fnac": payload.fecha_nacimiento,
                "tel": payload.telefono,
                "dir": payload.direccion,
                "email": payload.email,
                "folio": folio,
            },
        )
    ).mappings().first()
    await db.commit()

    # Se reutiliza el serializador con los banderas de nómina.
    datos = dict(fila)
    datos.update({"tiene_ficha": False, "es_trabajador": False, "es_beneficiario": False})
    return _serializar_paciente(datos)


@router.get("/pacientes/{historia_id}", response_model=PacienteDetalleOut)
async def detalle_paciente(
    historia_id: str,
    db: AsyncSession = Depends(get_db),
    _usuario: dict = Depends(LECTURA),
):
    """Ficha integral, atenciones recientes y reposos del paciente."""
    paciente = await _paciente_o_404(db, historia_id)

    banderas = (
        await db.execute(
            text(
                "SELECT f.numero_carpeta, (f.id IS NOT NULL) AS tiene_ficha, "
                "       EXISTS (SELECT 1 FROM empleados e "
                "               WHERE e.cedula = :ced AND e.activo = TRUE) AS es_trabajador, "
                "       EXISTS (SELECT 1 FROM beneficiarios b "
                "               WHERE b.cedula = :ced AND b.activo = TRUE) AS es_beneficiario "
                "  FROM historias_clinicas h "
                "  LEFT JOIN historias_integrales f ON f.historia_clinica_id = h.id "
                " WHERE h.id = :id"
            ),
            {"id": historia_id, "ced": paciente["cedula"]},
        )
    ).mappings().first()
    paciente_dict = dict(paciente)
    paciente_dict.update(dict(banderas) if banderas else {})

    ficha_fila = (
        await db.execute(
            text("SELECT * FROM historias_integrales WHERE historia_clinica_id = :id"),
            {"id": historia_id},
        )
    ).mappings().first()

    atenciones = (
        await db.execute(
            text(
                "SELECT id, created_at, medico_nombre, motivo_consulta, examen_fisico, "
                "       cie10_codigo, cie10_descripcion, tratamiento, recetas, recomendaciones, "
                "       proxima_consulta, comprobante_ref, insumos, reposos "
                "  FROM consultas "
                " WHERE paciente_id = :id AND origen = 'historia_integral' "
                " ORDER BY created_at DESC LIMIT 30"
            ),
            {"id": historia_id},
        )
    ).mappings().all()

    reposos = (
        await db.execute(
            text(f"{_SELECT_REPOSO} WHERE r.historia_clinica_id = :id "
                 "ORDER BY r.fecha_inicio DESC, r.created_at DESC LIMIT 30"),
            {"id": historia_id},
        )
    ).mappings().all()

    return {
        "paciente": _serializar_paciente(paciente_dict),
        "ficha": _serializar_ficha(ficha_fila) if ficha_fila else None,
        "atenciones": [_serializar_atencion(a) for a in atenciones],
        "reposos": [_serializar_reposo(r) for r in reposos],
    }


@router.patch("/pacientes/{historia_id}/contacto", response_model=PacienteOut)
async def actualizar_contacto_paciente(
    historia_id: str,
    payload: PacienteContactoUpdate,
    db: AsyncSession = Depends(get_db),
    _usuario: dict = Depends(ESCRITURA_CONTACTO),
):
    """Corrige nombre y datos de contacto del paciente.

    Solo se actualizan los campos enviados; la cédula y la ficha clínica no se
    tocan. Lo usa recepción cuando se registra un dato equivocado al agendar.
    """
    await _paciente_o_404(db, historia_id)
    cambios = payload.model_dump(exclude_unset=True)

    asignaciones: list[str] = []
    params: dict = {"id": historia_id}

    if "nombre_completo" in cambios:
        nombre = (cambios["nombre_completo"] or "").strip()
        if not nombre:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "El nombre del paciente no puede quedar vacío."
            )
        asignaciones.append("nombre_completo = :nombre")
        params["nombre"] = nombre

    for campo in ("telefono", "direccion", "email"):
        if campo in cambios:
            asignaciones.append(f"{campo} = :{campo}")
            params[campo] = (cambios[campo] or "").strip() or None

    if not asignaciones:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No se enviaron datos para actualizar.")

    await db.execute(
        text(f"UPDATE historias_clinicas SET {', '.join(asignaciones)} WHERE id = :id"),
        params,
    )

    fila = (
        await db.execute(
            text(
                "SELECT h.id, h.cedula, h.tipo_cedula, h.nombre_completo, h.fecha_nacimiento, "
                "       h.telefono, h.direccion, h.numero_historia, f.numero_carpeta, "
                "       (f.id IS NOT NULL) AS tiene_ficha, "
                "       EXISTS (SELECT 1 FROM empleados e "
                "               WHERE e.cedula = h.cedula AND e.activo = TRUE) AS es_trabajador, "
                "       EXISTS (SELECT 1 FROM beneficiarios b "
                "               WHERE b.cedula = h.cedula AND b.activo = TRUE) AS es_beneficiario "
                "  FROM historias_clinicas h "
                "  LEFT JOIN historias_integrales f ON f.historia_clinica_id = h.id "
                " WHERE h.id = :id"
            ),
            {"id": historia_id},
        )
    ).mappings().first()
    await db.commit()
    return _serializar_paciente(fila)


# ─── FICHA INTEGRAL ───────────────────────────────────────────────

@router.put("/pacientes/{historia_id}/ficha", response_model=FichaIntegralOut)
async def guardar_ficha(
    historia_id: str,
    payload: FichaIntegralUpsert,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(ESCRITURA),
):
    """Crea o actualiza la ficha CITAB. Cada guardado incrementa la versión."""
    paciente = await _paciente_o_404(db, historia_id)
    ident = payload.datos.get("identificacion") if isinstance(payload.datos, dict) else None
    ident = ident if isinstance(ident, dict) else {}

    # Los datos de identificación viven en historias_clinicas para que la
    # búsqueda y el resto del sistema los vean sin leer el JSONB.
    nombres = (ident.get("nombres") or "").strip()
    apellidos = (ident.get("apellidos") or "").strip()
    nombre_completo = f"{nombres} {apellidos}".strip() or paciente["nombre_completo"]
    fecha_nacimiento = ident.get("fecha_nacimiento") or None
    numero_carpeta = (payload.numero_carpeta or ident.get("numero_carpeta") or "").strip() or None

    await db.execute(
        text(
            "UPDATE historias_clinicas SET "
            "  nombre_completo = :nombre, "
            "  apellido = COALESCE(NULLIF(:apellido, ''), apellido), "
            "  fecha_nacimiento = COALESCE(CAST(:fnac AS date), fecha_nacimiento), "
            "  telefono = COALESCE(NULLIF(:tel, ''), telefono), "
            "  direccion = COALESCE(NULLIF(:dir, ''), direccion) "
            "WHERE id = :id"
        ),
        {
            "nombre": nombre_completo,
            "apellido": apellidos,
            "fnac": fecha_nacimiento,
            "tel": (ident.get("telefono") or "").strip(),
            "dir": (ident.get("direccion") or "").strip(),
            "id": historia_id,
        },
    )

    fila = (
        await db.execute(
            text(
                "INSERT INTO historias_integrales "
                "(historia_clinica_id, clinica_id, numero_carpeta, datos, version, "
                " creado_por, actualizado_por, created_at, updated_at) "
                "VALUES (:hid, :cid, :carpeta, CAST(:datos AS jsonb), 1, :usuario, :usuario, NOW(), NOW()) "
                "ON CONFLICT (historia_clinica_id) DO UPDATE SET "
                "  datos = EXCLUDED.datos, "
                "  numero_carpeta = COALESCE(EXCLUDED.numero_carpeta, historias_integrales.numero_carpeta), "
                "  clinica_id = COALESCE(EXCLUDED.clinica_id, historias_integrales.clinica_id), "
                "  version = historias_integrales.version + 1, "
                "  actualizado_por = EXCLUDED.actualizado_por, "
                "  updated_at = NOW() "
                "RETURNING *"
            ),
            {
                "hid": historia_id,
                "cid": _clinica_id(usuario),
                "carpeta": numero_carpeta,
                "datos": json.dumps(payload.datos or {}, ensure_ascii=False),
                "usuario": usuario.get("sub", "desconocido"),
            },
        )
    ).mappings().first()
    await db.commit()
    return _serializar_ficha(fila)


# ─── ATENCIONES ───────────────────────────────────────────────────

@router.get("/pacientes/{historia_id}/atenciones", response_model=list[AtencionIntegralOut])
async def listar_atenciones(
    historia_id: str,
    db: AsyncSession = Depends(get_db),
    _usuario: dict = Depends(LECTURA),
):
    await _paciente_o_404(db, historia_id)
    filas = (
        await db.execute(
            text(
                "SELECT id, created_at, medico_nombre, motivo_consulta, examen_fisico, "
                "       cie10_codigo, cie10_descripcion, tratamiento, recetas, recomendaciones, "
                "       proxima_consulta, comprobante_ref, insumos, reposos "
                "  FROM consultas "
                " WHERE paciente_id = :id AND origen = 'historia_integral' "
                " ORDER BY created_at DESC LIMIT 100"
            ),
            {"id": historia_id},
        )
    ).mappings().all()
    return [_serializar_atencion(f) for f in filas]


@router.post(
    "/pacientes/{historia_id}/atenciones",
    response_model=AtencionIntegralOut,
    status_code=status.HTTP_201_CREATED,
)
async def crear_atencion(
    historia_id: str,
    payload: AtencionIntegralCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(ESCRITURA),
):
    """Registra la atención en `consultas` con origen `historia_integral`.

    Si la atención incluye reposo, emite el folio en la misma transacción y
    guarda una instantánea en `consultas.reposos` para el historial.
    """
    paciente = await _paciente_o_404(db, historia_id)

    ficha = (
        await db.execute(
            text("SELECT id FROM historias_integrales WHERE historia_clinica_id = :id"),
            {"id": historia_id},
        )
    ).first()

    medico_id = payload.medico_id or usuario.get("personal_id")
    medico_nombre = payload.medico_nombre or await _nombre_personal(db, medico_id)
    medico_nombre = medico_nombre or usuario.get("sub") or "No asignado"

    insumos: list[dict] = []
    if payload.signos_vitales:
        datos_sv = payload.signos_vitales.model_dump(exclude_none=True)
        if datos_sv:
            insumos.append({"tipo": "signos_vitales", "datos": datos_sv})
    if payload.diagnostico_secundario:
        insumos.append(
            {"tipo": "diagnostico_secundario", "valor": payload.diagnostico_secundario.strip()}
        )
    if payload.enfermedad_actual:
        insumos.append({"tipo": "enfermedad_actual", "valor": payload.enfermedad_actual.strip()})

    recetas = [
        r.model_dump(exclude_none=True)
        for r in payload.recetas
        if (r.nombre or "").strip()
    ]

    motivo = (payload.motivo_consulta or payload.enfermedad_actual or "").strip() or None
    comprobante = f"HI-{int(datetime.now(timezone.utc).timestamp()) % 1000000:06d}"

    fila = (
        await db.execute(
            text(
                "INSERT INTO consultas "
                "(paciente_id, cola_id, medico_id, medico_nombre, especialidad, motivo_consulta, "
                " examen_fisico, cie10_codigo, cie10_descripcion, tratamiento, recetas, "
                " recomendaciones, proxima_consulta, insumos, reposos, comprobante_ref, "
                " clinica_id, origen, historia_integral_id) "
                "VALUES (:pid, :cola, :mid, :mnom, 'Historia Clínica Integral', :motivo, :examen, "
                "        :cie, :diag, :trat, CAST(:recetas AS jsonb), "
                "        :rec, :prox, CAST(:insumos AS jsonb), '[]'::jsonb, :comprobante, "
                "        :cid, 'historia_integral', :ficha) "
                "RETURNING id, created_at, medico_nombre, motivo_consulta, examen_fisico, "
                "          cie10_codigo, cie10_descripcion, tratamiento, recetas, recomendaciones, "
                "          proxima_consulta, comprobante_ref, insumos, reposos"
            ),
            {
                "pid": historia_id,
                "cola": payload.cola_id,
                "mid": medico_id,
                "mnom": medico_nombre,
                "motivo": motivo,
                "examen": payload.examen_fisico,
                "cie": payload.cie10_codigo,
                "diag": payload.diagnostico_principal,
                "trat": payload.tratamiento,
                "recetas": json.dumps(recetas, ensure_ascii=False),
                "rec": payload.recomendaciones,
                "prox": payload.proxima_consulta,
                "insumos": json.dumps(insumos, ensure_ascii=False),
                "comprobante": comprobante,
                "cid": _clinica_id(usuario),
                "ficha": str(ficha[0]) if ficha else None,
            },
        )
    ).mappings().first()

    resultado = _serializar_atencion(fila)

    if payload.cola_id:
        await db.execute(
            text("UPDATE cola_atencion SET consulta_id = :consulta WHERE id = :cola"),
            {"consulta": resultado["id"], "cola": payload.cola_id},
        )

    if payload.reposo:
        reposo_id = await _insertar_reposo(
            db,
            historia_id=historia_id,
            paciente_cedula=paciente["cedula"],
            consulta_id=resultado["id"],
            medico_id=medico_id,
            medico_nombre=medico_nombre,
            datos=payload.reposo,
        )
        reposo_fila = await _reposo_por_id(db, reposo_id)
        snapshot = {
            "id": str(reposo_fila["id"]),
            "folio": reposo_fila["folio"],
            "fecha_inicio": _texto(reposo_fila["fecha_inicio"]),
            "fecha_fin": _texto(reposo_fila["fecha_fin"]),
            "dias": reposo_fila["dias"],
            "diagnostico": reposo_fila["diagnostico"],
            "descripcion": reposo_fila["descripcion"],
            "estado": reposo_fila["estado"],
            "medico_nombre": reposo_fila["medico_nombre"],
        }
        await db.execute(
            text("UPDATE consultas SET reposos = CAST(:r AS jsonb) WHERE id = :id"),
            {"r": json.dumps([snapshot], ensure_ascii=False), "id": resultado["id"]},
        )
        resultado["reposo"] = snapshot

    await db.commit()
    return resultado


# ─── MÉDICOS ──────────────────────────────────────────────────────

@router.get("/medicos", response_model=list[MedicoOut])
async def listar_medicos(
    db: AsyncSession = Depends(get_db),
    _usuario: dict = Depends(LECTURA),
):
    """Personal activo para seleccionar el médico firmante."""
    filas = (
        await db.execute(
            text(
                "SELECT id, nombre, apellido, especialidad, cargo, clinica_id "
                "  FROM personal WHERE estado = 'ACTIVO' "
                " ORDER BY nombre, apellido"
            )
        )
    ).mappings().all()
    return [dict(f) for f in filas]


# ─── REPOSOS ──────────────────────────────────────────────────────

@router.get("/reposos", response_model=dict)
async def listar_reposos(
    q: str = Query(default=""),
    estado: str = Query(default=""),
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    medico_id: Optional[int] = None,
    historia_id: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _usuario: dict = Depends(LECTURA),
):
    condiciones = ["1=1"]
    params: dict[str, Any] = {}
    if q.strip():
        condiciones.append(
            "(h.cedula ILIKE :q OR h.nombre_completo ILIKE :q OR r.folio ILIKE :q)"
        )
        params["q"] = f"%{q.strip()}%"
    if estado.strip():
        if estado.strip() not in ("vigente", "anulado"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Estado inválido.")
        condiciones.append("r.estado = :estado")
        params["estado"] = estado.strip()
    if desde:
        condiciones.append("r.fecha_emision >= :desde")
        params["desde"] = desde
    if hasta:
        condiciones.append("r.fecha_emision <= :hasta")
        params["hasta"] = hasta
    if medico_id is not None:
        condiciones.append("r.medico_id = :medico_id")
        params["medico_id"] = medico_id
    if historia_id:
        condiciones.append("r.historia_clinica_id = :historia_id")
        params["historia_id"] = historia_id

    where = " WHERE " + " AND ".join(condiciones)
    total = (
        await db.execute(
            text(
                "SELECT COUNT(*) FROM reposos_medicos r "
                "JOIN historias_clinicas h ON h.id = r.historia_clinica_id" + where
            ),
            params,
        )
    ).scalar() or 0

    offset = (page - 1) * per_page
    filas = (
        await db.execute(
            text(
                f"{_SELECT_REPOSO}{where} "
                "ORDER BY r.fecha_inicio DESC, r.created_at DESC "
                "LIMIT :limite OFFSET :offset"
            ),
            {**params, "limite": per_page, "offset": offset},
        )
    ).mappings().all()

    return {
        "items": [_serializar_reposo(f) for f in filas],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.post(
    "/pacientes/{historia_id}/reposos",
    response_model=ReposoOut,
    status_code=status.HTTP_201_CREATED,
)
async def crear_reposo(
    historia_id: str,
    payload: ReposoCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(ESCRITURA),
):
    """Emite un reposo y lo vincula a nómina cuando la cédula es de un trabajador."""
    paciente = await _paciente_o_404(db, historia_id)

    consulta_id = payload.consulta_id
    if consulta_id:
        valida = (
            await db.execute(
                text(
                    "SELECT id FROM consultas "
                    "WHERE id = :cid AND paciente_id = :pid"
                ),
                {"cid": consulta_id, "pid": historia_id},
            )
        ).first()
        if not valida:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "La consulta indicada no pertenece al paciente.",
            )
    else:
        ultima = (
            await db.execute(
                text(
                    "SELECT id FROM consultas "
                    "WHERE paciente_id = :pid AND origen = 'historia_integral' "
                    "ORDER BY created_at DESC LIMIT 1"
                ),
                {"pid": historia_id},
            )
        ).first()
        consulta_id = str(ultima[0]) if ultima else None

    medico_id = payload.medico_id or usuario.get("personal_id")
    medico_nombre = payload.medico_nombre or await _nombre_personal(db, medico_id)
    medico_nombre = medico_nombre or usuario.get("sub") or "No asignado"

    reposo_id = await _insertar_reposo(
        db,
        historia_id=historia_id,
        paciente_cedula=paciente["cedula"],
        consulta_id=consulta_id,
        medico_id=medico_id,
        medico_nombre=medico_nombre,
        datos=ReposoIndicacion(
            fecha_inicio=payload.fecha_inicio,
            dias=payload.dias,
            diagnostico=payload.diagnostico,
            descripcion=payload.descripcion,
        ),
        empleado_id=payload.empleado_id,
    )
    await db.commit()
    fila = await _reposo_por_id(db, reposo_id)
    return _serializar_reposo(fila)


@router.post("/reposos/{reposo_id}/anular", response_model=ReposoOut)
async def anular_reposo(
    reposo_id: str,
    payload: ReposoAnular,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(ANULACION),
):
    """Anula un reposo vigente dejando motivo, usuario y fecha (no se borra)."""
    fila = (
        await db.execute(
            text("SELECT id, estado FROM reposos_medicos WHERE id = :id"), {"id": reposo_id}
        )
    ).first()
    if not fila:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reposo no encontrado.")
    if fila[1] != "vigente":
        raise HTTPException(status.HTTP_409_CONFLICT, "El reposo ya no está vigente.")

    await db.execute(
        text(
            "UPDATE reposos_medicos SET estado = 'anulado', anulado_por = :usuario, "
            "anulado_en = NOW(), motivo_anulacion = :motivo WHERE id = :id"
        ),
        {
            "usuario": usuario.get("sub", "desconocido"),
            "motivo": payload.motivo.strip(),
            "id": reposo_id,
        },
    )
    await db.commit()
    return _serializar_reposo(await _reposo_por_id(db, reposo_id))


# ─── MÉTRICAS ─────────────────────────────────────────────────────

@router.get("/metricas/reposos", response_model=MetricaRepososOut)
async def metricas_reposos(
    anio: Optional[int] = Query(default=None, ge=2000, le=2100),
    mes: Optional[int] = Query(default=None, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    _usuario: dict = Depends(LECTURA),
):
    anio = anio or date.today().year
    where = "WHERE EXTRACT(YEAR FROM fecha_emision) = :anio"
    params: dict[str, Any] = {"anio": anio}
    if mes:
        where += " AND EXTRACT(MONTH FROM fecha_emision) = :mes"
        params["mes"] = mes

    resumen = (
        await db.execute(
            text(
                "SELECT COUNT(*) AS total, "
                "       COUNT(*) FILTER (WHERE estado = 'vigente') AS vigentes, "
                "       COUNT(*) FILTER (WHERE estado = 'anulado') AS anulados, "
                "       COALESCE(SUM(dias) FILTER (WHERE estado = 'vigente'), 0) AS dias_vigentes, "
                "       COUNT(*) FILTER (WHERE empleado_id IS NOT NULL) AS trabajadores "
                f"  FROM reposos_medicos {where}"
            ),
            params,
        )
    ).mappings().first()

    por_medico = (
        await db.execute(
            text(
                "SELECT COALESCE(NULLIF(medico_nombre, ''), 'Sin médico') AS medico, "
                "       COUNT(*) AS total, "
                "       COALESCE(SUM(dias) FILTER (WHERE estado = 'vigente'), 0) AS dias "
                f"  FROM reposos_medicos {where} "
                " GROUP BY 1 ORDER BY total DESC, medico"
            ),
            params,
        )
    ).mappings().all()

    por_dia = (
        await db.execute(
            text(
                "SELECT dias, COUNT(*) AS total "
                f"  FROM reposos_medicos {where} "
                " GROUP BY dias ORDER BY dias"
            ),
            params,
        )
    ).mappings().all()

    por_mes = (
        await db.execute(
            text(
                "SELECT EXTRACT(MONTH FROM fecha_emision)::int AS mes, COUNT(*) AS total "
                "  FROM reposos_medicos "
                " WHERE EXTRACT(YEAR FROM fecha_emision) = :anio "
                " GROUP BY 1 ORDER BY 1"
            ),
            {"anio": anio},
        )
    ).mappings().all()
    mapa_mes = {int(f["mes"]): int(f["total"]) for f in por_mes}

    return {
        "anio": anio,
        "mes": mes,
        "total": int(resumen["total"] or 0),
        "vigentes": int(resumen["vigentes"] or 0),
        "anulados": int(resumen["anulados"] or 0),
        "dias_vigentes": int(resumen["dias_vigentes"] or 0),
        "trabajadores": int(resumen["trabajadores"] or 0),
        "por_medico": [dict(f) for f in por_medico],
        "por_dia": [dict(f) for f in por_dia],
        "por_mes": [{"mes": m, "total": mapa_mes.get(m, 0)} for m in range(1, 13)],
    }


@router.get("/metricas/resumen", response_model=ResumenHistoriasOut)
async def resumen_historias(
    db: AsyncSession = Depends(get_db),
    _usuario: dict = Depends(LECTURA),
):
    fila = (
        await db.execute(
            text(
                "SELECT "
                " (SELECT COUNT(*) FROM historias_clinicas) AS pacientes, "
                " (SELECT COUNT(*) FROM historias_integrales) AS fichas, "
                " (SELECT COUNT(*) FROM consultas "
                "   WHERE origen = 'historia_integral' "
                "     AND created_at >= date_trunc('month', CURRENT_DATE)) AS atenciones_mes, "
                " (SELECT COUNT(*) FROM reposos_medicos "
                "   WHERE estado = 'vigente' AND fecha_fin >= CURRENT_DATE) AS reposos_vigentes, "
                " (SELECT COUNT(*) FROM reposos_medicos "
                "   WHERE fecha_emision >= date_trunc('month', CURRENT_DATE)) AS reposos_mes, "
                " (SELECT COUNT(DISTINCT empleado_id) FROM reposos_medicos "
                "   WHERE estado = 'vigente' AND empleado_id IS NOT NULL "
                "     AND fecha_fin >= CURRENT_DATE) AS trabajadores_con_reposo"
            )
        )
    ).mappings().first()
    return {
        **{k: int(v or 0) for k, v in fila.items()},
        "actualizado_en": datetime.now(timezone.utc).isoformat(),
    }
