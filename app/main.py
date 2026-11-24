from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import supabase
from app.core.scheduler import detener_programador, iniciar_programador
from app.api.v1.endpoints.citas import router as citas_router
from app.api.v1.endpoints.centros import router as centros_router
from app.api.v1.endpoints.especialidades import router as especialidades_router
from app.api.v1.endpoints.pacientes import router as pacientes_router
from app.api.v1.endpoints.rag import router as rag_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.soporte import router as soporte_router
from app.api.v1.endpoints.panel import router as panel_router
from app.api.v1.endpoints.usuarios import router as usuarios_router
from app.api.v1.endpoints.almacen import router as almacen_router, router_ordenes
from app.api.v1.endpoints.catalogo import router as catalogo_router

@asynccontextmanager
async def lifespan(_: FastAPI):
    # Fase 5: tarea programada de recordatorios de cita (cada hora).
    # Se desactiva con ENABLE_SCHEDULER=false en plataformas sin proceso vivo.
    if settings.ENABLE_SCHEDULER:
        iniciar_programador()
    yield
    if settings.ENABLE_SCHEDULER:
        detener_programador()


app = FastAPI(
    title="Sistema de Salud Barcelona - API Backend",
    description="Backend para la gestión de citas, historias clínicas, emergencias, farmacia, talento humano y motor RAG",
    version=settings.VERSION,
    lifespan=lifespan,
)

# Configuración de CORS — en producción, CORS_ORIGINS="https://tu-frontend.vercel.app"
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origenes_cors or ["*"],
    allow_origin_regex=settings.CORS_ORIGIN_REGEX.strip() or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health():
    """Estado del servicio y de la conexión a la base de datos."""
    try:
        supabase.table("clinicas").select("id").limit(1).execute()
        db_estado = "ok"
    except Exception:
        db_estado = "error"
    return {
        "status": "online",
        "sistema": "Salud Barcelona Municipal",
        "version": settings.VERSION,
        "entorno": settings.ENVIRONMENT,
        "base_de_datos": db_estado,
    }


@app.get("/")
def raiz():
    """Respuesta de cortesía para sondas de la plataforma y para GET /."""
    return {
        "servicio": settings.PROJECT_NAME,
        "estado": "online",
        "documentacion": "/docs",
        "salud": "/api/v1/health",
    }


# Registrar los routers de los módulos
app.include_router(citas_router, prefix="/api/v1/citas", tags=["Citas Médicas"])
app.include_router(centros_router, prefix="/api/v1/centros", tags=["Centros de Salud"])
app.include_router(especialidades_router, prefix="/api/v1/especialidades", tags=["Especialidades"])
app.include_router(pacientes_router, prefix="/api/v1/pacientes", tags=["Pacientes"])
app.include_router(rag_router, prefix="/api/v1/rag", tags=["RAG / Asistente"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Autenticación"])
app.include_router(soporte_router, prefix="/api/v1/soporte", tags=["Soporte"])
app.include_router(panel_router, prefix="/api/v1/panel", tags=["Panel Institucional"])
app.include_router(usuarios_router, prefix="/api/v1/usuarios", tags=["Usuarios globales"])
app.include_router(almacen_router, prefix="/api/v1/almacen", tags=["Almacén"])
app.include_router(catalogo_router, prefix="/api/v1/catalogo", tags=["Catálogo de insumos"])
app.include_router(router_ordenes, prefix="/api/v1/ordenes-entrega", tags=["Órdenes de entrega"])

# Servir el frontend React (build de Vite en frontend/dist/) solo si existe.
# En el despliegue el frontend va por separado en Vercel, así que estos montajes
# no se activan; se conservan para el uso local (backend + build en un solo proceso).
DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=DIST_DIR), name="static")
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")

# Maquetas estáticas: solo si el directorio existe (no se copia a la imagen Docker).
MAQUETAS_DIR = Path(__file__).resolve().parent.parent / "frontend" / "maquetas"
if MAQUETAS_DIR.is_dir():
    app.mount("/maquetas", StaticFiles(directory=MAQUETAS_DIR, html=True), name="maquetas")
