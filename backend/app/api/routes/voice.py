import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Request
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models.user import User
from app.api.routes.auth import limiter
from app.services.whisper_service import WhisperService

router = APIRouter(prefix="/api/voice", tags=["Voice"])

MAX_AUDIO_BYTES = 25 * 1024 * 1024
ALLOWED_AUDIO_EXT = {"webm", "mp3", "wav", "ogg", "m4a", "mp4", "flac", "aac", "wma", "opus", "mpeg", "mpga"}

logger = logging.getLogger(__name__)


class TranscribeResponse(BaseModel):
    text: str


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