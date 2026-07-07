import os, re, asyncio, threading
from typing import Optional
from datetime import datetime


class OCRService:
    _ocr = None
    _lock = threading.Lock()

    @classmethod
    def _get_ocr(cls):
        if cls._ocr is None:
            with cls._lock:
                if cls._ocr is None:
                    try:
                        from paddleocr import PaddleOCR
                        cls._ocr = PaddleOCR(use_angle_cls=True, lang="en", use_gpu=False, show_log=False)
                    except Exception:
                        cls._ocr = None
        return cls._ocr

    @classmethod
    async def extract_text(cls, file_path: str) -> str:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            return await asyncio.to_thread(cls._extract_pdf, file_path)
        elif ext in (".png", ".jpg", ".jpeg", ".bmp", ".tiff"):
            return await asyncio.to_thread(cls._extract_image, file_path)
        return ""

    @classmethod
    def _extract_pdf(cls, file_path: str) -> str:
        try:
            import fitz
            doc = fitz.open(file_path)
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            if not text.strip():
                text = cls._extract_image_from_pdf(file_path)
            return text.strip()
        except Exception:
            return ""

    @classmethod
    def _extract_image_from_pdf(cls, file_path: str) -> str:
        import fitz
        import tempfile
        doc = fitz.open(file_path)
        text = ""
        tmp_paths = []
        try:
            for page_num in range(len(doc)):
                page = doc[page_num]
                pix = page.get_pixmap()
                with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                    tmp_path = tmp.name
                tmp_paths.append(tmp_path)
                pix.save(tmp_path)
                text += cls._extract_image(tmp_path)
            return text.strip()
        finally:
            doc.close()
            for p in tmp_paths:
                try:
                    os.remove(p)
                except OSError:
                    pass

    @classmethod
    def _extract_image(cls, file_path: str) -> str:
        ocr = cls._get_ocr()
        if ocr:
            try:
                result = ocr.ocr(file_path, cls=False)
                text = ""
                for line in result:
                    for item in line:
                        text += item[1][0] + " "
                return text.strip()
            except Exception:
                return ""
        return ""

    @classmethod
    def parse_bill_text(cls, text: str) -> dict:
        if not text:
            return {"amount": None, "due_date": None, "merchant": None, "confidence": 0}
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        full = " ".join(lines)
        amount = None
        due_date = None
        merchant = None
        matches = 0
        tried = 0
        amt_patterns = [
            r"(?:total|amount|balance|due|pay)\s*:?\s*\$?([0-9,]+\.\d{2})",
            r"\$?([0-9,]+\.\d{2})",
            r"(?:total|amount|balance)[:\s]*([0-9,]+\.\d{2})",
        ]
        for p in amt_patterns:
            tried += 1
            m = re.search(p, full, re.IGNORECASE)
            if m:
                try:
                    val = float(m.group(1).replace(",", ""))
                    if val > 0:
                        amount = val
                        matches += 1
                        break
                except ValueError:
                    pass
        date_patterns = [
            r"(?:due|date|deadline|payment)\s*:?\s*([A-Z][a-z]+\.?\s+\d{1,2},?\s+\d{4})",
            r"(?:due|date|deadline|payment)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
            r"(\d{4}[/-]\d{1,2}[/-]\d{1,2})",
        ]
        for p in date_patterns:
            tried += 1
            m = re.search(p, full, re.IGNORECASE)
            if m:
                raw = m.group(1)
                for fmt in ("%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y", "%m/%d/%Y", "%m-%d-%Y", "%Y-%m-%d", "%d/%m/%Y"):
                    try:
                        due_date = datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
                        matches += 1
                        break
                    except ValueError:
                        continue
                if due_date:
                    break
        merchant_patterns = [
            r"(?:payee|merchant|vendor|bill from|company)\s*:?\s*(.+)",
            r"^([A-Z][A-Za-z0-9\s&.]+)$",
        ]
        for p in merchant_patterns:
            tried += 1
            m = re.search(p, full, re.IGNORECASE)
            if m:
                candidate = m.group(1).strip().rstrip(".")
                if candidate and len(candidate) > 2:
                    merchant = candidate
                    matches += 1
                    break
        confidence = round(matches / max(tried, 1), 2) if tried > 0 else 0
        return {"amount": amount, "due_date": due_date, "merchant": merchant, "confidence": confidence}
