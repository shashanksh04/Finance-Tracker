from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.api.deps import get_current_user
from app.models.user import User
from app.services.ocr_service import OCRService
from pydantic import BaseModel
from typing import Optional
import os, tempfile


router = APIRouter(prefix="/api/ocr", tags=["OCR"])


class OCRScanResponse(BaseModel):
    extracted_amount: Optional[float] = None
    extracted_due_date: Optional[str] = None
    extracted_merchant: Optional[str] = None
    confidence: float = 0
    raw_text: str = ""


@router.post("/scan", response_model=OCRScanResponse)
async def scan_file(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    ext = os.path.splitext(file.filename)[1] if file.filename else ".pdf"
    if ext.lower() not in (".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".tiff"):
        raise HTTPException(status_code=400, detail="Unsupported file type")
    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        text = await OCRService.extract_text(tmp_path)
        parsed = OCRService.parse_bill_text(text)
        return OCRScanResponse(
            extracted_amount=parsed["amount"],
            extracted_due_date=parsed["due_date"],
            extracted_merchant=parsed["merchant"],
            confidence=parsed["confidence"],
            raw_text=text,
        )
    finally:
        os.unlink(tmp_path)
