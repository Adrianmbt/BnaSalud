from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    PROJECT_NAME: str = "Sistema Asistencial Interno - BnaSalud"
    API_V1_STR: str = "/api/v1"

    # PostgreSQL (Supabase) — pool de conexiones asíncronas con asyncpg.
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:tu_password@db.supabase.co:5432/postgres"
    )

    # Pool de conexiones
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    # Autenticación (JWT)
    JWT_SECRET: str = "bna-salud-interno-cambiar-en-produccion"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRACION_MINUTOS: int = 480  # 8 horas

    # CORS: orígenes permitidos (separados por coma).
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Evolution API (WhatsApp)
    EVOLUTION_API_URL: str = "http://localhost:8080"
    EVOLUTION_API_KEY: str = ""
    EVOLUTION_INSTANCE_NAME: str = "bnasalud"

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
