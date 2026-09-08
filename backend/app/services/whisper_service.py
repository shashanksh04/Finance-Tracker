import asyncio
import os
import threading
import tempfile
from typing import Optional

from app.core.config import settings

_model = None
_model_lock = threading.Lock()


class WhisperService:
    """Local speech-to-text using faster-whisper. Model is loaded lazily on first use."""

    @staticmethod
    def get_model():
        global _model
        if _model is None:
            with _model_lock:
                if _model is None:
                    from faster_whisper import WhisperModel

                    _model = WhisperModel(
                        settings.WHISPER_MODEL,
                        device=settings.WHISPER_DEVICE,
                        compute_type=settings.WHISPER_COMPUTE_TYPE,
                    )
        return _model

    @staticmethod
    def warmup():
        try:
            WhisperService.get_model()
        except Exception:
            pass

    @staticmethod
    async def transcribe(data: bytes, extension: str = "webm") -> str:
        model = WhisperService.get_model()
        suffix = extension if extension.startswith(".") else f".{extension}"
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _transcribe_sync, model, data, suffix)


def _transcribe_sync(model, data: bytes, suffix: str) -> str:
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(data)
            tmp_path = f.name
        segments, _info = model.transcribe(
            tmp_path,
            language=settings.WHISPER_LANGUAGE or None,
            vad_filter=True,
        )
        return " ".join(seg.text.strip() for seg in segments).strip()
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError:
                pass