from typing import List

from fastapi import APIRouter

from app.schemas.schemas import CentroSaludResponse

router = APIRouter(tags=["Centros de Salud"])

CENTROS_SALUD: List[CentroSaludResponse] = [
    {
        "id": 1,
        "nombre": "CITAB",
        "subtitulo": "Clínica de los Trabajadores",
        "tipo": "Aliado",
        "parroquia": "Barcelona Centro",
        "direccion": "Av. Fuerzas Armadas, Barcelona 6001",
        "horario": "Lun - Vie 7:00 AM - 6:00 PM",
        "servicios": ["Medicina Laboral", "Medicina General", "Farmacia"],
        "logo": "/static/identidad visual/Citab.jpeg",
        "textColor": "secondary",
        "tagText": "text-secondary",
        "bgTag": "bg-secondary/10",
        "disabled": False,
    },
    {
        "id": 2,
        "nombre": "Clínica de la Mujer",
        "subtitulo": "Atención integral de la mujer",
        "tipo": "Especializada",
        "parroquia": "Barcelona",
        "direccion": "Av. Miranda, Barcelona",
        "horario": "Lun - Sáb 7:00 AM - 5:00 PM",
        "servicios": ["Ginecología", "Obstetricia", "Ecografía", "Planificación"],
        "logo": "/static/identidad visual/CliMujer.jpeg",
        "textColor": "rose-700",
        "tagText": "text-rose-700",
        "bgTag": "bg-rose-50",
        "disabled": False,
    },
    {
        "id": 3,
        "nombre": "Clínica del Niño",
        "subtitulo": "Pediatría y crecimiento infantil",
        "tipo": "Especializada",
        "parroquia": "Barcelona",
        "direccion": "Av. Bolívar Norte, Barcelona",
        "horario": "Lun - Sáb 7:00 AM - 6:00 PM",
        "servicios": ["Pediatría", "Vacunación", "Nutrición Infantil"],
        "logo": "/static/identidad visual/CliNiño.jpeg",
        "textColor": "cyan-700",
        "tagText": "text-cyan-700",
        "bgTag": "bg-cyan-50",
        "disabled": False,
    },
    {
        "id": 4,
        "nombre": "Jornadas de Salud",
        "subtitulo": "Atención comunitaria itinerante",
        "tipo": "Comunitario",
        "parroquia": "Todas las parroquias",
        "direccion": "Programación itinerante por parroquias",
        "horario": "Fines de semana · Calendario público",
        "servicios": ["Atención Primaria", "Vacunación", "Despistaje"],
        "logo": "/static/identidad visual/JornadasSaludBna.jpeg",
        "textColor": "emerald-700",
        "tagText": "text-emerald-700",
        "bgTag": "bg-emerald-50",
        "disabled": False,
    },
    {
        "id": 5,
        "nombre": "Centro Oncológico",
        "subtitulo": "Oncología y cuidados paliativos",
        "tipo": "Especializado",
        "parroquia": "Barcelona",
        "direccion": "Av. Principal de Barcelona",
        "horario": "Lun - Vie 7:00 AM - 5:00 PM",
        "servicios": ["Oncología", "Quimioterapia", "Cuidados Paliativos"],
        "logo": "/static/identidad visual/Oncologico.jpeg",
        "textColor": "purple-700",
        "tagText": "text-purple-700",
        "bgTag": "bg-purple-50",
        "disabled": False,
    },
]


@router.get("/", response_model=List[CentroSaludResponse])
def listar_centros() -> List[CentroSaludResponse]:
    """Lista los centros de salud que integran la red municipal."""
    return CENTROS_SALUD


@router.get("/{centro_id}", response_model=CentroSaludResponse)
def obtener_centro(centro_id: int) -> CentroSaludResponse:
    """Obtiene el detalle de un centro de salud por su ID."""
    for centro in CENTROS_SALUD:
        if centro.id == centro_id:
            return centro
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Centro de salud no encontrado.")
