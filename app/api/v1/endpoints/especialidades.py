from typing import List, Optional

from fastapi import APIRouter, Query

from app.schemas.schemas import EspecialidadResponse

router = APIRouter(tags=["Especialidades"])

ESPECIALIDADES: List[EspecialidadResponse] = [
    {"id": 1, "nombre": "Medicina General", "descripcion": "Medicina de familia y prevención.", "icono": "stethoscope"},
    {"id": 2, "nombre": "Pediatría", "descripcion": "Cuidado integral para los más pequeños.", "icono": "child_care"},
    {"id": 3, "nombre": "Ginecología", "descripcion": "Atención ginecológica y obstetricia.", "icono": "female"},
    {"id": 4, "nombre": "Cardiología", "descripcion": "Diagnóstico y tratamiento cardiovascular.", "icono": "cardiology"},
    {"id": 5, "nombre": "Odontología", "descripcion": "Salud bucodental avanzada y estética.", "icono": "dentistry"},
    {"id": 6, "nombre": "Psicología", "descripcion": "Atención en salud mental y bienestar.", "icono": "psychology"},
    {"id": 7, "nombre": "Oncología", "descripcion": "Diagnóstico y tratamiento del cáncer.", "icono": "radiology"},
]


@router.get("", response_model=List[EspecialidadResponse])
@router.get("/", response_model=List[EspecialidadResponse])
def listar_especialidades(
    centro_id: Optional[int] = Query(default=None, description="Filtro opcional por centro de salud")
) -> List[EspecialidadResponse]:
    """Lista las especialidades médicas de la red municipal."""
    return ESPECIALIDADES
