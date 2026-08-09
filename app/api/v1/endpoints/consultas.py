import secrets
from typing import List

from fastapi import APIRouter, status

from app.api.v1.errors import db_fail, fail, not_found
from app.api.v1.utils import parse_json_list
from app.core.database import supabase
from app.schemas.schemas import ConsultaCargarRequest, ConsultaDetalleResponse

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


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_consulta(payload: ConsultaCargarRequest) -> dict:
    """Registra una consulta médica en el historial clínico del paciente."""
    try:
        paciente = (
            supabase.table("historias_clinicas")
            .select("id")
            .eq("id", payload.paciente_id)
            .execute()
            .data
        )
    except Exception:
        db_fail("validar al paciente")
    if not paciente:
        not_found("Paciente")

    especialidad = payload.especialidad
    medico_nombre = payload.medico_nombre
    cita_especialidad = None
    if payload.cita_id:
        try:
            cita = (
                supabase.table("citas")
                .select("especialidad, estado")
                .eq("codigo_confirmacion", payload.cita_id)
                .execute()
                .data
            )
        except Exception:
            db_fail("validar la cita asociada")
        if cita:
            cita_especialidad = cita[0].get("especialidad")
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
    return {"id": fila["id"], "comprobante_ref": fila["comprobante_ref"]}


@router.get("/{paciente_id}", response_model=List[ConsultaDetalleResponse])
def listar_consultas(paciente_id: str) -> List[ConsultaDetalleResponse]:
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
                ordenes_ids=[str(o) for o in (c.get("ordenes_ids") or [])],
                comprobante_ref=c.get("comprobante_ref", ""),
            )
        )
    return resultado
