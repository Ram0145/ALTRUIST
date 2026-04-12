from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
from enum import Enum


# ── HABITS ────────────────────────────────────────────────────

class HabitCreate(BaseModel):
    name: str
    icon: str = "◎"
    position: int = 0

class HabitUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    position: Optional[int] = None
    active: Optional[bool] = None

class HabitOut(BaseModel):
    id: str
    name: str
    icon: str
    position: int
    active: bool


# ── HABIT CHECKS ──────────────────────────────────────────────

class HabitCheckUpsert(BaseModel):
    habit_id: str
    date: date
    done: bool
    reason: Optional[str] = None

class HabitCheckOut(BaseModel):
    habit_id: str
    date: date
    done: bool
    reason: Optional[str] = None


# ── DAILY LOG ─────────────────────────────────────────────────

class DailyLogUpsert(BaseModel):
    date: date
    mood: Optional[int] = Field(None, ge=1, le=5)
    energy: Optional[int] = Field(None, ge=1, le=10)
    productivity: Optional[int] = Field(None, ge=1, le=10)
    calories: Optional[int] = None
    steps: Optional[int] = None
    workout_mins: Optional[int] = None
    screen_hours: Optional[float] = None
    gratitude: Optional[List[str]] = None
    notes: Optional[str] = None

class DailyLogOut(DailyLogUpsert):
    id: str


# ── PLANS ─────────────────────────────────────────────────────

class PlanRecurrence(str, Enum):
    once      = "once"
    daily     = "daily"
    weekly    = "weekly"
    daterange = "daterange"

class PlanCreate(BaseModel):
    text: str
    recurrence: PlanRecurrence = PlanRecurrence.once
    start_date: date
    end_date: Optional[date] = None
    weekdays: List[int] = []

class PlanUpdate(BaseModel):
    done_dates: Optional[List[date]] = None
    completed_on_date: Optional[date] = None
    deleted: Optional[bool] = None

class PlanOut(BaseModel):
    id: str
    text: str
    recurrence: PlanRecurrence
    start_date: date
    end_date: Optional[date] = None
    weekdays: List[int]
    done_dates: List[date]
    completed_on_date: Optional[date] = None
    deleted: bool


# ── SETTINGS ──────────────────────────────────────────────────

class SettingsUpsert(BaseModel):
    calorie_goal: Optional[int] = 2050
    steps_goal: Optional[int] = 8000
    screen_time_limit: Optional[float] = 3.0

class SettingsOut(SettingsUpsert):
    pass


# ── PROFILE ───────────────────────────────────────────────────

class ProfileOut(BaseModel):
    id: str
    name: Optional[str]
    email: str
