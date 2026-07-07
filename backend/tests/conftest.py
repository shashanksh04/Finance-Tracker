import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = "test-user-id"
    user.settings = {"currency": "USD"}
    return user


@pytest.fixture
def mock_redis():
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.setex = AsyncMock()
    redis.expire = AsyncMock()
    return redis
