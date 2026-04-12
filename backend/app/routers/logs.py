from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import date
from app.core.security import get_current_user_id
from app.database import get_supabase
from app.schemas.schemas import DailyLogUpsert, DailyLogOut, HabitCheckUpsert, HabitCheckOut

router = APIRouter(prefix="/logs", tags=["Daily Logs"])


@router.get("/", response_model=List[DailyLogOut], summary="Get logs (optionally filtered by date range)")
def get_logs(
    from_date: date = None,
    to_date: date = None,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    query = db.table("daily_logs").select("*").eq("user_id", user_id)
    if from_date:
        query = query.gte("date", str(from_date))
    if to_date:
        query = query.lte("date", str(to_date))
    result = query.order("date", desc=True).execute()
    return result.data


@router.get("/{log_date}", response_model=DailyLogOut, summary="Get log for a specific date")
def get_log(
    log_date: date,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    result = (
        db.table("daily_logs")
        .select("*")
        .eq("user_id", user_id)
        .eq("date", str(log_date))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Log not found")
    return result.data[0]


@router.put("/{log_date}", response_model=DailyLogOut, summary="Upsert (create or update) a daily log")
def upsert_log(
    log_date: date,
    payload: DailyLogUpsert,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    data = {**payload.model_dump(exclude_none=True), "user_id": user_id, "date": str(log_date)}
    result = db.table("daily_logs").upsert(data, on_conflict="user_id,date").execute()
    return result.data[0]


# ── HABIT CHECKS ──────────────────────────────────────────────

@router.get("/{log_date}/habits", response_model=List[HabitCheckOut], summary="Get habit checks for a date")
def get_habit_checks(
    log_date: date,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    result = (
        db.table("habit_checks")
        .select("habit_id, date, done, reason")
        .eq("user_id", user_id)
        .eq("date", str(log_date))
        .execute()
    )
    return result.data


@router.put("/{log_date}/habits", response_model=HabitCheckOut, summary="Upsert a habit check")
def upsert_habit_check(
    log_date: date,
    payload: HabitCheckUpsert,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    data = {
        "user_id": user_id,
        "habit_id": payload.habit_id,
        "date": str(log_date),
        "done": payload.done,
        "reason": payload.reason,
    }
    result = db.table("habit_checks").upsert(data, on_conflict="user_id,habit_id,date").execute()
    return result.data[0]


@router.get("/range/weekly", summary="Get last 7 days of logs + habit checks for stats")
def get_weekly(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_supabase),
):
    """Used by AI stats coach in Phase 3."""
    from datetime import timedelta
    today = date.today()
    week_ago = today - timedelta(days=6)

    logs = (
        db.table("daily_logs").select("*")
        .eq("user_id", user_id)
        .gte("date", str(week_ago))
        .lte("date", str(today))
        .execute()
    )
    checks = (
        db.table("habit_checks").select("*")
        .eq("user_id", user_id)
        .gte("date", str(week_ago))
        .lte("date", str(today))
        .execute()
    )
    return {"logs": logs.data, "habit_checks": checks.data, "from": str(week_ago), "to": str(today)}
