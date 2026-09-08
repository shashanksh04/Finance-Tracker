import logging
import os
import secrets
import shutil
import tempfile
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models.user import User
from app.api.routes.auth import limiter
from app.services.ocr_service import OCRService

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/ocr", tags=["OCR"])


class OCRScanResponse(BaseModel):
    extracted_amount: Optional[float] = None
    extracted_due_date: Optional[str] = None
    extracted_merchant: Optional[str] = None
    confidence: float = 0
    raw_text: str = ""


@router.post("/scan", response_model=OCRScanResponse)
@limiter.limit("20/minute")
async def scan_file(request: Request, file: UploadFile = File(...), user: User = Depends(get_current_user)):
    raw_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".pdf"
    allowed = {".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".tiff"}
    if raw_ext not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")
    tmpdir = tempfile.mkdtemp(prefix="ocr_")
    tmp_path = os.path.join(tmpdir, f"{secrets.token_hex(16)}{raw_ext}")
    try:
        with open(tmp_path, "wb") as f:
            f.write(content)
        text = await OCRService.extract_text(tmp_path)
        parsed = OCRService.parse_bill_text(text)
        return OCRScanResponse(
            extracted_amount=parsed["amount"],
            extracted_due_date=parsed["due_date"],
            extracted_merchant=parsed["merchant"],
            confidence=parsed["confidence"],
            raw_text=text,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("OCR scan failed")
        raise HTTPException(status_code=500, detail="OCR processing failed")
    finally:
        try:
            shutil.rmtree(tmpdir, ignore_errors=True)
        except Exception:
            pass
