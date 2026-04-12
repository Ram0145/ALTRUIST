from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user_id
from app.database import get_supabase
from app.schemas.schemas import ProfileOut

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/me", response_model=ProfileOut, summary="Get current user profile")
def get_me(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    """
    Returns the profile of the currently authenticated user.
    The JWT in the Authorization header identifies the user.
    """
    result = db.table("profiles").select("*").eq("id", user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data


@router.patch("/me", response_model=ProfileOut, summary="Update profile name")
def update_me(
    payload: dict,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    result = (
        db.table("profiles")
        .update({"name": payload.get("name")})
        .eq("id", user_id)
        .execute()
    )
    return result.data[0]
