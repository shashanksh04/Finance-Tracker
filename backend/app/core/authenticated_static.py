import re
import posixpath
import uuid as uuid_lib
from urllib.parse import unquote

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

        raw_path = scope.get("path", "")
        decoded = unquote(raw_path)
        normalized = posixpath.normpath(decoded)
        if ".." in normalized.split("/"):
            return PlainTextResponse("Forbidden", status_code=403)
        m = re.match(r"^/uploads/bills/([^/]+?)(?:\.[^/.]+)?$", normalized)
        if m:
            bill_id = m.group(1)
            try:
                uuid_lib.UUID(bill_id)
            except ValueError:
                return PlainTextResponse("Forbidden", status_code=403)
            async with async_session_factory() as db:
                result = await db.execute(select(Bill.user_id).where(Bill.id == bill_id, Bill.deleted_at.is_(None)))
                owner = result.scalar_one_or_none()
            if owner is None or str(owner) != str(payload.sub):
                return PlainTextResponse("Forbidden", status_code=403)

        return await super().get_response(path, scope)
