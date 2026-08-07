from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.schemas.schemas import CentroSaludResponse
from app.core.database import supabase

router = APIRouter(tags=["Centros de Salud"])

# Catálogo de presentación por código de clínica (desde el boceto)
CATALOGO = {
    "CLN-CITAB": {
        "subtitulo": "Clínica de los Trabajadores",
        "tipo": "Aliado",
        "horario": "Lun - Vie 7:00 AM - 6:00 PM",
        "servicios": ["Medicina Laboral", "Medicina General", "Farmacia"],
        "logo": "/identidad visual/Citab.jpeg",
        "fondoColor": "#1d52d8",
        "textColor": "secondary",
        "tagText": "text-secondary",
        "bgTag": "bg-secondary/10",
    },
    "CLN-MUJER": {
        "subtitulo": "Atención integral de la mujer",
        "tipo": "Especializada",
        "horario": "Lun - Sáb 7:00 AM - 5:00 PM",
        "servicios": ["Ginecología", "Obstetricia", "Ecografía", "Planificación"],
        "logo": "/identidad visual/CliMujer.jpeg",
        "fondoColor": "#541e8c",
        "textColor": "rose-700",
        "tagText": "text-rose-700",
        "bgTag": "bg-rose-50",
    },
    "CLN-NINO": {
        "subtitulo": "Pediatría y crecimiento infantil",
        "tipo": "Especializada",
        "horario": "Lun - Sáb 7:00 AM - 6:00 PM",
        "servicios": ["Pediatría", "Vacunación", "Nutrición Infantil"],
        "logo": "/identidad visual/CliNiño.jpeg",
        "fondoColor": "#00b4d8",
        "textColor": "cyan-700",
        "tagText": "text-cyan-700",
        "bgTag": "bg-cyan-50",
    },
    "CLN-ONCO": {
        "subtitulo": "Oncología y cuidados paliativos",
        "tipo": "Especializado",
        "horario": "Lun - Vie 7:00 AM - 5:00 PM",
        "servicios": ["Oncología", "Quimioterapia", "Cuidados Paliativos"],
        "logo": "/identidad visual/Oncologico.jpeg",
        "fondoColor": "#6f42c1",
        "textColor": "purple-700",
        "tagText": "text-purple-700",
        "bgTag": "bg-purple-50",
    },
    "CLN-JORNADAS": {
        "subtitulo": "Atención comunitaria itinerante",
        "tipo": "Comunitario",
        "horario": "Fines de semana · Calendario público",
        "servicios": ["Atención Primaria", "Vacunación", "Despistaje"],
        "logo": "/identidad visual/JornadasSaludBna.jpeg",
        "fondoColor": "#0d9488",
        "textColor": "emerald-700",
        "tagText": "text-emerald-700",
        "bgTag": "bg-emerald-50",
    },
}

# Datos de respaldo (si Supabase no responde) para no romper la página
MAQUETA_FALLBACK: List[dict] = [
    {
        "id": 1, "nombre": "Clínica del Niño", "codigo": "CLN-NINO", "parroquia": "El Carmen",
        "direccion": "Barcelona, Anzoátegui", "activo": True,
    },
    {
        "id": 2, "nombre": "Clínica de los Trabajadores (CITAB)", "codigo": "CLN-CITAB", "parroquia": "El Carmen",
        "direccion": "Barcelona, Anzoátegui", "activo": True,
    },
    {
        "id": 3, "nombre": "Clínica de la Mujer", "codigo": "CLN-MUJER", "parroquia": "San Cristóbal",
        "direccion": "Barcelona, Anzoátegui", "activo": True,
    },
    {
        "id": 4, "nombre": "Centro Oncológico Municipal", "codigo": "CLN-ONCO", "parroquia": "El Carmen",
        "direccion": "Barcelona, Anzoátegui", "activo": True,
    },
    {
        "id": 5, "nombre": "Jornadas de Salud Móviles", "codigo": "CLN-JORNADAS", "parroquia": "General",
        "direccion": "Atención Itinerante - Municipio Simón Bolívar", "activo": True,
    },
]


def _aplicar_catalogo(fila: dict) -> CentroSaludResponse:
    """Combina la fila de la tabla clinicas con el catálogo visual por código."""
    extras = CATALOGO.get(fila.get("codigo", ""), {})
    base = {
        "id": fila.get("id"),
        "nombre": fila.get("nombre", ""),
        "subtitulo": extras.get("subtitulo", fila.get("nombre", "")),
        "tipo": extras.get("tipo", "Aliado"),
        "parroquia": fila.get("parroquia", ""),
        "direccion": fila.get("direccion", ""),
        "horario": extras.get("horario", "Consultar horario"),
        "servicios": extras.get("servicios", []),
        "logo": extras.get("logo", "/identidad visual/SBna.jpeg"),
        "fondoColor": extras.get("fondoColor", "#00677d"),
        "disabled": not fila.get("activo", True),
    }
    extras_fields = {"textColor", "tagText", "bgTag"}
    for campo in extras_fields:
        if campo in extras:
            base[campo] = extras[campo]
    return CentroSaludResponse(**base)


@router.get("", response_model=List[CentroSaludResponse])
@router.get("/", response_model=List[CentroSaludResponse])
def listar_centros() -> List[CentroSaludResponse]:
    """Lista los centros de salud de la red municipal (desde Supabase)."""
    try:
        res = supabase.table("clinicas").select("*").order("id").execute()
        filas = res.data or []
        return [_aplicar_catalogo(f) for f in filas]
    except Exception:
        return [_aplicar_catalogo(f) for f in MAQUETA_FALLBACK]


@router.get("/{centro_id}", response_model=CentroSaludResponse)
def obtener_centro(centro_id: int) -> CentroSaludResponse:
    """Obtiene el detalle de un centro de salud por su ID."""
    try:
        res = supabase.table("clinicas").select("*").eq("id", centro_id).execute()
        if res.data:
            return _aplicar_catalogo(res.data[0])
    except Exception:
        pass
    for f in MAQUETA_FALLBACK:
        if f["id"] == centro_id:
            return _aplicar_catalogo(f)
    raise HTTPException(status_code=404, detail="Centro de salud no encontrado.")