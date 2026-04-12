from fastapi import APIRouter, Depends
from app.core.security import get_current_user_id
from app.database import get_supabase
from app.schemas.schemas import SettingsUpsert, SettingsOut

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/", response_model=SettingsOut, summary="Get user settings")
def get_settings_route(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    result = db.table("settings").select("*").eq("user_id", user_id).execute()
    if not result.data:
        # Return defaults if no settings row yet
        return SettingsOut()
    return result.data[0]


@router.put("/", response_model=SettingsOut, summary="Upsert user settings")
def upsert_settings(
    payload: SettingsUpsert,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    data = {**payload.model_dump(), "user_id": user_id}
    result = db.table("settings").upsert(data, on_conflict="user_id").execute()
    return result.data[0]
