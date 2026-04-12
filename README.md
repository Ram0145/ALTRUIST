# ALTRUIST

Habit tracker — Next.js 14 + FastAPI + Supabase

## Stack

| Layer      | Tech                        |
|------------|-----------------------------|
| Frontend   | Next.js 14 (App Router) + TypeScript + Tailwind |
| Backend    | FastAPI (Python 3.11)       |
| Database   | Supabase (Postgres)         |
| Auth       | Supabase Auth (Google OAuth + Email) |
| Containers | Docker + docker-compose     |
| CI/CD      | GitHub Actions              |

## How auth works

```
User → Supabase Auth (Google/Email) → JWT token
JWT → FastAPI (validates via Supabase secret) → extracts user_id
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
- Create project at https://supabase.com
- Run `supabase/schema.sql` in the SQL editor
- Copy Project URL and anon key

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

See `backend/.env.example` and `frontend/.env.local.example`

## Project structure

```
altruist/
├── frontend/         Next.js app
├── backend/          FastAPI app
├── supabase/         DB schema
├── docker-compose.yml
└── .github/workflows/ CI/CD
```
