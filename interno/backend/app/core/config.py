from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    PROJECT_NAME: str = "Sistema Asistencial Interno - BnaSalud"
    API_V1_STR: str = "/api/v1"

    # PostgreSQL local
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:19674244@localhost:5432/bnasalud"
    )

    # Identificador de la clínica / centro / sede para esta instalación (ej. 2 = CITAB)
    CLINICA_ID: int = 2
    CENTRO_ID: Optional[int] = None

    # Cuando está en False, certificar una semana NO reparte automáticamente las
    # citas preasignadas; recepción las asigna manualmente desde "Citas programadas".
    REPARTO_AUTOMATICO: bool = False

    @property
    def id_centro(self) -> int:
        return self.CENTRO_ID if self.CENTRO_ID is not None else self.CLINICA_ID

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

    # Sincronización con el Portal Público (Supabase REST API)
    SUPABASE_URL: str = "https://unvtznfvbdqzsmtlvqkf.supabase.co"
    SUPABASE_KEY: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVudnR6bmZ2YmRxenNtdGx2cWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMDkwNjAsImV4cCI6MjEwMTY4NTA2MH0.Fx3xy_96_eaP7XFNky4HqDedoHnmEQITLONVp_AXc7M"

    # Evolution API (WhatsApp)
    EVOLUTION_API_URL: str = "http://localhost:8080"
    EVOLUTION_API_KEY: str = "Bn@Salud2026!Ev0lut1on"
    EVOLUTION_INSTANCE_NAME: str = "bnasalud"
    EVOLUTION_INSTANCE_TOKEN: str = "A5E605A1-33E9-4481-B582-2F0BA820AFCB"

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
