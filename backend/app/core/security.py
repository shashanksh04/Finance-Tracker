import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel
from app.core.config import settings


BLACKLIST_PREFIX = "token_blacklist:"


class TokenPayload(BaseModel):
    jti: str
    sub: str
    exp: datetime
    type: str


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"jti": str(uuid.uuid4()), "sub": user_id, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"jti": str(uuid.uuid4()), "sub": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[TokenPayload]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return TokenPayload(**payload)
    except JWTError:
        return None


async def is_token_blacklisted(jti: str) -> bool:
    from app.core.redis import get_redis
    r = await get_redis()
    return await r.exists(f"{BLACKLIST_PREFIX}{jti}") > 0


async def blacklist_token(jti: str, ttl: int):
    from app.core.redis import get_redis
    r = await get_redis()
    await r.setex(f"{BLACKLIST_PREFIX}{jti}", ttl, "1")
