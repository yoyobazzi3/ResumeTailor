"""Authentication helpers: password hashing and JWT creation.

Kept intentionally small — these are pure functions with no DB access.
All database interaction happens in the auth router so the service layer
stays testable without a live database.
"""

from datetime import datetime, timedelta, timezone
from jose import jwt
from passlib.context import CryptContext
from app.config import settings

# CryptContext abstracts the hashing algorithm so it can be swapped later
# without touching call sites. deprecated="auto" ensures old hashes are
# automatically re-hashed on next login if the scheme changes.
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Return a bcrypt hash of the given plaintext password.

    Args:
        password: The plaintext password to hash.

    Returns:
        A bcrypt hash string safe to store in the database.
    """
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Check whether a plaintext password matches a stored bcrypt hash.

    Args:
        plain: The password submitted by the user.
        hashed: The stored hash from the database.

    Returns:
        True if the password matches, False otherwise.
    """
    return _pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    """Create a signed JWT containing the given payload plus an expiry claim.

    Args:
        data: Dict of claims to embed. Callers pass {"sub": str(user.id)}.

    Returns:
        A signed HS256 JWT string ready to be returned to the client.
    """
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    # "exp" is the standard JWT expiry claim; python-jose validates it automatically on decode.
    payload["exp"] = expire
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
