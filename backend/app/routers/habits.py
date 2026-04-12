from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.core.security import get_current_user_id
from app.database import get_supabase
from app.schemas.schemas import HabitCreate, HabitUpdate, HabitOut

router = APIRouter(prefix="/habits", tags=["Habits"])


@router.get("/", response_model=List[HabitOut], summary="Get all habits for user")
def get_habits(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    result = (
        db.table("habits")
        .select("*")
        .eq("user_id", user_id)
        .eq("active", True)
        .order("position")
        .execute()
    )
    return result.data


@router.post("/", response_model=HabitOut, status_code=201, summary="Create a new habit")
def create_habit(
    payload: HabitCreate,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    result = (
        db.table("habits")
        .insert({**payload.model_dump(), "user_id": user_id})
        .execute()
    )
    return result.data[0]


@router.patch("/{habit_id}", response_model=HabitOut, summary="Update a habit")
def update_habit(
    habit_id: str,
    payload: HabitUpdate,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    # Ensure habit belongs to user
    existing = (
        db.table("habits").select("id").eq("id", habit_id).eq("user_id", user_id).execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Habit not found")

    result = (
        db.table("habits")
        .update(payload.model_dump(exclude_none=True))
        .eq("id", habit_id)
        .execute()
    )
    return result.data[0]


@router.delete("/{habit_id}", status_code=204, summary="Soft-delete a habit")
def delete_habit(
    habit_id: str,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    existing = (
        db.table("habits").select("id").eq("id", habit_id).eq("user_id", user_id).execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Habit not found")

    db.table("habits").update({"active": False}).eq("id", habit_id).execute()
