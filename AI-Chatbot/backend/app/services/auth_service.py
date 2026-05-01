"""
Auth service — email/password and Google OAuth logic.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: uuid.UUID, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])


async def register_user(db: AsyncSession, email: str, password: str, full_name: Optional[str] = None) -> User:
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise ValueError("A user with this email already exists.")

    user = User(
        id=uuid.uuid4(),
        email=email,
        hashed_password=_hash_password(password),
        full_name=full_name,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password:
        return None
    if not _verify_password(password, user.hashed_password):
        return None
    return user


async def get_or_create_google_user(
    db: AsyncSession,
    google_id: str,
    email: str,
    full_name: Optional[str],
    avatar_url: Optional[str],
) -> User:
    """Account linking: link Google ID to existing email account, or create a new one."""
    # Check for existing user by email first
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        # Link Google ID to existing account if not already set
        if not user.google_id:
            user.google_id = google_id
        return user

    # Create new Google-only account
    user = User(
        id=uuid.uuid4(),
        email=email,
        google_id=google_id,
        full_name=full_name,
        avatar_url=avatar_url,
        hashed_password=None,
    )
    db.add(user)
    await db.flush()
    return user


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
