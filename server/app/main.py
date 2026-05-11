"""Application entry point.

Creates the FastAPI app, configures CORS, and registers all routers.
Nothing else belongs here — keep this file as a wiring layer only.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.routers import auth as auth_router
from app.routers import applications as applications_router
from app.routers import resume as resume_router

app = FastAPI(title="JobLens API")

# Parse comma-separated origins from config (supports local dev + production Cloud Run URL).
_ALLOWED_CORS_ORIGINS = frozenset(o.strip() for o in settings.cors_origins.split(",") if o.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_ALLOWED_CORS_ORIGINS),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _cors_headers_for_request(request: Request) -> dict[str, str]:
    """Mirror CORSMiddleware so JSON error responses from the global handler are browser-readable."""
    origin = request.headers.get("origin") or ""
    if origin not in _ALLOWED_CORS_ORIGINS:
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
    }


# Unhandled exceptions bypass CORSMiddleware's response wrapper, so the browser reports
# a CORS failure on 500. Attach the same allowlist headers here explicitly.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=_cors_headers_for_request(request),
    )

app.include_router(auth_router.router)
app.include_router(applications_router.router)
app.include_router(resume_router.router)


@app.get("/health")
async def health():
    """Liveness check used by Docker Compose healthcheck and uptime monitors."""
    return {"status": "ok"}
