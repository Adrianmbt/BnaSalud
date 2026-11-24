from fastapi import APIRouter, Depends

from app.api.v1.endpoints import (
    guardias,
    auth,
    almacen,
    clinicas,
    cola,
    personal,
    consultas,
    examenes,
    farmacia,
    historias_clinicas,
    historias_medicas,
    busqueda,
    agenda,
    citas_recepcion,
    medicamentos,
    remision_examenes,
    admin_sistema,
    dashboard,
    whatsapp,
    diagnostico,
    reprogramaciones,
    rrhh,
)
from app.core.security import get_current_user, require_roles

api_router = APIRouter()

# Solo /auth está público; el resto exige un JWT válido.
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
api_router.include_router(
    admin_sistema.router,
    prefix="/admin",
    tags=["Admin Sistema"],
    dependencies=[Depends(require_roles("admin_sistemas", "director", "recursos_humanos"))],
)
api_router.include_router(
    almacen.router,
    prefix="/almacen",
    tags=["Almacén"],
    dependencies=[Depends(require_roles("jefe_almacen", "admin_sistemas", "director"))],
)
api_router.include_router(clinicas.router, prefix="/clinicas", tags=["Clínicas"], dependencies=[Depends(get_current_user)])
api_router.include_router(cola.router, prefix="/cola", tags=["Cola de Atención"], dependencies=[Depends(get_current_user)])
api_router.include_router(consultas.router, prefix="/consultas", tags=["Consultas"], dependencies=[Depends(get_current_user)])
api_router.include_router(farmacia.router, prefix="/farmacia", tags=["Farmacia"], dependencies=[Depends(get_current_user)])
api_router.include_router(historias_clinicas.router, prefix="/historias-clinicas", tags=["Historias Clínicas"], dependencies=[Depends(get_current_user)])
api_router.include_router(
    historias_medicas.router,
    prefix="/historias-medicas",
    tags=["Historias Médicas"],
    dependencies=[Depends(get_current_user)],
)
api_router.include_router(busqueda.router, prefix="/busqueda", tags=["Búsqueda"], dependencies=[Depends(get_current_user)])
api_router.include_router(agenda.router, prefix="/agenda", tags=["Agenda"], dependencies=[Depends(get_current_user)])
api_router.include_router(medicamentos.router, prefix="/medicamentos", tags=["Medicamentos"], dependencies=[Depends(get_current_user)])
api_router.include_router(remision_examenes.router, prefix="/remision-examen", tags=["Remisión de exámenes"], dependencies=[Depends(get_current_user)])
api_router.include_router(examenes.router, prefix="/examenes", tags=["Exámenes y Órdenes"], dependencies=[Depends(get_current_user)])
api_router.include_router(guardias.router, prefix="/guardias", tags=["Guardias"], dependencies=[Depends(get_current_user)])
api_router.include_router(personal.router, prefix="/personal", tags=["Personal"], dependencies=[Depends(get_current_user)])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"], dependencies=[Depends(get_current_user)])
api_router.include_router(whatsapp.router, prefix="/whatsapp", tags=["WhatsApp"], dependencies=[Depends(get_current_user)])
api_router.include_router(
    citas_recepcion.router,
    prefix="/recepcion",
    tags=["Citas de recepción"],
    dependencies=[Depends(require_roles("recepcionista", "admin_sistemas", "director"))],
)
api_router.include_router(diagnostico.router, prefix="/diagnostico", tags=["Diagnóstico"])
api_router.include_router(
    reprogramaciones.router,
    prefix="/reprogramaciones",
    tags=["Reprogramación de citas"],
    dependencies=[Depends(get_current_user)],
)
api_router.include_router(
    rrhh.router,
    prefix="/rrhh",
    tags=["Recursos Humanos"],
    dependencies=[Depends(require_roles("recursos_humanos", "admin_sistemas", "superusuario"))],
)
