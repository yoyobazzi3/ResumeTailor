"""FastAPI dependency for authenticating the current request.

get_current_user is implemented as a dependency rather than middleware because
FastAPI's dependency injection system handles it more cleanly for per-route
protection: routes that don't need auth simply don't declare the dependency,
and routes that do get the User object injected directly — no request parsing
in the route body. Middleware would run for every request unconditionally and
would require passing the user through some side channel (request.state).
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models.user import User

# HTTPBearer extracts the token from "Authorization: Bearer <token>" and rejects
# requests that are missing the header before our code runs.
_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Decode the Bearer token and return the authenticated User.

    Two failure modes both raise 401 to avoid leaking whether the token is
    malformed vs. the user has been deleted: an attacker learns nothing either way.

    Args:
        credentials: Extracted by HTTPBearer from the Authorization header.
        db: Injected database session used to look up the user record.

    Returns:
        The User ORM instance corresponding to the token's subject claim.

    Raises:
        HTTPException: 401 if the token is missing, expired, malformed, or
            references a user that no longer exists in the database.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        # WWW-Authenticate header is required by RFC 6750 for Bearer token 401 responses.
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials, settings.jwt_secret, algorithms=["HS256"]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user
