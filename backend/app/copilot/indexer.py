from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models.memory import FinancialMemory
from app.models.transaction import Transaction
from app.models.bill import Bill
from app.embeddings.embedding_service import EmbeddingService


class IndexingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def index_memory(self, memory_id: str) -> bool:
        result = await self.db.execute(
            select(FinancialMemory).where(FinancialMemory.id == memory_id)
        )
        memory = result.scalar_one_or_none()
        if not memory:
            return False

        text_parts = [memory.value]
        if memory.context:
            text_parts.append(memory.context)
        text = " | ".join(text_parts)

        try:
            embedding = await EmbeddingService.embed(text)
            memory.embedding = embedding
            memory.embedding_vector = embedding
            await self.db.flush()
            return True
        except Exception:
            return False

    async def index_transaction(self, transaction_id: str) -> bool:
        result = await self.db.execute(
            select(Transaction).where(Transaction.id == transaction_id)
        )
        txn = result.scalar_one_or_none()
        if not txn:
            return False

        text = txn.description
        if txn.merchant:
            text += f" | {txn.merchant}"
        if txn.notes:
            text += f" | {txn.notes}"

        try:
            embedding = await EmbeddingService.embed(text)
            memory = FinancialMemory(
                user_id=txn.user_id,
                key=f"txn_{txn.id[:8]}",
                value=f"[{txn.type.upper()}] {txn.description}: {txn.amount:.2f}",
                context=text[:200],
                embedding=embedding,
                embedding_vector=embedding,
                memory_type="transaction",
                importance=0.4,
            )
            self.db.add(memory)
            await self.db.flush()
            return True
        except Exception:
            return False

    async def index_bill(self, bill_id: str) -> bool:
        result = await self.db.execute(
            select(Bill).where(Bill.id == bill_id)
        )
        bill = result.scalar_one_or_none()
        if not bill:
            return False

        text = bill.name
        if bill.ocr_text:
            text += f" | {bill.ocr_text}"
        if bill.notes:
            text += f" | {bill.notes}"

        try:
            embedding = await EmbeddingService.embed(text)
            memory = FinancialMemory(
                user_id=bill.user_id,
                key=f"bill_{bill.id[:8]}",
                value=f"Bill: {bill.name} - {bill.amount:.2f} due {bill.due_date}",
                context=text[:200],
                embedding=embedding,
                embedding_vector=embedding,
                memory_type="bill",
                importance=0.5,
            )
            self.db.add(memory)
            await self.db.flush()
            return True
        except Exception:
            return False

    async def reindex_user(self, user_id: str) -> dict:
        stats = {"memories": 0, "transactions": 0, "bills": 0, "errors": 0}

        mem_result = await self.db.execute(
            select(FinancialMemory).where(
                FinancialMemory.user_id == user_id,
                FinancialMemory.memory_type.in_(["insight", "conversation", "note", "custom"]),
            )
        )
        for mem in mem_result.scalars().all():
            try:
                text = mem.value
                if mem.context:
                    text = f"{mem.context} | {text}"
                embedding = await EmbeddingService.embed(text)
                mem.embedding = embedding
                mem.embedding_vector = embedding
                stats["memories"] += 1
            except Exception:
                stats["errors"] += 1

        txn_result = await self.db.execute(
            select(Transaction).where(Transaction.user_id == user_id)
        )
        for txn in txn_result.scalars().all():
            try:
                text = txn.description
                if txn.merchant:
                    text += f" | {txn.merchant}"
                embedding = await EmbeddingService.embed(text)
                existing = await self.db.execute(
                    select(FinancialMemory).where(
                        FinancialMemory.user_id == user_id,
                        FinancialMemory.key == f"txn_{txn.id[:8]}",
                    )
                )
                mem = existing.scalar_one_or_none()
                if mem:
                    mem.embedding = embedding
                    mem.embedding_vector = embedding
                else:
                    mem = FinancialMemory(
                        user_id=user_id,
                        key=f"txn_{txn.id[:8]}",
                        value=f"[{txn.type.upper()}] {txn.description}: {txn.amount:.2f}",
                        context=text[:200],
                        embedding=embedding,
                        embedding_vector=embedding,
                        memory_type="transaction",
                        importance=0.4,
                    )
                    self.db.add(mem)
                stats["transactions"] += 1
            except Exception:
                stats["errors"] += 1

        bill_result = await self.db.execute(
            select(Bill).where(Bill.user_id == user_id)
        )
        for bill in bill_result.scalars().all():
            try:
                text = bill.name
                if bill.ocr_text:
                    text += f" | {bill.ocr_text}"
                embedding = await EmbeddingService.embed(text)
                existing = await self.db.execute(
                    select(FinancialMemory).where(
                        FinancialMemory.user_id == user_id,
                        FinancialMemory.key == f"bill_{bill.id[:8]}",
                    )
                )
                mem = existing.scalar_one_or_none()
                if mem:
                    mem.embedding = embedding
                    mem.embedding_vector = embedding
                else:
                    mem = FinancialMemory(
                        user_id=user_id,
                        key=f"bill_{bill.id[:8]}",
                        value=f"Bill: {bill.name} - {bill.amount:.2f} due {bill.due_date}",
                        context=text[:200],
                        embedding=embedding,
                        embedding_vector=embedding,
                        memory_type="bill",
                        importance=0.5,
                    )
                    self.db.add(mem)
                stats["bills"] += 1
            except Exception:
                stats["errors"] += 1

        await self.db.flush()
        return stats

    async def index_unindexed(self, batch_size: int = 50) -> dict:
        stats = {"memories": 0, "errors": 0}

        result = await self.db.execute(
            select(FinancialMemory).where(
                FinancialMemory.embedding.is_(None),
                FinancialMemory.embedding_vector.is_(None),
            ).limit(batch_size)
        )
        unindexed = result.scalars().all()

        for mem in unindexed:
            try:
                text = mem.value
                if mem.context:
                    text = f"{mem.context} | {text}"
                embedding = await EmbeddingService.embed(text)
                mem.embedding = embedding
                mem.embedding_vector = embedding
                stats["memories"] += 1
            except Exception:
                stats["errors"] += 1

        if stats["memories"] > 0:
            await self.db.flush()
        return stats
