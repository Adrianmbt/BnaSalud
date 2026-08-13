from datetime import datetime
from typing import Dict, List

from fastapi import APIRouter, Depends

from app.api.v1.deps import exigir_paciente_o_staff
from app.api.v1.errors import db_fail, fail, not_found
from app.api.v1.utils import parse_json_list, parse_list
from app.core.database import supabase
from app.schemas.schemas import (
    ConsultaDetalleResponse,
    HistoriaClinicaResponse,
    HistoriaClinicaUpdate,
    MedicamentoItem,
    LaboratorioResultado,
    MedicoPacienteResponse,
    ProgresoPacienteResponse,
)

router = APIRouter(tags=["Pacientes"])


def _a_historia(fila: dict) -> HistoriaClinicaResponse:
    return HistoriaClinicaResponse(
        id=fila["id"],
        numero_historia=fila.get("numero_historia", ""),
        tipo_cedula=fila.get("tipo_cedula", "V"),
        cedula=fila.get("cedula", ""),
        nombre_completo=fila.get("nombre_completo", ""),
        fecha_nacimiento=fila.get("fecha_nacimiento"),
        telefono=fila.get("telefono"),
        email=fila.get("email"),
        tipo_sangre=fila.get("tipo_sangre"),
        antecedentes_medicos=parse_list(fila.get("antecedentes_medicos")),
        alergias=parse_list(fila.get("alergias")),
        created_at=fila.get("created_at"),
    )


def _nombres_personal(medico_ids: List[int]) -> Dict[int, str]:
    """Mapa medico_id -> nombre completo para una lista de ids."""
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


def _buscar_paciente(cedula: str) -> dict:
    try:
        filas = (
            supabase.table("historias_clinicas")
            .select("*")
            .eq("cedula", cedula)
            .limit(1)
            .execute()
            .data
        )
    except Exception:
        db_fail("buscar al paciente")
    if not filas:
        not_found("Paciente")
    return filas[0]


def _a_consulta_detalle(fila: dict) -> ConsultaDetalleResponse:
    return ConsultaDetalleResponse(
        consulta_id=fila["id"],
        fecha=fila.get("created_at") or fila.get("fecha_consulta") or datetime.now(),
        especialidad=fila.get("especialidad", ""),
        medico_nombre=fila.get("medico_nombre", ""),
        cie10_codigo=fila.get("cie10_codigo", ""),
        cie10_descripcion=fila.get("cie10_descripcion", ""),
        motivo_consulta=fila.get("motivo_consulta", ""),
        examen_fisico=fila.get("examen_fisico"),
        tratamiento=fila.get("tratamiento", ""),
        recomendaciones=fila.get("recomendaciones"),
        recetas=[MedicamentoItem(**m) for m in parse_json_list(fila.get("recetas"))],
        laboratorios=[LaboratorioResultado(**l) for l in parse_json_list(fila.get("laboratorios"))],
        estudios=parse_json_list(fila.get("estudios")),
        ordenes_ids=[str(o) for o in (fila.get("ordenes_ids") or [])],
        comprobante_ref=fila.get("comprobante_ref", ""),
    )


@router.get("/{cedula}", response_model=HistoriaClinicaResponse)
def obtener_paciente(
    cedula: str,
    _: dict = Depends(exigir_paciente_o_staff),
) -> HistoriaClinicaResponse:
    """Obtiene la historia clínica de un paciente por su cédula.

    Acceso: el propio paciente (cédula+PIN) o el personal autenticado.
    """
    return _a_historia(_buscar_paciente(cedula.strip()))


@router.patch("/{cedula}", response_model=HistoriaClinicaResponse)
def actualizar_paciente(
    cedula: str,
    payload: HistoriaClinicaUpdate,
    _: dict = Depends(exigir_paciente_o_staff),
) -> HistoriaClinicaResponse:
    """Actualiza el perfil editable del paciente (datos clínicos y contacto).

    El paciente puede registrar su tipo de sangre, alergias, antecedentes
    y datos de contacto; el médico los ve en su módulo de consultas.
    """
    fila = _buscar_paciente(cedula.strip())
    datos = payload.model_dump(exclude_unset=True, mode="json")
    if not datos:
        fail("No hay campos para actualizar.")

    # Normalizar listas vacías a [] (evita enviar None que Supabase rechaza).
    for campo in ("alergias", "antecedentes_medicos"):
        if campo in datos and datos[campo] is None:
            datos[campo] = []

    try:
        supabase.table("historias_clinicas").update(datos).eq("id", fila["id"]).execute()
    except Exception:
        db_fail("actualizar los datos del paciente")

    try:
        actualizado = (
            supabase.table("historias_clinicas")
            .select("*")
            .eq("id", fila["id"])
            .execute()
            .data[0]
        )
    except Exception:
        db_fail("recargar los datos actualizados")
    return _a_historia(actualizado)


@router.get("/{cedula}/medico", response_model=MedicoPacienteResponse)
def medico_tratante(
    cedula: str,
    _: dict = Depends(exigir_paciente_o_staff),
) -> MedicoPacienteResponse:
    """Médico principal asignado al paciente (relación médico_pacientes).

    Si aún no hay vínculo formal, se deduce del médico de la última consulta.
    """
    fila = _buscar_paciente(cedula.strip())
    try:
        relacion = (
            supabase.table("medico_pacientes")
            .select("tipo, estado, personal(id, nombre, apellido, especialidad, cargo)")
            .eq("paciente_id", fila["id"])
            .eq("tipo", "principal")
            .eq("estado", "activo")
            .limit(1)
            .execute()
            .data
            or []
        )
    except Exception:
        relacion = []
    if relacion:
        m = relacion[0].get("personal") or {}
        nombre = f"{m.get('nombre', '')} {m.get('apellido', '')}".strip()
        return MedicoPacienteResponse(
            medico_id=m.get("id"),
            nombre=nombre or None,
            especialidad=m.get("especialidad"),
            tipo=relacion[0].get("tipo", "principal"),
            estado=relacion[0].get("estado", "activo"),
        )

    try:
        consulta = (
            supabase.table("consultas")
            .select("medico_id, medico_nombre, especialidad")
            .eq("paciente_id", fila["id"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
    except Exception:
        consulta = []
    if consulta:
        c = consulta[0]
        return MedicoPacienteResponse(
            medico_id=c.get("medico_id"),
            nombre=c.get("medico_nombre") or None,
            especialidad=c.get("especialidad"),
            tipo="seguimiento",
            estado="activo",
        )
    return MedicoPacienteResponse()


@router.get("/{cedula}/historial", response_model=ProgresoPacienteResponse)
def historial_paciente(
    cedula: str,
    _: dict = Depends(exigir_paciente_o_staff),
) -> ProgresoPacienteResponse:
    """Historial clínico completo del paciente (datos + consultas)."""
    fila = _buscar_paciente(cedula.strip())
    try:
        consultas = (
            supabase.table("consultas")
            .select("*")
            .eq("paciente_id", fila["id"])
            .order("created_at", desc=True)
            .execute()
            .data
            or []
        )
    except Exception:
        db_fail("cargar el historial clínico")

    nombres = _nombres_personal([c.get("medico_id") for c in consultas])
    historial: List[ConsultaDetalleResponse] = []
    for c in consultas:
        c = dict(c)
        if not c.get("medico_nombre"):
            c["medico_nombre"] = nombres.get(c.get("medico_id"), "")
        historial.append(_a_consulta_detalle(c))

    return ProgresoPacienteResponse(
        paciente=_a_historia(fila),
        total_consultas=len(historial),
        historial=historial,
    )
