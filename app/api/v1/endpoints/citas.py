from fastapi import APIRouter, HTTPException, status, Depends
from datetime import date
from typing import Union

# Importaciones de los esquemas desde app/schemas/schemas.py
from app.schemas.schemas import CitaConPacienteCreate, CitaCreate, CitaResponse

router = APIRouter()

CITAB_CENTER_ID = 2  # ID del CITAB en la BD (fase piloto)

# Mock temporal de la sesión de Base de Datos hasta configurar SQLAlchemy en db/session.py
def get_db():
    yield None


@router.post("", response_model=CitaResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=CitaResponse, status_code=status.HTTP_201_CREATED)
def crear_cita(
    payload: Union[CitaConPacienteCreate, CitaCreate], 
    db=Depends(get_db)
):
    # 1. Validar restricción del piloto (Solo CITAB)
    if payload.centro_id != CITAB_CENTER_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La reserva de citas en línea actualmente solo está disponible para el CITAB durante esta fase."
        )

    # Respuesta mock de prueba
    return {
        "id": "cita-001",
        "codigo_confirmacion": "CITAB-2026-89A1",
        "paciente_id": "pac-123",
        "centro_id": payload.centro_id,
        "especialidad_id": payload.especialidad_id,
        "fecha_cita": payload.fecha_cita,
        "hora_inicio": payload.hora_inicio,
        "motivo": payload.motivo,
        "origen": "cita_web",
        "estado": "pendiente",
        "created_at": "2026-08-07T12:00:00"
    }


@router.get("/disponibilidad")
def obtener_disponibilidad(
    centro_id: int, 
    especialidad_id: int, 
    fecha: date, 
    db=Depends(get_db)
):
    if centro_id != CITAB_CENTER_ID:
        return {
            "disponible": False, 
            "mensaje": "Centro no disponible para agenda digital actualmente.", 
            "slots": []
        }
        
    return {
        "centro_id": centro_id,
        "fecha": fecha,
        "slots": ["07:00", "07:30", "08:00", "08:30"]
    }