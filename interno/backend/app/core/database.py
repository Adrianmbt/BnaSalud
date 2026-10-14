import os
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base

from app.core.config import settings

# PostgreSQL URL desde variables de entorno (directo a la base de datos de Supabase).
DATABASE_URL = os.getenv("DATABASE_URL", settings.DATABASE_URL)

# Configuración del Pool de Conexiones
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=settings.DB_POOL_SIZE,        # Conexiones activas permanentes en el pool
    max_overflow=settings.DB_MAX_OVERFLOW,  # Conexiones adicionales temporales bajo pico
    pool_timeout=settings.DB_POOL_TIMEOUT,  # Máximo de espera por una conexión disponible
    pool_recycle=settings.DB_POOL_RECYCLE,  # Recicla conexiones para evitar desconexiones
    pool_pre_ping=True,
)

# Generador de sesiones asíncronas
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db():
    """Dependency: inyecta la sesión del pool en los endpoints de FastAPI."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
