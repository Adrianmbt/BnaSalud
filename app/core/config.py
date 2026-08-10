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

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()