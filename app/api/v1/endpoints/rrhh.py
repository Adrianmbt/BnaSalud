from fastapi import APIRouter, Query, status
from datetime import date
from app.schemas.schemas import AsignarTurnoSchema, DisponibilidadResponseSchema

router = APIRouter()

@router.get("/disponibilidad", response_model=DisponibilidadResponseSchema)
def obtener_disponibilidad_personal(
    clinica_id: int = Query(..., description="ID del centro de salud"),
    fecha: date = Query(default=date.today(), description="Fecha de consulta")
):
    return {
        "clinica_id": clinica_id,
        "fecha": fecha,
        "total_personal_guardia": 1,
        "turnos": [
            {
                "turno": "Guardia 24h",
                "horario": "08:00 - 08:00",
                "personal": [
                    {
                        "personal_id": 102,
                        "nombre": "Dr. Antonio Valera",
                        "cargo": "Médico",
                        "especialidad": "Cardiología",
                        "telefono": "+58 414 123 4567",
                        "status": "EN_GUARDIA"
                    }
                ]
            }
        ]
    }

@router.post("/asignar-turno", status_code=status.HTTP_201_CREATED)
def asignar_turno_personal(payload: AsignarTurnoSchema):
    return {"message": "Turno asignado exitosamente", "data": payload}