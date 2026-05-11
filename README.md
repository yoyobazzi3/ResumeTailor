# JobLens

A full-stack job application tracker that uses Claude to rewrite your resume bullets to match any job description, returning tailored bullets, a keyword gap analysis, and a match score.

---

## Features

- **Job application tracking** — add applications with company, role, URL, status, and notes
- **Status management** — move applications through Saved, Applied, Phone Screen, Technical, Offer, and Rejected
- **Dashboard filtering** — filter the application list by status with one click
- **Stats bar** — total applications, response rate, average AI match score, and active count computed from your data
- **AI resume tailoring** — paste a job description, click Tailor Resume, and Claude rewrites your bullets to match the JD's language while preserving every number and quantified achievement
- **Keyword gap analysis** — Claude identifies keywords present in the JD but missing from your bullets
- **Match scoring** — 0–100 score reflecting how well your bullets align with the role
- **Status timeline** — every status change on an application is logged with a timestamp

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | Python + FastAPI |
| Validation | Pydantic v2 |
| Database | PostgreSQL + asyncpg |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| AI | Anthropic Python SDK (`claude-sonnet-4-6`) |
| Auth | python-jose (JWT) + passlib + bcrypt |
| Containerization | Docker + Docker Compose |

---

## Getting Started

**Prerequisites:** Docker, Node.js 20+, Python 3.12+

### 1. Clone the repo

```bash
git clone https://github.com/your-username/joblens.git
cd joblens
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the three values (see [Environment Variables](#environment-variables) below).

### 3. Start PostgreSQL

```bash
docker compose up -d db
```

### 4. Install server dependencies and run migrations

```bash
cd server
pip install -r requirements.txt
alembic upgrade head
```

### 5. Start the backend

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`. Interactive docs are at `http://localhost:8000/docs`.

### 6. Start the frontend

In a separate terminal:

```bash
cd client
npm install
npm run dev
```

### 7. Open the app

```
http://localhost:5173
```

---

## Usage

1. **Register** at `/register` and navigate to **Resume Bullets** in the nav
2. Add your existing resume bullet points — these are your master bullets that Claude rewrites per application
3. Go to **Dashboard** and click **+ Add** to create a job application
4. Open the application and paste the full job description into the text area (it saves on blur)
5. Click **Tailor Resume** — Claude rewrites your bullets in ~5 seconds and returns:
   - Tailored bullets that mirror the JD's language
   - A match score (0–100)
   - Keywords in the JD that are missing from your original bullets
   - A one-sentence reasoning summary
6. Hover any tailored bullet to copy it, or click **Export all** to copy all bullets as plain text
7. Update the application status as you move through the interview process — each change is logged in the status timeline

---

## Project Structure

```
joblens/
├── client/                        # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ApplicationCard.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── Skeleton.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ApplicationDetail.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Profile.tsx
│   │   │   └── NotFound.tsx
│   │   ├── store/
│   │   │   └── authStore.ts       # Zustand auth state
│   │   └── lib/
│   │       └── api.ts             # Axios instance with auth header
│
├── server/                        # FastAPI backend
│   ├── app/
│   │   ├── main.py                # App init, CORS, router registration
│   │   ├── config.py              # pydantic-settings env loading
│   │   ├── database.py            # Async SQLAlchemy engine + session
│   │   ├── models/                # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── application.py
│   │   │   ├── resume.py
│   │   │   └── status_history.py
│   │   ├── schemas/               # Pydantic request/response schemas
│   │   │   ├── auth.py
│   │   │   ├── application.py
│   │   │   └── resume.py
│   │   ├── routers/               # Route handlers (thin layer)
│   │   │   ├── auth.py
│   │   │   ├── applications.py
│   │   │   └── resume.py
│   │   ├── services/              # Business logic
│   │   │   ├── auth.py
│   │   │   ├── applications.py
│   │   │   └── claude.py          # All Anthropic API calls
│   │   └── dependencies/
│   │       └── auth.py            # get_current_user dependency
│   ├── alembic/                   # Database migrations
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## How It Works

The AI tailoring feature lives entirely in `server/app/services/claude.py`.

**What gets sent to Claude:**

- The user's resume bullet points (plain text list)
- The full job description (pasted by the user)

**What Claude returns (structured JSON):**

```json
{
  "tailored_bullets": ["..."],
  "missing_keywords": ["..."],
  "match_score": 72,
  "reasoning": "one sentence explanation"
}
```

**How the prompt is structured:**

The model is instructed to act as a senior technical recruiter and follow four hard rules:

1. Preserve every number, percentage, and quantified achievement exactly as written — no rounding, no inventing
2. Mirror the language and keywords from the job description — if the JD says "high-throughput pipelines", the bullets say "high-throughput pipelines"
3. Return exactly as many bullets as were provided — no collapsing or expanding
4. Respond with JSON only — no markdown fences, no explanation outside the JSON object

The match score is a semantic assessment of keyword overlap and conceptual alignment, not a simple string match. Missing keywords are terms that appear meaningfully in the JD but are absent from the original bullets, giving the user a concrete list of gaps to address.

---

## Environment Variables

| Variable | Description | How to get it |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Set automatically by Docker Compose locally: `postgresql+asyncpg://joblens:joblens@localhost:5432/joblens` |
| `JWT_SECRET` | Secret used to sign and verify auth tokens | Any long random string — run `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | API key for Claude | Get from [console.anthropic.com](https://console.anthropic.com) |

---

## Contributing

1. Fork the repo and create a branch from `main`
2. Make your changes with clear, focused commits
3. Open a pull request with a description of what changed and why
4. Keep PRs small — one concern per PR

---

## License

MIT
