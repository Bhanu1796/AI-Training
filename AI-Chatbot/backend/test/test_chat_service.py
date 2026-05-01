"""
Unit tests for chat_service.
"""
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.services.auth_service import register_user
from app.services.chat_service import (
    create_thread,
    delete_thread,
    get_thread,
    get_thread_messages,
    list_threads,
    save_message,
    update_thread_title,
)


@pytest.mark.asyncio
async def test_create_and_list_threads(db):
    user = await register_user(db, "chat_user@example.com", "pass")
    thread = await create_thread(db, user, "My Thread")
    assert thread.title == "My Thread"

    threads = await list_threads(db, user)
    assert any(t.id == thread.id for t in threads)


@pytest.mark.asyncio
async def test_save_and_get_messages(db):
    user = await register_user(db, "msg_user@example.com", "pass")
    thread = await create_thread(db, user)

    await save_message(db, thread.id, user.id, "user", "Hello")
    await save_message(db, thread.id, user.id, "assistant", "Hi there")

    messages = await get_thread_messages(db, thread.id, user)
    assert len(messages) == 2
    assert messages[0].role == "user"
    assert messages[1].role == "assistant"


@pytest.mark.asyncio
async def test_update_thread_title(db):
    user = await register_user(db, "rename_user@example.com", "pass")
    thread = await create_thread(db, user, "Old Title")
    updated = await update_thread_title(db, thread, "New Title")
    assert updated.title == "New Title"


@pytest.mark.asyncio
async def test_delete_thread(db):
    user = await register_user(db, "del_user@example.com", "pass")
    thread = await create_thread(db, user)
    await delete_thread(db, thread)

    found = await get_thread(db, thread.id, user)
    assert found is None
