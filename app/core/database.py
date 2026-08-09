from supabase import create_client, Client

from app.core.config import settings

_client: Client | None = None


def get_supabase_client() -> Client:
    """Retorna una instancia única (singleton) del cliente Supabase."""
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _client


# Instancia singleton para consultas directas en toda la app.
supabase: Client = get_supabase_client()
