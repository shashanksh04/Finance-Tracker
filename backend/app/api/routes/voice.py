import logging
import json
import re
from datetime import date
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Request, Form
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.models.user import User
from app.api.routes.auth import limiter
from app.services.whisper_service import WhisperService
from app.services.transaction_service import TransactionService
from app.services.account_service import AccountService
from app.schemas.transaction import TransactionCreate
from app.core.database import get_db
import httpx
from app.core.config import settings

router = APIRouter(prefix="/api/voice", tags=["Voice"])

MAX_AUDIO_BYTES = 25 * 1024 * 1024
ALLOWED_AUDIO_EXT = {"webm", "mp3", "wav", "ogg", "m4a", "mp4", "flac", "aac", "wma", "opus", "mpeg", "mpga"}

logger = logging.getLogger(__name__)

# Words that signal an incoming (income) rather than outgoing (expense) amount.
_INCOME_HINTS = re.compile(r"\b(income|salary|payroll|paid me|got paid|refund|deposit|received|earned|made|reimburse|interest)\b", re.I)
# Number like 15, $15.30, 15 dollars, 1,200.50
_AMOUNT_RE = re.compile(r"[$€£₹]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)")
# Leading capitalised word(s) used as a merchant guess.
_MERCHANT_RE = re.compile(r"(?:at|from|to|with)\s+([A-Za-z0-9&.' ]{2,40})")


def _extract_amount(text: str) -> Optional[float]:
    m = _AMOUNT_RE.search(text)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def _extract_merchant(text: str) -> Optional[str]:
    m = _MERCHANT_RE.search(text)
    if m:
        return m.group(1).strip().rstrip(".") or None
    return None


def _local_parse(text: str) -> Optional[dict]:
    """
    Offline, LLM-free fallback parser. Returns None only when no amount can be
    extracted, so the caller can fall back to a friendly error instead of a 500.
    Keeps voice entry working even when the inference server is unavailable.
    """
    if not text:
        return None
    amount = _extract_amount(text)
    if amount is None:
        return None
    is_income = bool(_INCOME_HINTS.search(text))
    merchant = _extract_merchant(text)
    description = text.strip()
    return {
        "amount": round(amount, 2),
        "type": "income" if is_income else "expense",
        "description": merchant or description,
        "merchant": merchant,
        "date": None,
    }


async def _llm_parse(text: str) -> Optional[dict]:
    """Best-effort LLM parse. Returns None on any failure so we can fall back."""
    if not settings.OLLAMA_BASE_URL:
        return None
    prompt = (
        f"Extract a financial transaction from this spoken text: '{text}'. "
        "Respond ONLY with a JSON object: amount (number, absolute), type "
        "('income' or 'expense'), description (string), merchant (string or null), "
        "date (ISO yyyy-mm-dd or null). If a field is unknown use null. "
        "Example: 'I spent 15 dollars at coffee shop' -> "
        "{'amount':15,'type':'expense','description':'Coffee','merchant':'Coffee shop','date':null}"
    )
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={"model": settings.OLLAMA_MODEL, "prompt": prompt, "stream": False, "format": "json"},
            )
            response.raise_for_status()
            raw = response.json().get("response", "{}")
            data = json.loads(raw)
        amount = data.get("amount")
        if amount in (None, "", "null"):
            return None
        amount = float(amount)
        amount = abs(amount)
        txn_type = "income" if str(data.get("type", "")).lower() == "income" else "expense"
        return {
            "amount": round(amount, 2),
            "type": txn_type,
            "description": data.get("description") or text,
            "merchant": data.get("merchant"),
            "date": data.get("date"),
        }
    except Exception:
        logger.warning("LLM parse failed, using local fallback")
        return None


async def _pick_account(accounts_service: AccountService, user_id: str, txn_type: str):
    """
    Choose the right account for the transaction. Income goes to a checking/
    savings account; expenses go to a checking/cash account. Falls back to the
    user's default or first account.
    """
    accounts = await accounts_service.get_all(user_id)
    items = accounts.get("items", []) if isinstance(accounts, dict) else accounts
    if not items:
        return None
    preferred = ("checking", "cash", "savings") if txn_type == "expense" else ("checking", "savings", "cash")
    # Default account first, then best type match, then first account.
    for a in items:
        if getattr(a, "is_default", False):
            return a.id
    for a in items:
        if a.type in preferred:
            return a.id
    return items[0].id


class TranscribeResponse(BaseModel):
    text: str


class QuickAddResponse(BaseModel):
    text: str
    parsed_transaction: Optional[TransactionCreate] = None
    created: Optional[dict] = None
    source: str = "llm"  # "llm" or "local"


@router.post("/transcribe", response_model=TranscribeResponse)
@limiter.limit("20/minute")
async def transcribe(
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large")

    filename = file.filename or "audio.webm"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "webm"
    if ext not in ALLOWED_AUDIO_EXT:
        raise HTTPException(status_code=400, detail="Unsupported audio type")

    try:
        text = await WhisperService.transcribe(data, ext)
    except Exception:
        logger.exception("Whisper transcribe failed")
        raise HTTPException(status_code=500, detail="Transcription failed")

    if not text.strip():
        raise HTTPException(status_code=400, detail="No speech detected")

    return TranscribeResponse(text=text.strip())


@router.post("/quick-add", response_model=QuickAddResponse)
@limiter.limit("20/minute")
async def quick_add(
    request: Request,
    file: UploadFile = File(...),
    account_id: Optional[str] = Form(None),
    save: bool = Form(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Transcribe spoken text into a transaction.

    - `save=false` (default): returns the parsed transaction for the user to
      confirm first (confirm-first UX).
    - `save=true`: creates the transaction immediately.
    The parse always falls back to a local regex parser when the LLM is
    unavailable, so voice entry never 500s on an inference-service blip.
    """
    # 1. Transcribe audio.
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large")
    filename = file.filename or "audio.webm"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "webm"
    if ext not in ALLOWED_AUDIO_EXT:
        raise HTTPException(status_code=400, detail="Unsupported audio type")

    try:
        text = await WhisperService.transcribe(data, ext)
    except Exception:
        logger.exception("Whisper transcribe failed")
        raise HTTPException(status_code=500, detail="Transcription failed")

    if not text.strip():
        raise HTTPException(status_code=400, detail="No speech detected")

    # 2. Parse into a transaction: LLM first, local fallback.
    parsed = await _llm_parse(text.strip())
    source = "llm"
    if not parsed:
        parsed = _local_parse(text.strip())
        source = "local"
    if not parsed or parsed.get("amount") in (None, 0.0, 0):
        parsed = _local_parse(text.strip()) or {}
        source = "local"
    if "amount" not in parsed or parsed["amount"] in (None, 0.0, 0):
        raise HTTPException(status_code=422, detail=f"Could not detect an amount in: '{text.strip()[:80]}'")

    txn_type = parsed.get("type", "expense")
    txn_type = "income" if txn_type == "income" else "expense"

    # 3. Pick the account: explicit > type-aware default.
    account_service = AccountService(db)
    chosen_account = account_id
    if not chosen_account:
        chosen_account = await _pick_account(account_service, user.id, txn_type)
        if not chosen_account:
            raise HTTPException(status_code=400, detail="No account found to assign the transaction")

    # 4. Auto-categorize (rule > semantic), best-effort.
    category_id = None
    try:
        from app.services.categorization_service import CategorizationService
        suggestion = await CategorizationService(db).suggest_category(
            user.id,
            f"{parsed.get('merchant') or ''} {parsed.get('description') or ''}".strip(),
        )
        if suggestion:
            category_id = suggestion.id
    except Exception:
        logger.warning("Auto-categorization failed for voice quick-add", exc_info=True)

    txn_create = TransactionCreate(
        account_id=chosen_account,
        amount=parsed["amount"],
        type=txn_type,
        description=parsed.get("description") or text.strip() or "Voice entry",
        merchant=parsed.get("merchant"),
        date=(date.fromisoformat(parsed["date"]) if parsed.get("date") else date.today()),
        category_id=category_id,
    )

    # 5. Optionally persist.
    if save:
        created = await TransactionService(db).create(user.id, txn_create)
        from app.ws.events import notify_dashboard_updated
        await notify_dashboard_updated(user.id)
        return QuickAddResponse(
            text=text.strip(),
            parsed_transaction=txn_create,
            created=created,
            source=source,
        )

    return QuickAddResponse(text=text.strip(), parsed_transaction=txn_create, source=source)
