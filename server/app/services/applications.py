"""Business logic for job application CRUD operations.

Routers call these functions directly. Keeping logic here rather than in routers
makes it straightforward to test without spinning up an HTTP server.
"""

import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.application import Application
from app.models.status_history import StatusHistory
from app.schemas.application import ApplicationCreate, ApplicationUpdate


async def get_all(db: AsyncSession, user_id: uuid.UUID) -> list[Application]:
    """Return all applications owned by the given user, newest first.

    Args:
        db: The active database session.
        user_id: UUID of the authenticated user.

    Returns:
        List of Application ORM instances, ordered by created_at descending.
    """
    result = await db.execute(
        select(Application)
        .where(Application.user_id == user_id)
        .order_by(Application.created_at.desc())
    )
    return list(result.scalars().all())


async def get_one(db: AsyncSession, user_id: uuid.UUID, application_id: uuid.UUID) -> Application:
    """Return a single application with its status history eagerly loaded.

    user_id is included in the WHERE clause so one user can never read
    another user's application by guessing an ID.

    Args:
        db: The active database session.
        user_id: UUID of the authenticated user.
        application_id: UUID of the requested application.

    Returns:
        Application ORM instance with status_history sorted chronologically.

    Raises:
        HTTPException: 404 if the application does not exist or belongs to a different user.
    """
    result = await db.execute(
        select(Application)
        # selectinload issues a second query for status_history instead of a JOIN,
        # which avoids duplicate Application rows when multiple history entries exist.
        .options(selectinload(Application.status_history))
        .where(
            Application.id == application_id,
            Application.user_id == user_id,
        )
    )
    app = result.scalar_one_or_none()
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    # Sort in Python rather than SQL because selectinload does not support ORDER BY on relationships.
    app.status_history.sort(key=lambda h: h.changed_at)
    return app


async def create(db: AsyncSession, user_id: uuid.UUID, payload: ApplicationCreate) -> Application:
    """Insert a new application and record its initial status in status_history.

    The initial status_history row is written here rather than via a DB trigger
    so the history is always in sync regardless of the database being used.
    flush() is called before adding the history row so app.id is available
    without committing the transaction first.

    Args:
        db: The active database session.
        user_id: UUID of the authenticated user creating the application.
        payload: Validated request body containing application fields.

    Returns:
        The newly created Application ORM instance.
    """
    app = Application(user_id=user_id, **payload.model_dump())
    db.add(app)
    # flush writes the INSERT to the DB within the current transaction so app.id
    # is populated by the DB, but does not commit — both rows land in one transaction.
    await db.flush()

    # Record the initial status so the timeline starts from day one.
    history = StatusHistory(application_id=app.id, status=app.status)
    db.add(history)

    await db.commit()
    await db.refresh(app)
    return app


async def update(
    db: AsyncSession, user_id: uuid.UUID, application_id: uuid.UUID, payload: ApplicationUpdate
) -> Application:
    """Apply a partial update to an application and log status changes.

    Only fields explicitly included in the request body are updated;
    exclude_unset=True on model_dump() is what makes PATCH semantics work correctly.

    Args:
        db: The active database session.
        user_id: UUID of the authenticated user.
        application_id: UUID of the application to update.
        payload: Partial update body; unset fields are left unchanged.

    Returns:
        The updated Application ORM instance.

    Raises:
        HTTPException: 404 if the application does not exist or belongs to a different user.
    """
    app = await get_one(db, user_id, application_id)

    # exclude_unset=True ensures fields omitted from the request body don't overwrite
    # existing DB values with None.
    changes = payload.model_dump(exclude_unset=True)
    status_changed = "status" in changes and changes["status"] != app.status

    for field, value in changes.items():
        setattr(app, field, value)

    if status_changed:
        # Append a new history row on every status transition, not just creation.
        db.add(StatusHistory(application_id=app.id, status=changes["status"]))

    await db.commit()
    await db.refresh(app)
    return app


async def delete(db: AsyncSession, user_id: uuid.UUID, application_id: uuid.UUID) -> None:
    """Delete an application and all its related rows.

    Related status_history and tailored_resumes rows are removed automatically
    via CASCADE constraints defined on the foreign keys.

    Args:
        db: The active database session.
        user_id: UUID of the authenticated user.
        application_id: UUID of the application to delete.

    Raises:
        HTTPException: 404 if the application does not exist or belongs to a different user.
    """
    app = await get_one(db, user_id, application_id)
    await db.delete(app)
    await db.commit()
