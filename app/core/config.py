from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "Sistema de Salud Barcelona - API Backend"
    API_V1_STR: str = "/api/v1"
    
    # Credenciales Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    
    # Google Gemini / GCP
    GOOGLE_API_KEY: str = ""

    # Autenticación (JWT)
    JWT_SECRET: str = "bna-salud-cambiar-en-produccion-por-un-secreto-largo"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRACION_MINUTOS: int = 480  # 8 horas
    PIN_EXPIRACION_MINUTOS: int = 15   # códigos de recuperación de PIN
    PIN_EMITIR_DEMO: bool = True       # devuelve el código en la respuesta (sin SMTP)

    # SMTP (Fase 3): tarjeta de bienvenida y recuperación de PIN por correo.
    # Si SMTP_HOST está vacío, todo queda en modo demo (PIN en pantalla).
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

    # WhatsApp (Green API) — Fase piloto CITAB
    GREEN_API_URL: str = "https://1103.api.green-api.com"
    GREEN_API_INSTANCE: str = ""
    GREEN_API_TOKEN: str = ""

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()