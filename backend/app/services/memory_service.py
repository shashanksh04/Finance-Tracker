from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.memory import FinancialMemory
from app.schemas.memory import MemoryCreate, MemoryUpdate
from fastapi import HTTPException


class MemoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: str, data: MemoryCreate) -> FinancialMemory:
        memory = FinancialMemory(user_id=user_id, **data.model_dump())
        self.db.add(memory)
        await self.db.flush()
        return memory

    async def get_all(self, user_id: str, memory_type: str = None) -> list[FinancialMemory]:
        query = select(FinancialMemory).where(FinancialMemory.user_id == user_id)
        if memory_type:
            query = query.where(FinancialMemory.memory_type == memory_type)
        query = query.order_by(FinancialMemory.importance.desc(), FinancialMemory.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_key(self, user_id: str, key: str) -> FinancialMemory:
        result = await self.db.execute(
            select(FinancialMemory).where(FinancialMemory.user_id == user_id, FinancialMemory.key == key)
        )
        memory = result.scalar_one_or_none()
        if not memory:
            raise HTTPException(status_code=404, detail="Memory not found")
        return memory

    async def update(self, user_id: str, memory_id: str, data: MemoryUpdate) -> FinancialMemory:
        result = await self.db.execute(
            select(FinancialMemory).where(FinancialMemory.id == memory_id, FinancialMemory.user_id == user_id)
        )
        memory = result.scalar_one_or_none()
        if not memory:
            raise HTTPException(status_code=404, detail="Memory not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(memory, field, value)
        await self.db.flush()
        return memory

    async def delete(self, user_id: str, memory_id: str) -> bool:
        result = await self.db.execute(
            select(FinancialMemory).where(FinancialMemory.id == memory_id, FinancialMemory.user_id == user_id)
        )
        memory = result.scalar_one_or_none()
        if not memory:
            raise HTTPException(status_code=404, detail="Memory not found")
        await self.db.delete(memory)
        await self.db.flush()
        return True
