from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.core.security import get_current_user_id
from app.database import get_supabase
from app.schemas.schemas import PlanCreate, PlanUpdate, PlanOut

router = APIRouter(prefix="/plans", tags=["Plans"])


@router.get("/", response_model=List[PlanOut], summary="Get all plans for user")
def get_plans(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    result = (
        db.table("plans")
        .select("*")
        .eq("user_id", user_id)
        .eq("deleted", False)
        .order("start_date")
        .execute()
    )
    return result.data


@router.post("/", response_model=PlanOut, status_code=201, summary="Create a new plan")
def create_plan(
    payload: PlanCreate,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    data = {
        **payload.model_dump(),
        "user_id": user_id,
        "start_date": str(payload.start_date),
        "end_date": str(payload.end_date) if payload.end_date else None,
        "done_dates": [],
        "completed_on_date": None,
    }
    result = db.table("plans").insert(data).execute()
    return result.data[0]


@router.patch("/{plan_id}", response_model=PlanOut, summary="Update plan (check off, delete, etc.)")
def update_plan(
    plan_id: str,
    payload: PlanUpdate,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    existing = (
        db.table("plans").select("id").eq("id", plan_id).eq("user_id", user_id).execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    update_data = payload.model_dump(exclude_none=True)
    if "done_dates" in update_data:
        update_data["done_dates"] = [str(d) for d in update_data["done_dates"]]
    if "completed_on_date" in update_data and update_data["completed_on_date"]:
        update_data["completed_on_date"] = str(update_data["completed_on_date"])

    result = db.table("plans").update(update_data).eq("id", plan_id).execute()
    return result.data[0]


@router.delete("/{plan_id}", status_code=204, summary="Soft-delete a plan")
def delete_plan(
    plan_id: str,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    existing = (
        db.table("plans").select("id").eq("id", plan_id).eq("user_id", user_id).execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    db.table("plans").update({"deleted": True}).eq("id", plan_id).execute()
