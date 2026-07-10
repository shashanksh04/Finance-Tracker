import os, re, asyncio, threading, time, json, traceback
from typing import Optional
from datetime import datetime
from PIL import Image
from app.core.config import settings


class OCRService:
    _ocr = None
    _ocr_easy = None
    _lock = threading.Lock()
    _warm = False

    @classmethod
    def warmup(cls):
        if not cls._warm:
            cls._get_ocr()
            cls._warm = True

    @classmethod
    def _get_ocr(cls):
        if cls._ocr is None:
            with cls._lock:
                if cls._ocr is None:
                    try:
                        from paddleocr import PaddleOCR
                        cls._ocr = PaddleOCR(
                            use_angle_cls=True,
                            lang="en",
                            use_gpu=False,
                            show_log=False,
                            det_db_thresh=0.3,
                            det_db_box_thresh=0.5,
                        )
                    except Exception:
                        traceback.print_exc()
                        cls._ocr = None
        return cls._ocr

    @classmethod
    def _get_ocr_easy(cls):
        if cls._ocr_easy is None:
            with cls._lock:
                if cls._ocr_easy is None:
                    try:
                        import easyocr
                        cls._ocr_easy = easyocr.Reader(["en"], gpu=False)
                    except Exception:
                        traceback.print_exc()
                        cls._ocr_easy = None
        return cls._ocr_easy

    @classmethod
    def _preprocess_image(cls, file_path: str) -> str:
        try:
            img = Image.open(file_path)
            max_dim = 960
            w, h = img.size
            if max(w, h) > max_dim:
                ratio = max_dim / max(w, h)
                img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
            if img.mode != "L":
                img = img.convert("L")
            pre_path = file_path + "_pre.jpg"
            img.save(pre_path, "JPEG", quality=85)
            return pre_path
        except Exception:
            return file_path

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
        import concurrent.futures
        doc = fitz.open(file_path)
        texts = [""] * len(doc)
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                def ocr_page(page_num):
                    page = doc[page_num]
                    pix = page.get_pixmap()
                    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                        tmp_path = tmp.name
                    pix.save(tmp_path)
                    try:
                        return page_num, cls._extract_image(tmp_path)
                    finally:
                        try:
                            os.remove(tmp_path)
                        except OSError:
                            pass
                futures = [pool.submit(ocr_page, i) for i in range(len(doc))]
                for f in concurrent.futures.as_completed(futures):
                    i, t = f.result()
                    texts[i] = t
            return " ".join(t.strip() for t in texts if t.strip())
        finally:
            doc.close()

    @classmethod
    def _extract_image(cls, file_path: str) -> str:
        pre_path = cls._preprocess_image(file_path)
        try:
            ocr = cls._get_ocr()
            if ocr:
                try:
                    result = ocr.ocr(pre_path, cls=False)
                    text = " ".join(item[1][0] for line in result for item in line)
                    if text.strip():
                        return text.strip()
                except Exception:
                    traceback.print_exc()
        except Exception:
            traceback.print_exc()
        try:
            easy = cls._get_ocr_easy()
            if easy:
                result = easy.readtext(pre_path)
                text = " ".join(item[1] for item in result)
                return text.strip()
        except Exception:
            traceback.print_exc()
        finally:
            if pre_path != file_path:
                try:
                    os.remove(pre_path)
                except OSError:
                    pass
        return ""

    @classmethod
    def _call_llm_parse(cls, text: str) -> dict:
        import httpx
        try:
            with httpx.Client(timeout=15) as client:
                headers = {}
                if settings.OLLAMA_API_KEY:
                    headers["Authorization"] = f"Bearer {settings.OLLAMA_API_KEY}"
                payload = {
                    "model": settings.OLLAMA_MODEL,
                    "messages": [
                        {"role": "system", "content": (
                            "Extract the total amount, due date, and merchant name from this receipt/bill text. "
                            "Return ONLY valid JSON with keys: amount (number or null), due_date (YYYY-MM-DD or null), "
                            "merchant (string or null). If the total amount is ambiguous, prefer the largest amount "
                            "labeled 'Total' or 'Amount Due'. Example: {\"amount\": 42.50, \"due_date\": \"2026-07-15\", \"merchant\": \"Walmart\"}"
                        )},
                        {"role": "user", "content": text[:2000]},
                    ],
                    "stream": False,
                    "options": {"num_predict": 128, "temperature": 0},
                }
                try:
                    resp = client.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload, headers=headers)
                    resp.raise_for_status()
                    result = resp.json().get("message", {}).get("content", "")
                    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", result.strip())
                    parsed = json.loads(cleaned)
                    return {
                        "amount": parsed.get("amount"),
                        "due_date": parsed.get("due_date"),
                        "merchant": parsed.get("merchant"),
                    }
                except Exception:
                    return None
        except Exception:
            return None

    @classmethod
    def _fallback_regex_parse(cls, text: str) -> dict:
        if not text:
            return {"amount": None, "due_date": None, "merchant": None}
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        full = " ".join(lines)
        amount = None
        due_date = None
        merchant = None

        amt_patterns = [
            r"(?<!\w)(?:total|amount due|balance due|grand total)\s*:?\s*(?:₹|Rs\.?|INR)?\s*([0-9,]+\.\d{2})",
            r"(?<!\w)(?:total|amount|balance|due|pay)\s*:?\s*(?:₹|Rs\.?|INR)?\s*([0-9,]+\.\d{2})",
            r"(?<!\w)(?:total|amount|balance)[:\s]*(?:₹|Rs\.?|INR)?\s*([0-9,]+\.\d{2})",
            r"(?:₹|Rs\.?|INR)\s*([0-9,]+\.\d{2})",
        ]
        for p in amt_patterns:
            m = re.search(p, full, re.IGNORECASE)
            if m:
                try:
                    val = float(m.group(1).replace(",", ""))
                    if val > 0:
                        amount = val
                        break
                except ValueError:
                    pass
        if amount is None:
            nums = re.findall(r"([0-9,]+\.\d{2})", full)
            if nums:
                amount = max(float(n.replace(",", "")) for n in nums)

        date_patterns = [
            r"(?:due|date|deadline|payment)\s*:?\s*([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})",
            r"(?:due|date|deadline|payment)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
            r"(\d{4}[/-]\d{1,2}[/-]\d{1,2})",
        ]
        for p in date_patterns:
            m = re.search(p, full, re.IGNORECASE)
            if m:
                raw = m.group(1)
                for fmt in ("%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y", "%m/%d/%Y", "%m-%d-%Y", "%Y-%m-%d", "%d/%m/%Y"):
                    try:
                        due_date = datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
                        break
                    except ValueError:
                        continue
                if due_date:
                    break

        merchant_patterns = [
            r"(?:payee|merchant|vendor|bill from|company|from)\s*:?\s*(.+)",
        ]
        for p in merchant_patterns:
            m = re.search(p, full, re.IGNORECASE)
            if m:
                candidate = m.group(1).strip().rstrip(".")
                if candidate and len(candidate) > 2 and not re.match(r'^(total|amount|date|due|subtotal|tax|visa|mastercard|thank|payment)', candidate, re.IGNORECASE):
                    merchant = candidate
                    break
        if merchant is None and lines:
            first = lines[0].strip().rstrip(".")
            if re.match(r"^[A-Za-z][A-Za-z0-9\s&.'-]+$", first) and not re.match(r'^(total|amount|date|due|subtotal|tax|visa|mastercard|thank|payment)', first, re.IGNORECASE):
                merchant = first

        return {"amount": amount, "due_date": due_date, "merchant": merchant}

    @classmethod
    def parse_bill_text(cls, text: str) -> dict:
        if not text:
            return {"amount": None, "due_date": None, "merchant": None, "confidence": 0}

        llm_result = cls._call_llm_parse(text)
        if llm_result and llm_result.get("amount") is not None:
            result = llm_result
            source = "llm"
        else:
            result = cls._fallback_regex_parse(text)
            source = "regex"

        score = 0
        checks = 0
        if result.get("amount") is not None and result["amount"] > 0:
            score += 1
        checks += 1
        if result.get("due_date"):
            try:
                dt = datetime.strptime(result["due_date"], "%Y-%m-%d")
                if dt.year >= 2020 and dt.year <= 2100:
                    score += 1
            except ValueError:
                pass
        checks += 1
        if result.get("merchant") and len(result["merchant"]) >= 2:
            score += 1
        checks += 1

        confidence = round(score / checks, 2) if checks > 0 else 0
        if source == "llm":
            confidence = max(confidence, 0.5)

        return {
            "amount": result.get("amount"),
            "due_date": result.get("due_date"),
            "merchant": result.get("merchant"),
            "confidence": confidence,
        }
