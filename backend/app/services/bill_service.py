from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.models.bill import Bill
from app.schemas.bill import BillCreate, BillUpdate
from fastapi import HTTPException, status, UploadFile
import os
from app.core.config import settings
from app.services.ocr_service import OCRService


class BillService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: str, data: BillCreate) -> dict:
        bill = Bill(user_id=user_id, **data.model_dump())
        self.db.add(bill)
        await self.db.flush()
        await self.db.refresh(bill, ["category"])
        return await self._enrich(bill)

    async def get_all(self, user_id: str, unpaid_only: bool = False) -> list[dict]:
        query = select(Bill).options(joinedload(Bill.category)).where(Bill.user_id == user_id)
        if unpaid_only:
            query = query.where(Bill.is_paid == False)
        result = await self.db.execute(query.order_by(Bill.due_date))
        bills = list(result.unique().scalars().all())
        return [await self._enrich(b) for b in bills]

    async def get_by_id(self, user_id: str, bill_id: str) -> dict:
        result = await self.db.execute(
            select(Bill).options(joinedload(Bill.category)).where(Bill.id == bill_id, Bill.user_id == user_id)
        )
        bill = result.unique().scalar_one_or_none()
        if not bill:
            raise HTTPException(status_code=404, detail="Bill not found")
        return await self._enrich(bill)

    async def update(self, user_id: str, bill_id: str, data: BillUpdate) -> dict:
        result = await self.db.execute(
            select(Bill).options(joinedload(Bill.category)).where(Bill.id == bill_id, Bill.user_id == user_id)
        )
        bill = result.unique().scalar_one_or_none()
        if not bill:
            raise HTTPException(status_code=404, detail="Bill not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(bill, field, value)
        await self.db.flush()
        await self.db.refresh(bill)
        return await self._enrich(bill)

    async def delete(self, user_id: str, bill_id: str) -> bool:
        result = await self.db.execute(
            select(Bill).where(Bill.id == bill_id, Bill.user_id == user_id)
        )
        bill = result.scalar_one_or_none()
        if not bill:
            raise HTTPException(status_code=404, detail="Bill not found")
        if bill.file_path and os.path.exists(bill.file_path):
            os.remove(bill.file_path)
        await self.db.delete(bill)
        await self.db.flush()
        return True

    async def upload_file(self, user_id: str, bill_id: str, file: UploadFile) -> dict:
        import aiofiles
        result = await self.db.execute(
            select(Bill).options(joinedload(Bill.category)).where(Bill.id == bill_id, Bill.user_id == user_id)
        )
        bill = result.unique().scalar_one_or_none()
        if not bill:
            raise HTTPException(status_code=404, detail="Bill not found")
        ext = os.path.splitext(file.filename)[1] if file.filename else ".pdf"
        file_path = os.path.join(settings.UPLOAD_DIR, "bills", f"{bill_id}{ext}")
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        content = await file.read()
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)
        bill.file_path = file_path
        ocr_text = await OCRService.extract_text(file_path)
        parsed = OCRService.parse_bill_text(ocr_text)
        bill.ocr_text = ocr_text
        await self.db.flush()
        enriched = await self._enrich(bill)
        enriched["extracted_amount"] = parsed["amount"]
        enriched["extracted_due_date"] = parsed["due_date"]
        enriched["extracted_merchant"] = parsed["merchant"]
        enriched["confidence"] = parsed["confidence"]
        return enriched

    async def _enrich(self, bill: Bill) -> dict:
        cat_name = None
        if bill.category:
            cat_name = bill.category.name
        return {
            "id": bill.id,
            "user_id": bill.user_id,
            "name": bill.name,
            "amount": float(bill.amount),
            "due_date": bill.due_date.isoformat() if bill.due_date else None,
            "file_path": bill.file_path,
            "ocr_text": bill.ocr_text,
            "is_paid": bill.is_paid,
            "paid_date": bill.paid_date.isoformat() if bill.paid_date else None,
            "category_id": bill.category_id,
            "category_name": cat_name,
            "notes": bill.notes,
            "created_at": bill.created_at.isoformat() if bill.created_at else None,
            "updated_at": bill.updated_at.isoformat() if bill.updated_at else None,
        }
