from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.database import supabase
from app.api.v1.endpoints.citas import router as citas_router
from app.api.v1.endpoints.rrhh import router as rrhh_router
from app.api.v1.endpoints.farmacia import router as farmacia_router
from app.api.v1.endpoints.centros import router as centros_router
from app.api.v1.endpoints.especialidades import router as especialidades_router
from app.api.v1.endpoints.pacientes import router as pacientes_router
from app.api.v1.endpoints.consultas import router as consultas_router
from app.api.v1.endpoints.emergencias import router as emergencias_router
from app.api.v1.endpoints.estudios import router as estudios_router
from app.api.v1.endpoints.rag import router as rag_router

app = FastAPI(
    title="Sistema de Salud Barcelona - API Backend",
    description="Backend para la gestión de citas, historias clínicas, emergencias, farmacia, talento humano y motor RAG",
    version="1.0.0"
)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Ajustar a las URLs exactas en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def read_root():
    """Estado del servicio y de la conexión a la base de datos."""
    try:
        supabase.table("clinicas").select("id").limit(1).execute()
        db_estado = "ok"
    except Exception:
        db_estado = "error"
    return {
        "status": "online",
        "sistema": "Salud Barcelona Municipal",
        "version": "1.0.0",
        "base_de_datos": db_estado,
    }


# Registrar los routers de los módulos
app.include_router(citas_router, prefix="/api/v1/citas", tags=["Citas Médicas"])
app.include_router(rrhh_router, prefix="/api/v1/rrhh", tags=["Talento Humano"])
app.include_router(farmacia_router, prefix="/api/v1/farmacia", tags=["Farmacia"])
app.include_router(centros_router, prefix="/api/v1/centros", tags=["Centros de Salud"])
app.include_router(especialidades_router, prefix="/api/v1/especialidades", tags=["Especialidades"])
app.include_router(pacientes_router, prefix="/api/v1/pacientes", tags=["Pacientes"])
app.include_router(consultas_router, prefix="/api/v1/consultas", tags=["Consultas"])
app.include_router(emergencias_router, prefix="/api/v1/emergencias", tags=["Emergencias"])
app.include_router(estudios_router, prefix="/api/v1/estudios", tags=["Estudios / OCR"])
app.include_router(rag_router, prefix="/api/v1/rag", tags=["RAG / Asistente"])

# Servir el frontend React (build de Vite en frontend/dist/) solo si existe
DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=DIST_DIR), name="static")
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")
app.mount("/maquetas", StaticFiles(directory="frontend/maquetas", html=True), name="maquetas")
