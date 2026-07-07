import asyncio
import redis.asyncio as aioredis
from app.core.config import settings

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True, retry_on_error=[ConnectionError, TimeoutError, ConnectionRefusedError])
        try:
            await _redis.ping()
        except Exception:
            await _redis.close()
            _redis = None
            raise
    return _redis


async def close_redis():
    global _redis
    if _redis:
        await _redis.close()
        _redis = None
