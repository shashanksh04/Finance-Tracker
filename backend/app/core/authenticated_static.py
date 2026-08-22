from urllib.parse import unquote
import os

from starlette.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles

from app.core.security import decode_token, is_token_blacklisted
from app.core.database import async_session_factory
from sqlalchemy import select
from app.models.bill import Bill


class AuthenticatedStaticFiles(StaticFiles):
    """Serves uploaded files but requires a valid access token and, for bill
    files, verifies the requesting user owns the referenced bill (IDOR fix)."""

    async def get_response(self, path: str, scope):
        headers = {k.decode(): v.decode() for k, v in scope.get("headers", [])}
        auth_header = headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return PlainTextResponse("Not authenticated", status_code=401)

        token = auth_header[len("Bearer "):]
        try:
            payload = decode_token(token)
        except Exception:
            payload = None
        if not payload or payload.type != "access":
            return PlainTextResponse("Invalid or expired token", status_code=401)
        if await is_token_blacklisted(payload.jti):
            return PlainTextResponse("Token revoked", status_code=401)

        full_path = scope.get("path", "")
        if "/bills/" in full_path:
            bill_id = unquote(full_path.rsplit("/bills/", 1)[-1])
            bill_id = os.path.splitext(bill_id)[0]
            if bill_id:
                async with async_session_factory() as db:
                    result = await db.execute(select(Bill.user_id).where(Bill.id == bill_id))
                    owner = result.scalar_one_or_none()
                if owner is None or owner != payload.sub:
                    return PlainTextResponse("Forbidden", status_code=403)

        return await super().get_response(path, scope)
