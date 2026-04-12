from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.routers import auth, habits, logs, plans, settings as settings_router

config = get_settings()

# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="ALTRUIST API",
    description="""
## ALTRUIST — Habit Tracker API

Built with **FastAPI** + **Supabase** (Postgres).

### Authentication
All endpoints (except health check) require a valid **Supabase JWT**.

Pass it in the `Authorization` header:
```
Authorization: Bearer <your-supabase-jwt>
```

The JWT is issued by Supabase Auth after Google OAuth or email/password login.
FastAPI validates it using the `SUPABASE_JWT_SECRET` and extracts the `user_id`.

### Architecture
```
Next.js → FastAPI (JWT auth) → Supabase DB
```

### Phases
- **Phase 1** (current): CRUD for habits, logs, plans, settings
- **Phase 2**: AI coach endpoint (Anthropic API)  
- **Phase 3**: Weekly stats, prompt versioning, evals
    """,
    version="1.0.0",
    contact={"name": "ALTRUIST", "url": "https://github.com/yourname/altruist"},
    openapi_tags=[
        {"name": "Auth",        "description": "User profile and authentication"},
        {"name": "Habits",      "description": "Manage daily habits"},
        {"name": "Daily Logs",  "description": "Log mood, energy, body metrics, notes"},
        {"name": "Plans",       "description": "Planner: once / daily / weekly / daterange tasks"},
        {"name": "Settings",    "description": "User goals and preferences"},
    ],
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(auth.router,         prefix="/api/v1")
app.include_router(habits.router,       prefix="/api/v1")
app.include_router(logs.router,         prefix="/api/v1")
app.include_router(plans.router,        prefix="/api/v1")
app.include_router(settings_router.router, prefix="/api/v1")


# ── Health check ──────────────────────────────────────────────
@app.get("/health", tags=["Health"], summary="Health check")
def health():
    return {"status": "ok", "service": "altruist-api", "version": "1.0.0"}
