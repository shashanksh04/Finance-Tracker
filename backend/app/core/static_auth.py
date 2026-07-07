from fastapi import Request, HTTPException, status
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.security import decode_token, is_token_blacklisted


class AuthenticatedStaticFilesMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/uploads/"):
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
            token = auth_header.removeprefix("Bearer ")
            payload = decode_token(token)
            if not payload or payload.type != "access":
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
            if await is_token_blacklisted(payload.jti):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")
        return await call_next(request)
