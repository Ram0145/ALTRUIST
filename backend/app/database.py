from supabase import create_client, Client
from app.core.config import get_settings
from functools import lru_cache


@lru_cache()
def get_supabase() -> Client:
    """
    Returns a Supabase client using the service role key.
    Service key bypasses RLS — FastAPI enforces user scoping manually.
    Cache it so we reuse one client per process.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_key)
