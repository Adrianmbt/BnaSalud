from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.services.citas_recepcion import detener_worker, iniciar_worker


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Empuja en segundo plano las citas de recepción pendientes hacia el portal.
    iniciar_worker()
    try:
        yield
    finally:
        await detener_worker()


app = FastAPI(
    title="Sistema Asistencial Interno - BnaSalud",
    description="Backend aislado con pool de conexiones dedicado.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: solo orígenes explícitos (nunca "*" con credentials).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["Salud"])
async def health_check():
    return {"status": "ok", "modulo": "interno", "clinica_id": settings.id_centro}
