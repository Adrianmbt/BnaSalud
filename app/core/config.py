from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Sistema de Salud Barcelona - API Backend"
    API_V1_STR: str = "/api/v1"
    
    # Credenciales Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    
    # Google Gemini / GCP
    GOOGLE_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()