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

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()