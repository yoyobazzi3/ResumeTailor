"""Async database engine and session dependency.

One engine is created at import time and shared across the process.
get_db is a generator — it yields rather than returns so FastAPI can run
cleanup code (closing the session) after the route handler finishes,
even if the handler raises an exception.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)

# expire_on_commit=False prevents SQLAlchemy from expiring loaded attributes after
# a commit, which would force an extra SELECT the next time any field is accessed.
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    """Yield an AsyncSession for the duration of a single request.

    FastAPI resolves this as a dependency and closes the session automatically
    when the response is sent, regardless of whether the route raised an error.

    Yields:
        AsyncSession: A database session scoped to the current request.
    """
    async with AsyncSessionLocal() as session:
        yield session
