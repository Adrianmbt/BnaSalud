import re
import secrets
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, status

from app.api.v1.deps import exigir_staff
from app.api.v1.errors import db_fail, fail, not_found
from app.api.v1.utils import parse_json_list
from app.core.database import supabase
from app.schemas.schemas import (
    ConsultaCargarRequest,
    ConsultaDetalleResponse,
    InsumoAplicado,
)

router = APIRouter(tags=["Consultas"])


def _nombres_personal(medico_ids: List[int]) -> dict:
    ids = [i for i in medico_ids if i]
    if not ids:
        return {}
    try:
        filas = (
            supabase.table("personal")
            .select("id, nombre, apellido")
            .in_("id", ids)
            .execute()
            .data
            or []
        )
    except Exception:
        return {}
    return {
        p["id"]: f"{p.get('nombre', '')} {p.get('apellido', '')}".strip()
        for p in filas
    }


def _generar_comprobante() -> str:
    return f"ABH-{secrets.randbelow(90000) + 10000}"


def _generar_codigo_receta() -> str:
    """Código único RX-AAAA-NNNN (reintenta si colisiona)."""
    for _ in range(5):
        codigo = f"RX-{2026}-{secrets.randbelow(9000) + 1000}"
        try:
            existe = (
                supabase.table("recetas")
                .select("id")
                .eq("codigo_receta", codigo)
                .limit(1)
                .execute()
                .data
            )
        except Exception:
            return codigo
        if not existe:
            return codigo
    return f"RX-{2026}-{secrets.randbelow(9000) + 1000}"


def _cantidad_desde_posologia(posologia: str) -> int:
    """Cantidad prescrita: primer número de la posología, o 10 como respaldo."""
    m = re.search(r"\d+", posologia or "")
    return int(m.group()) if m else 10


def _crear_receta_farmacia(
    payload: ConsultaCargarRequest,
    paciente: dict,
    medico_nombre: str,
    consulta_id: Optional[str] = None,
) -> Optional[str]:
    """Crea la receta en farmacia (tabla `recetas` + `receta_detalles`) cuando
    la consulta trae medicamentos. Devuelve el código RX o None."""
    recetas = payload.recetas
    if not recetas:
        return None

    try:
        inventario = (
            supabase.table("inventario_medicamentos")
            .select("id, nombre")
            .execute()
            .data
            or []
        )
    except Exception:
        inventario = []
    ids_por_nombre = {m.get("nombre", "").strip().lower(): m["id"] for m in inventario}

    medico_id = payload.medico_id
    clinica_id = None
    if medico_id:
        try:
            doc = (
                supabase.table("personal")
                .select("clinica_id")
                .eq("id", medico_id)
                .limit(1)
                .execute()
                .data
            )
            if doc:
                clinica_id = doc[0].get("clinica_id")
        except Exception:
            pass

    codigo = _generar_codigo_receta()
    tipo_cedula = (paciente.get("tipo_cedula") or "V").upper()
    try:
        receta_creada = supabase.table("recetas").insert(
            {
                "codigo_receta": codigo,
                "consulta_id": consulta_id,
                "paciente_cedula": f"{tipo_cedula}-{paciente.get('cedula', '')}",
                "paciente_nombre": paciente.get("nombre_completo", "Paciente"),
                "medico_id": medico_id,
                "clinica_id": clinica_id,
                "fecha_emision": datetime.now().isoformat(timespec="seconds"),
                "estado": "PENDIENTE",
                "medico": medico_nombre,
            }
        ).execute()
    except Exception:
        db_fail("registrar la receta en farmacia")

    receta_id = receta_creada.data[0]["id"]
    detalles = []
    for m in recetas:
        medicamento_id = ids_por_nombre.get((m.nombre or "").strip().lower())
        detalles.append(
            {
                "receta_id": receta_id,
                "medicamento_id": medicamento_id,
                "cantidad_prescrita": _cantidad_desde_posologia(m.posologia),
                "cantidad_despachada": 0,
                "posologia": m.posologia,
            }
        )
    try:
        supabase.table("receta_detalles").insert(detalles).execute()
    except Exception:
        db_fail("registrar los medicamentos de la receta")

    return codigo


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_consulta(
    payload: ConsultaCargarRequest,
    _: dict = Depends(exigir_staff),
) -> dict:
    """Registra una consulta médica en el historial clínico del paciente."""
    try:
        paciente = (
            supabase.table("historias_clinicas")
            .select("id, nombre_completo, cedula, tipo_cedula")
            .eq("id", payload.paciente_id)
            .execute()
            .data
        )
    except Exception:
        db_fail("validar al paciente")
    if not paciente:
        not_found("Paciente")
    paciente = paciente[0]

    especialidad = payload.especialidad
    medico_nombre = payload.medico_nombre
    cita_especialidad = None
    if payload.cita_id:
        try:
            cita = (
                supabase.table("citas")
                .select("especialidad, estado, paciente_id")
                .eq("codigo_confirmacion", payload.cita_id)
                .execute()
                .data
            )
        except Exception:
            db_fail("validar la cita asociada")
        if cita:
            cita_actual = cita[0]
            cita_especialidad = cita_actual.get("especialidad")
            cita_paciente = str(cita_actual.get("paciente_id") or "")
            if cita_paciente and cita_paciente != str(payload.paciente_id):
                fail(
                    "La cita indicada no corresponde a este paciente.",
                    status.HTTP_409_CONFLICT,
                )
        else:
            fail("La cita asociada no existe.")

    if payload.medico_id and not medico_nombre:
        try:
            doc = (
                supabase.table("personal")
                .select("nombre, apellido")
                .eq("id", payload.medico_id)
                .limit(1)
                .execute()
                .data
            )
        except Exception:
            db_fail("validar al médico")
        if not doc:
            fail("El médico indicado no existe.")
        medico_nombre = f"{doc[0].get('nombre', '')} {doc[0].get('apellido', '')}".strip()
    if not medico_nombre:
        medico_nombre = "No asignado"

    registro = {
        "paciente_id": payload.paciente_id,
        "cita_id": payload.cita_id,
        "medico_id": payload.medico_id,
        "medico_nombre": medico_nombre,
        "especialidad": especialidad or cita_especialidad or "Medicina General",
        "motivo_consulta": payload.motivo_consulta,
        "examen_fisico": payload.examen_fisico,
        "cie10_codigo": payload.cie10_codigo,
        "cie10_descripcion": payload.cie10_descripcion,
        "tratamiento": payload.tratamiento,
        "recomendaciones": payload.recomendaciones,
        "recetas": [r.model_dump() for r in payload.recetas],
        "laboratorios": [l.model_dump() for l in payload.laboratorios],
        "estudios": [e.model_dump() for e in payload.estudios],
        "insumos": [i.model_dump() for i in payload.insumos],
        "ordenes_ids": payload.ordenes_ids,
        "comprobante_ref": payload.comprobante_ref or _generar_comprobante(),
    }
    try:
        creado = supabase.table("consultas").insert(registro).execute()
    except Exception:
        db_fail("registrar la consulta")

    fila = creado.data[0]
    if payload.cita_id:
        try:
            supabase.table("citas").update({"estado": "completada"}).eq(
                "codigo_confirmacion", payload.cita_id
            ).execute()
        except Exception:
            pass

    codigo_receta = _crear_receta_farmacia(payload, paciente, medico_nombre, fila["id"])
    return {
        "id": fila["id"],
        "comprobante_ref": fila["comprobante_ref"],
        "receta_codigo": codigo_receta,
    }


@router.get("/{paciente_id}", response_model=List[ConsultaDetalleResponse])
def listar_consultas(
    paciente_id: str,
    _: dict = Depends(exigir_staff),
) -> List[ConsultaDetalleResponse]:
    """Lista las consultas de un paciente por su id."""
    try:
        filas = (
            supabase.table("consultas")
            .select("*")
            .eq("paciente_id", paciente_id)
            .order("created_at", desc=True)
            .execute()
            .data
            or []
        )
    except Exception:
        db_fail("listar las consultas")

    nombres = _nombres_personal([c.get("medico_id") for c in filas])
    resultado: List[ConsultaDetalleResponse] = []
    for c in filas:
        c = dict(c)
        if not c.get("medico_nombre"):
            c["medico_nombre"] = nombres.get(c.get("medico_id"), "")
        resultado.append(
            ConsultaDetalleResponse(
                consulta_id=c["id"],
                fecha=c.get("created_at"),
                especialidad=c.get("especialidad", ""),
                medico_nombre=c.get("medico_nombre", ""),
                cie10_codigo=c.get("cie10_codigo", ""),
                cie10_descripcion=c.get("cie10_descripcion", ""),
                motivo_consulta=c.get("motivo_consulta", ""),
                examen_fisico=c.get("examen_fisico"),
                tratamiento=c.get("tratamiento", ""),
                recomendaciones=c.get("recomendaciones"),
                recetas=[{"nombre": m.get("nombre", ""), "posologia": m.get("posologia", "")} for m in parse_json_list(c.get("recetas"))],
                laboratorios=[{"parametro": l.get("parametro", ""), "valor": l.get("valor", "")} for l in parse_json_list(c.get("laboratorios"))],
                estudios=parse_json_list(c.get("estudios")),
                insumos=[InsumoAplicado(**i) for i in parse_json_list(c.get("insumos"))],
                ordenes_ids=[str(o) for o in (c.get("ordenes_ids") or [])],
                comprobante_ref=c.get("comprobante_ref", ""),
            )
        )
    return resultado
