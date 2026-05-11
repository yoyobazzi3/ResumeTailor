# JobLens — AI Job Application Tracker

A full-stack application that tracks job applications and uses AI to tailor your resume bullet points to match any job description, with a keyword match score.

---

## What This Project Demonstrates

- Full-stack architecture (React + FastAPI + PostgreSQL)
- LLM integration with structured prompt engineering (not just a chatbot)
- JWT-based authentication with protected routes
- RESTful API design with automatic OpenAPI docs (free with FastAPI)
- Pydantic data validation on every request and response
- Docker-based local development and deployment
- Semantic keyword extraction and scoring logic

---

## Tech Stack

| Layer | Tech | Why |
|---|---|---|
| Frontend | React + TypeScript + Tailwind | Type safety, clean UI |
| Backend | Python + FastAPI | Async, typed, auto-docs, first-class Anthropic SDK |
| Validation | Pydantic v2 | Request/response schemas with zero extra code |
| Database | PostgreSQL + asyncpg | Async queries, relational structure |
| ORM | SQLAlchemy 2.0 (async) | Clean models, migration-ready |
| Migrations | Alembic | Version-controlled schema changes |
| AI | Anthropic Python SDK (claude-sonnet-4-20250514) | Resume tailoring + match scoring |
| Auth | python-jose (JWT) + passlib + bcrypt | Stateless, industry standard |
| Containerization | Docker + Docker Compose | One-command local setup |
| Deployment | Railway or Render (backend) + Vercel (frontend) | Free tier, easy CI/CD |

---

## Core Features

### Phase 1 — Foundation (Week 1-2)

- User registration and login with JWT
- Dashboard to view all applications
- Add a job application manually (company, role, URL, status, date applied, notes)
- Kanban or table view with status columns: Saved, Applied, Phone Screen, Technical, Offer, Rejected

### Phase 2 — AI Integration (Week 2-3)

- Paste your base resume bullet points into a profile section
- Paste a job description into any application
- Hit "Tailor Resume" — the app calls Claude to:
  - Rewrite your bullets to match the job's language and keywords
  - Return a match score (0-100) based on keyword overlap between JD and your resume
  - Highlight which keywords are missing from your original resume
- Display original vs tailored bullets side by side
- One-click copy for tailored bullets

### Phase 3 — Polish (Week 3-4)

- Save multiple tailored versions per application
- Application timeline view (track status changes over time)
- Stats dashboard: total applied, response rate, avg match score
- Export tailored resume section as plain text

---

## Project Structure

```
joblens/
├── client/                        # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ApplicationCard.tsx
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── ResumeEditor.tsx
│   │   │   └── MatchScoreWidget.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ApplicationDetail.tsx
│   │   │   ├── Login.tsx
│   │   │   └── Profile.tsx
│   │   ├── hooks/
│   │   │   ├── useApplications.ts
│   │   │   └── useAuth.ts
│   │   └── lib/
│   │       └── api.ts             # Axios instance with auth header
│
├── server/                        # FastAPI backend
│   ├── app/
│   │   ├── main.py                # FastAPI app init, router registration, CORS
│   │   ├── config.py              # Settings via pydantic-settings (.env loading)
│   │   ├── database.py            # Async SQLAlchemy engine + session dependency
│   │   │
│   │   ├── models/                # SQLAlchemy ORM models (one file per table)
│   │   │   ├── user.py
│   │   │   ├── application.py
│   │   │   ├── resume.py
│   │   │   └── status_history.py
│   │   │
│   │   ├── schemas/               # Pydantic request/response schemas
│   │   │   ├── auth.py
│   │   │   ├── application.py
│   │   │   └── resume.py
│   │   │
│   │   ├── routers/               # Route handlers (thin — logic lives in services)
│   │   │   ├── auth.py
│   │   │   ├── applications.py
│   │   │   └── resume.py
│   │   │
│   │   ├── services/              # Business logic
│   │   │   ├── auth.py            # Token creation, password hashing
│   │   │   ├── applications.py    # CRUD logic
│   │   │   └── claude.py          # All Anthropic API calls live here
│   │   │
│   │   └── dependencies/
│   │       └── auth.py            # get_current_user dependency injected into routes
│   │
│   ├── alembic/                   # Database migrations
│   │   ├── versions/
│   │   └── env.py
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── BLUEPRINT.md                   # This file
```

---

## Database Schema

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Base resume bullets (user's master resume)
CREATE TABLE resume_bullets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT,              -- e.g. "GoFundMe", "MunchMate", "Skills"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job applications
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  job_url TEXT,
  job_description TEXT,
  status TEXT DEFAULT 'saved', -- saved | applied | phone_screen | technical | offer | rejected
  match_score INTEGER,         -- 0-100, populated after AI analysis
  notes TEXT,
  applied_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tailored resume versions per application
CREATE TABLE tailored_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  original_bullets JSONB NOT NULL,
  tailored_bullets JSONB NOT NULL,
  missing_keywords TEXT[],
  match_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Application status history
CREATE TABLE status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Routes

FastAPI auto-generates interactive docs at `/docs` (Swagger) and `/redoc`. No extra work required.

```
POST   /api/auth/register
POST   /api/auth/login

GET    /api/applications
POST   /api/applications
GET    /api/applications/{id}
PATCH  /api/applications/{id}
DELETE /api/applications/{id}

GET    /api/resume/bullets
POST   /api/resume/bullets
DELETE /api/resume/bullets/{id}

POST   /api/resume/tailor              # Takes application_id, calls Claude, stores result
GET    /api/resume/tailored/{application_id}
```

---

## Pydantic Schemas (schemas/application.py)

Pydantic validates every request body and shapes every response automatically. Define schemas separately from ORM models.

```python
from pydantic import BaseModel, UUID4
from typing import Optional
from datetime import date, datetime

class ApplicationCreate(BaseModel):
    company: str
    role: str
    job_url: Optional[str] = None
    job_description: Optional[str] = None
    status: str = "saved"
    notes: Optional[str] = None
    applied_at: Optional[date] = None

class ApplicationUpdate(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    job_description: Optional[str] = None
    notes: Optional[str] = None
    match_score: Optional[int] = None

class ApplicationResponse(BaseModel):
    id: UUID4
    company: str
    role: str
    status: str
    match_score: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}  # Lets Pydantic read SQLAlchemy models directly
```

---

## FastAPI Route Pattern (routers/applications.py)

Keep routers thin. All DB and business logic goes into services.

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.schemas.application import ApplicationCreate, ApplicationResponse
from app.services import applications as app_service

router = APIRouter(prefix="/api/applications", tags=["applications"])

@router.get("/", response_model=list[ApplicationResponse])
async def list_applications(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await app_service.get_all(db, current_user.id)

@router.post("/", response_model=ApplicationResponse, status_code=201)
async def create_application(
    payload: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await app_service.create(db, current_user.id, payload)
```

---

## AI Service Design (services/claude.py)

All Anthropic API calls live in one file. Two async functions.

### tailor_resume(bullets, job_description)

Prompt strategy: tell the model to act as a senior technical recruiter. Give it the job description and the user's bullet points. Ask it to return JSON only with this shape:

```json
{
  "tailored_bullets": ["string", "..."],
  "missing_keywords": ["string", "..."],
  "match_score": 72,
  "reasoning": "string"
}
```

Key prompt rules:
- Preserve quantified achievements (numbers, percentages) from the originals
- Mirror the language in the job description, do not invent new claims
- Return exactly as many bullets as were provided
- JSON only, no markdown fences

```python
import anthropic
import json
from app.config import settings

client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

async def tailor_resume(bullets: list[str], job_description: str) -> dict:
    prompt = f"""You are a senior technical recruiter. Rewrite the resume bullets below to better match the job description.

Rules:
- Preserve all numbers, percentages, and quantified achievements exactly
- Mirror the language and keywords from the job description
- Do not invent or exaggerate claims
- Return exactly {len(bullets)} tailored bullets
- Respond with JSON only, no markdown, no explanation

Job Description:
{job_description}

Resume Bullets:
{json.dumps(bullets)}

Return this exact JSON shape:
{{
  "tailored_bullets": [...],
  "missing_keywords": [...],
  "match_score": <integer 0-100>,
  "reasoning": "<one sentence>"
}}"""

    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )

    return json.loads(message.content[0].text)


async def calculate_match_score(bullets: list[str], job_description: str) -> int:
    prompt = f"""Score how well these resume bullets match this job description.
Return a single JSON object: {{"match_score": <integer 0-100>}}
No explanation, no markdown.

Job Description: {job_description}
Bullets: {json.dumps(bullets)}"""

    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=64,
        messages=[{"role": "user", "content": prompt}]
    )

    return json.loads(message.content[0].text)["match_score"]
```

---

## requirements.txt

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy[asyncio]==2.0.36
asyncpg==0.29.0
alembic==1.13.3
pydantic==2.9.2
pydantic-settings==2.6.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
anthropic==0.40.0
python-multipart==0.0.12
```

---

## docker-compose.yml

```yaml
version: "3.9"
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: joblens
      POSTGRES_PASSWORD: joblens
      POSTGRES_DB: joblens
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U joblens"]
      interval: 5s
      retries: 5

  server:
    build: ./server
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://joblens:joblens@db:5432/joblens
      JWT_SECRET: your_secret_here
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on:
      db:
        condition: service_healthy
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  client:
    build: ./client
    ports:
      - "5173:5173"
    depends_on:
      - server

volumes:
  postgres_data:
```

---

## .env.example

```
DATABASE_URL=postgresql+asyncpg://joblens:joblens@localhost:5432/joblens
JWT_SECRET=change_this_to_a_long_random_string
ANTHROPIC_API_KEY=your_key_here
```

---

## config.py (pydantic-settings)

FastAPI's recommended way to load environment variables — typed, validated, no manual os.getenv calls.

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    anthropic_api_key: str
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## Build Order (recommended for Cursor/Claude)

Follow this order to avoid building on unstable ground:

1. Set up Docker Compose — get PostgreSQL healthy before touching Python
2. Scaffold FastAPI app: main.py, config.py, database.py with async session
3. Write SQLAlchemy models and run first Alembic migration to create tables
4. Build auth: register + login routes, password hashing, JWT creation and verification
5. Build the get_current_user dependency — this protects every route after this point
6. Build application CRUD routes + service layer, test with /docs
7. Build resume bullets CRUD routes + service layer
8. Build services/claude.py — test both functions with a standalone script before wiring to routes
9. Wire POST /api/resume/tailor to the Claude service, store result in tailored_resumes
10. Build the React client: auth context, login/register pages, protected route wrapper
11. Build Dashboard with application list and add-application form
12. Build ApplicationDetail page with job description input and "Tailor Resume" button
13. Build side-by-side original vs tailored bullets view with match score display
14. Add Kanban board view as upgrade to Dashboard table view
15. Add stats (response rate, avg score) to Dashboard header
16. Write README with setup instructions and a demo GIF

---

## What to Highlight on Your Resume

"Built a full-stack job application tracker with AI resume tailoring — engineered structured Claude prompts to rewrite resume bullets matching job description language and return keyword gap analysis with a semantic match score. React + TypeScript frontend, FastAPI backend with async PostgreSQL, Pydantic validation, JWT auth, Docker."

That sentence covers: LLM prompt engineering, full-stack, type safety on both ends, async Python, real database design, auth, and containerization. Every word is defensible in an interview because you built each layer.

---

## Stretch Goals (if you have time)

- Chrome extension that auto-extracts job descriptions from LinkedIn/Greenhouse pages
- Email parsing via Gmail API to auto-update application status from recruiter replies
- Side-by-side diff view showing exactly which words changed between original and tailored
- Public shareable link for a single tailored resume version (no auth required to view)
- Background task with FastAPI BackgroundTasks to auto-score new applications on creation
