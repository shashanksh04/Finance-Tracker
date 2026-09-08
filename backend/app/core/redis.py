import asyncio
import redis.asyncio as aioredis
from app.core.config import settings

_redis: aioredis.Redis | None = None
_lock = asyncio.Lock()
_init_exc: Exception | None = None


async def get_redis() -> aioredis.Redis:
    global _redis, _init_exc
    if _redis is not None:
        return _redis
    async with _lock:
        if _redis is not None:
            return _redis
        if _init_exc is not None:
            raise _init_exc
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True, retry_on_error=[ConnectionError, TimeoutError, ConnectionRefusedError])
        try:
            await _redis.ping()
        except Exception as e:
            _init_exc = e
            try:
                await _redis.close()
            except Exception:
                pass
            _redis = None
            raise
        _init_exc = None
    return _redis


async def close_redis():
    global _redis
    if _redis:
        await _redis.close()
        _redis = None
