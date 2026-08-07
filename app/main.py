from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Importamos los routers desde los endpoints
from app.api.v1.endpoints.citas import router as citas_router
from app.api.v1.endpoints.rrhh import router as rrhh_router
from app.api.v1.endpoints.farmacia import router as farmacia_router
from app.api.v1.endpoints.centros import router as centros_router
from app.api.v1.endpoints.especialidades import router as especialidades_router

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

@app.get("/")
def read_root():
    return {
        "status": "online",
        "sistema": "Salud Barcelona Municipal",
        "version": "1.0.0"
    }

# Registrar los routers de los módulos
app.include_router(citas_router, prefix="/api/v1/citas", tags=["Citas Médicas"])
app.include_router(rrhh_router, prefix="/api/v1/rrhh", tags=["Talento Humano"])
app.include_router(farmacia_router, prefix="/api/v1/farmacia", tags=["Farmacia"])
app.include_router(centros_router, prefix="/api/v1/centros", tags=["Centros de Salud"])
app.include_router(especialidades_router, prefix="/api/v1/especialidades", tags=["Especialidades"])

# Servir el frontend (HTML + imágenes + assets) desde la carpeta frontend/
app.mount("/static", StaticFiles(directory="frontend"), name="static")
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
