# ALTRUIST

Habit tracker — Next.js 14 + FastAPI + Supabase

## Stack

| Layer      | Tech                                                    |
|------------|---------------------------------------------------------|
| Frontend   | Next.js 14 (App Router) + TypeScript + Tailwind         |
| Backend    | FastAPI (Python 3.11)                                   |
| Database   | Supabase (Postgres + RLS)                               |
| Auth       | Supabase Auth (Google OAuth + Email)                    |
| Containers | Docker + docker-compose                                 |
| CI/CD      | GitHub Actions → Vercel (frontend) + Docker Hub (backend) |

## Current Status

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1** | Full-stack scaffold: CRUD for habits, logs, plans, settings + auth + Docker + CI/CD | ✅ Complete |
| **Phase 2** | AI coach endpoint (Anthropic API) | 🔜 Next |
| **Phase 3** | Weekly stats, prompt versioning, evals, AI-powered daily quote | 🔜 Planned |

## How auth works

```
User → Supabase Auth (Google/Email) → JWT token
JWT → FastAPI (validates via SUPABASE_JWT_SECRET) → extracts user_id
FastAPI → Supabase DB (queries by user_id) → returns JSON
Next.js → renders data
```

## Local setup

### 1. Clone and install
```bash
git clone https://github.com/yourname/altruist
cd altruist
```

### 2. Supabase
- Create a project at https://supabase.com
- Run `supabase/schema.sql` in the SQL Editor
- Copy your Project URL and anon key

### 3. Backend
```bash
cd backend
cp .env.example .env          # fill in your Supabase values
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Swagger docs → http://localhost:8000/docs

### 4. Frontend
```bash
cd frontend
cp .env.local.example .env.local   # fill in values
npm install
npm run dev
```
App → http://localhost:3000

### 5. Docker (everything together)
```bash
docker-compose up --build
```

## Environment variables

### Backend — `backend/.env`
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (server-side only) |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase → Settings → API |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (e.g. `http://localhost:3000`) |
| `APP_ENV` | `development` or `production` |
| `SECRET_KEY` | App secret key (change in prod) |

### Frontend — `frontend/.env.local`
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe for browser) |
| `NEXT_PUBLIC_API_URL` | FastAPI base URL (e.g. `http://localhost:8000/api/v1`) |

## CI/CD setup

The GitHub Actions workflow (`.github/workflows/deploy.yml`) runs on every push to `main`.

**Pipeline stages:**
1. `backend-check` — installs deps, dry-imports the FastAPI app
2. `frontend-check` — type-check (`tsc --noEmit`) + ESLint
3. `deploy` — only runs if both checks pass and the push is to `main`

**Required GitHub Secrets** (Settings → Secrets → Actions):
| Secret | Used for |
|--------|----------|
| `VERCEL_TOKEN` | Deploy frontend to Vercel |
| `VERCEL_ORG_ID` | Vercel org identifier |
| `VERCEL_PROJECT_ID` | Vercel project identifier |
| `DOCKERHUB_USERNAME` | Push backend image to Docker Hub |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `RAILWAY_TOKEN` | (Optional) Deploy backend to Railway |
| `RENDER_DEPLOY_HOOK` | (Optional) Deploy backend to Render via webhook |

Uncomment the Railway or Render step in `deploy.yml` depending on which platform you use for the backend.

## Project structure

```
altruist/
├── frontend/
│   ├── app/
│   │   ├── auth/login/page.tsx     # Login page (Supabase Auth)
│   │   ├── dashboard/page.tsx      # Dashboard with auth guard
│   │   ├── layout.tsx              # Root layout
│   │   └── page.tsx                # Root redirect
│   ├── components/
│   │   └── dashboard/
│   │       └── AltruistApp.tsx     # Main dashboard UI (charts, habits, plans, logs)
│   ├── lib/
│   │   ├── api.ts                  # FastAPI client (habits, logs, plans, settings)
│   │   └── supabase.ts             # Supabase browser client
│   ├── Dockerfile
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app + CORS + router registration
│   │   ├── database.py             # Supabase client dependency
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic settings (env vars)
│   │   │   └── security.py         # JWT validation → get_current_user_id
│   │   ├── routers/
│   │   │   ├── auth.py             # /auth — profile endpoints
│   │   │   ├── habits.py           # /habits — CRUD
│   │   │   ├── logs.py             # /logs — daily mood/metrics
│   │   │   ├── plans.py            # /plans — once/daily/weekly/daterange
│   │   │   └── settings.py         # /settings — user goals
│   │   └── schemas/
│   │       └── schemas.py          # Pydantic request/response models
│   ├── Dockerfile
│   └── requirements.txt
│
├── supabase/
│   └── schema.sql                  # Full DB schema + RLS + triggers + indexes
│
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD: lint → type-check → deploy
│
└── docker-compose.yml              # Local dev: backend + frontend together
```

## API overview

All endpoints require `Authorization: Bearer <supabase-jwt>` except `/health`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET/PATCH | `/api/v1/auth/me` | Get / update user profile |
| GET/POST | `/api/v1/habits` | List / create habits |
| PATCH/DELETE | `/api/v1/habits/{id}` | Update / soft-delete habit |
| GET/PUT | `/api/v1/logs/{date}` | Get / upsert daily log |
| GET/POST | `/api/v1/plans` | List / create plans |
| PATCH/DELETE | `/api/v1/plans/{id}` | Update / delete plan |
| GET/PUT | `/api/v1/settings` | Get / upsert user settings |

Full interactive docs → http://localhost:8000/docs (Swagger UI)

## Database schema

Five user-owned tables, all protected by Row Level Security:

- **profiles** — extends `auth.users`, auto-created on signup via trigger
- **habits** — trackable daily behaviors (soft-deleted with `active = false`)
- **daily_logs** — mood (1–5), energy/productivity (1–10), calories, steps, workout, screen time, gratitude, notes
- **habit_checks** — one row per habit per day (`done` boolean + optional skip reason)
- **plans** — tasks with recurrence: `once | daily | weekly | daterange`
- **settings** — per-user goals (calorie target, steps goal, screen time limit)
