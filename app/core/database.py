from supabase import create_client, Client
from app.core.config import settings

def get_supabase_client() -> Client:
    """Retorna una instancia activa del cliente Supabase."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

# Instancia singleton para consultas directas
supabase: Client = get_supabase_client()