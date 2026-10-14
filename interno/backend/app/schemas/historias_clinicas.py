from typing import Optional, List

from pydantic import BaseModel, Field


class HistoriaClinicaCreate(BaseModel):
    """Payload para crear/actualizar una historia clínica."""
    cedula: str = Field(..., description="Cédula del paciente", example="18234567")
    nombre_completo: str = Field(..., description="Nombre completo del paciente")
    telefono: Optional[str] = Field(None, description="Teléfono de contacto")
    direccion: Optional[str] = Field(None, description="Dirección de residencia")
    tipo_sangre: Optional[str] = Field(None, description="Tipo de sangre ABO/Rh")
    antecedentes_medicos: Optional[List[str]] = Field(
        default_factory=list, description="Antecedentes médicos previos"
    )
    antecedentes_operatorios: Optional[List[str]] = Field(
        default_factory=list, description="Antecedentes operatorios (cirugías previas)"
    )
    alergias: Optional[List[str]] = Field(
        default_factory=list, description="Alergias conocidas"
    )


class HistoriaClinicaResponse(BaseModel):
    id: str
    cedula: str
    nombre_completo: str
    apellido: Optional[str]
    telefono: Optional[str]
    direccion: Optional[str]
    tipo_sangre: Optional[str]
    antecedentes_medicos: List[str]
    antecedentes_operatorios: List[str]
    alergias: List[str]
    numero_historia: str
    created_at: str

    class Config:
        from_attributes = True


class PrioridadPacienteEnum(str):
    VERDE = "VERDE"
    AMARILLO = "AMARILLO"
    ROJO = "ROJO"