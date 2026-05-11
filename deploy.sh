#!/usr/bin/env bash
# deploy.sh — one-command GCP deployment for ResumeTailor
#
# Usage:  ./deploy.sh
# Re-run at any time — all steps are idempotent.
#
# Requirements:
#   - gcloud CLI authenticated (gcloud auth login)
#   - Docker with buildx
#   - .env file with ANTHROPIC_API_KEY and JWT_SECRET

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_ID="munchmate-494821"
REGION="us-central1"
REGISTRY="us-central1-docker.pkg.dev/${PROJECT_ID}/resume-tailor"

DB_INSTANCE="resume-tailor-db"
DB_NAME="resumetailor"
DB_USER="resumetailor"

SERVER_SERVICE="resume-tailor-server"
CLIENT_SERVICE="resume-tailor-client"
MIGRATE_JOB="resume-tailor-migrate"
SECRETS_FILE=".deploy.secrets"

# ── Colours ───────────────────────────────────────────────────────────────────
BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
RESET="\033[0m"

step() { echo -e "\n${BOLD}${CYAN}▶ $*${RESET}"; }
ok()   { echo -e "${GREEN}✓ $*${RESET}"; }
info() { echo -e "${YELLOW}  $*${RESET}"; }

# ── Load / generate secrets ───────────────────────────────────────────────────
step "Loading secrets"

# Source existing DB password if we've deployed before
if [ -f "$SECRETS_FILE" ]; then
  # shellcheck source=/dev/null
  source "$SECRETS_FILE"
  ok "Loaded existing secrets from $SECRETS_FILE"
fi

# Generate DB password on first run
if [ -z "${DB_PASS:-}" ]; then
  DB_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
  echo "DB_PASS=${DB_PASS}" >> "$SECRETS_FILE"
  ok "Generated new DB password (saved to $SECRETS_FILE — keep this file safe!)"
fi

# Read app secrets from .env
if [ ! -f ".env" ]; then
  echo "ERROR: .env file not found. Copy .env.example and fill in the values."
  exit 1
fi

ANTHROPIC_API_KEY=$(grep -E '^ANTHROPIC_API_KEY=' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
JWT_SECRET=$(grep -E '^JWT_SECRET=' .env | cut -d= -f2- | tr -d '"' | tr -d "'")

if [ -z "$ANTHROPIC_API_KEY" ] || [ -z "$JWT_SECRET" ]; then
  echo "ERROR: ANTHROPIC_API_KEY and JWT_SECRET must be set in .env"
  exit 1
fi

ok "Secrets loaded"

# ── Enable GCP APIs ───────────────────────────────────────────────────────────
step "Enabling GCP APIs (this may take a minute on first run)"

gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project="$PROJECT_ID" --quiet

ok "APIs enabled"

# ── Artifact Registry ─────────────────────────────────────────────────────────
step "Setting up Artifact Registry"

gcloud artifacts repositories create resume-tailor \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null || info "Registry already exists — skipping"

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
ok "Artifact Registry ready"

# ── Cloud SQL ─────────────────────────────────────────────────────────────────
step "Setting up Cloud SQL (PostgreSQL 16)"
info "First-time creation takes ~5 minutes — grab a coffee ☕"

if ! gcloud sql instances describe "$DB_INSTANCE" --project="$PROJECT_ID" &>/dev/null; then
  gcloud sql instances create "$DB_INSTANCE" \
    --database-version=POSTGRES_16 \
    --edition=ENTERPRISE \
    --tier=db-f1-micro \
    --region="$REGION" \
    --project="$PROJECT_ID"
  ok "Cloud SQL instance created"
else
  ok "Cloud SQL instance already exists"
fi

# Wait until the instance is RUNNABLE
info "Waiting for Cloud SQL instance to be ready…"
for i in $(seq 1 30); do
  STATE=$(gcloud sql instances describe "$DB_INSTANCE" --project="$PROJECT_ID" --format='value(state)' 2>/dev/null || echo "UNKNOWN")
  if [ "$STATE" = "RUNNABLE" ]; then
    ok "Cloud SQL instance is RUNNABLE"
    break
  fi
  info "State: $STATE — waiting 15s ($i/30)…"
  sleep 15
done

if [ "$STATE" != "RUNNABLE" ]; then
  echo "ERROR: Cloud SQL instance never reached RUNNABLE state. Check GCP console."
  exit 1
fi

# Create database (idempotent)
gcloud sql databases create "$DB_NAME" \
  --instance="$DB_INSTANCE" \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null || info "Database already exists"

# Create user (idempotent — create first, fall back to set-password if already exists)
gcloud sql users create "$DB_USER" \
  --instance="$DB_INSTANCE" \
  --password="$DB_PASS" \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null \
|| gcloud sql users set-password "$DB_USER" \
    --instance="$DB_INSTANCE" \
    --password="$DB_PASS" \
    --project="$PROJECT_ID" \
    --quiet

ok "Database and user ready"

SQL_CONN="${PROJECT_ID}:${REGION}:${DB_INSTANCE}"
DATABASE_URL="postgresql+asyncpg://${DB_USER}:${DB_PASS}@/${DB_NAME}?host=/cloudsql/${SQL_CONN}"

# ── Build & push server image ─────────────────────────────────────────────────
step "Building server image"

docker buildx build \
  --platform linux/amd64 \
  --tag "${REGISTRY}/server:latest" \
  --push \
  ./server

ok "Server image pushed → ${REGISTRY}/server:latest"

# ── Run Alembic migrations ────────────────────────────────────────────────────
step "Running database migrations"

# Create or update the migration job
if gcloud run jobs describe "$MIGRATE_JOB" --region="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  gcloud run jobs update "$MIGRATE_JOB" \
    --image="${REGISTRY}/server:latest" \
    --set-env-vars="DATABASE_URL=${DATABASE_URL},JWT_SECRET=${JWT_SECRET},ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}" \
    --set-cloudsql-instances="$SQL_CONN" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --quiet
else
  gcloud run jobs create "$MIGRATE_JOB" \
    --image="${REGISTRY}/server:latest" \
    --command=alembic \
    --args="upgrade,head" \
    --set-env-vars="DATABASE_URL=${DATABASE_URL},JWT_SECRET=${JWT_SECRET},ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}" \
    --set-cloudsql-instances="$SQL_CONN" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --quiet
fi

gcloud run jobs execute "$MIGRATE_JOB" \
  --wait \
  --region="$REGION" \
  --project="$PROJECT_ID"

ok "Migrations applied"

# ── Deploy backend ────────────────────────────────────────────────────────────
step "Deploying backend to Cloud Run"

gcloud run deploy "$SERVER_SERVICE" \
  --image="${REGISTRY}/server:latest" \
  --platform=managed \
  --region="$REGION" \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --set-env-vars="DATABASE_URL=${DATABASE_URL},JWT_SECRET=${JWT_SECRET},ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}" \
  --set-cloudsql-instances="$SQL_CONN" \
  --project="$PROJECT_ID" \
  --quiet

SERVER_URL=$(gcloud run services describe "$SERVER_SERVICE" \
  --region="$REGION" \
  --format='value(status.url)' \
  --project="$PROJECT_ID")

ok "Backend deployed → $SERVER_URL"

# ── Build & push client image ─────────────────────────────────────────────────
step "Building client image (with backend URL baked in)"
info "API URL: $SERVER_URL"

docker buildx build \
  --platform linux/amd64 \
  --build-arg "VITE_API_URL=${SERVER_URL}" \
  --tag "${REGISTRY}/client:latest" \
  --push \
  --file ./client/Dockerfile.prod \
  ./client

ok "Client image pushed → ${REGISTRY}/client:latest"

# ── Deploy frontend ───────────────────────────────────────────────────────────
step "Deploying frontend to Cloud Run"

gcloud run deploy "$CLIENT_SERVICE" \
  --image="${REGISTRY}/client:latest" \
  --platform=managed \
  --region="$REGION" \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=5 \
  --memory=256Mi \
  --cpu=1 \
  --port=8080 \
  --project="$PROJECT_ID" \
  --quiet

CLIENT_URL=$(gcloud run services describe "$CLIENT_SERVICE" \
  --region="$REGION" \
  --format='value(status.url)' \
  --project="$PROJECT_ID")

ok "Frontend deployed → $CLIENT_URL"

# ── Update backend CORS with frontend URL ────────────────────────────────────
step "Updating backend CORS to allow frontend URL"

gcloud run services update "$SERVER_SERVICE" \
  --update-env-vars="^|^CORS_ORIGINS=http://localhost:5173,http://localhost:5174,${CLIENT_URL}" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --quiet

ok "CORS updated"

# ── Done ──────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}${GREEN}🚀 Deployment complete!${RESET}\n"
echo -e "  ${BOLD}Frontend:${RESET} $CLIENT_URL"
echo -e "  ${BOLD}Backend:${RESET}  $SERVER_URL"
echo -e "  ${BOLD}API docs:${RESET} $SERVER_URL/docs"
echo ""
echo -e "${YELLOW}Keep .deploy.secrets safe — it contains your DB password.${RESET}"
echo -e "${YELLOW}Add it to .gitignore if you haven't already.${RESET}"
