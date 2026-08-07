from fastapi import APIRouter, HTTPException, status
from app.schemas.schemas import DespacharRecetaRequestSchema, RecetaResponseSchema

router = APIRouter()

@router.get("/recetas/{codigo_o_cedula}", response_model=RecetaResponseSchema)
def buscar_receta(codigo_o_cedula: str):
    if not codigo_o_cedula:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
        
    return {
        "id": 892,
        "codigo_receta": "#RX-2026-0892",
        "paciente_cedula": "V-18234567",
        "paciente_nombre": "Carlos Mendoza",
        "medico": "Dr. Antonio Valera",
        "estado": "PENDIENTE",
        "detalles": [
            {
                "medicamento_id": 14,
                "nombre_medicamento": "Amoxicilina 500mg",
                "cantidad_prescrita": 21,
                "cantidad_despachada": 0,
                "posologia": "1 cápsula cada 8 horas por 7 días"
            }
        ]
    }

@router.post("/despachar", status_code=status.HTTP_200_OK)
def despachar_receta(payload: DespacharRecetaRequestSchema):
    return {
        "status": "success",
        "message": "Despacho procesado e inventario actualizado con éxito",
        "receta_id": payload.receta_id
    }