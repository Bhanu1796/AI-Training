"""
Unit tests for auth_service.
"""
import pytest

from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    decode_access_token,
    register_user,
)


@pytest.mark.asyncio
async def test_register_and_authenticate(db):
    user = await register_user(db, "test@example.com", "password123", "Test User")
    assert user.email == "test@example.com"
    assert user.hashed_password != "password123"

    authenticated = await authenticate_user(db, "test@example.com", "password123")
    assert authenticated is not None
    assert authenticated.id == user.id


@pytest.mark.asyncio
async def test_register_duplicate_email(db):
    await register_user(db, "dupe@example.com", "pass")
    with pytest.raises(ValueError, match="already exists"):
        await register_user(db, "dupe@example.com", "pass2")


@pytest.mark.asyncio
async def test_authenticate_wrong_password(db):
    await register_user(db, "wrong@example.com", "correct")
    result = await authenticate_user(db, "wrong@example.com", "incorrect")
    assert result is None


def test_create_and_decode_token():
    import uuid
    user_id = uuid.uuid4()
    token = create_access_token(user_id, "token@example.com")
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["email"] == "token@example.com"
