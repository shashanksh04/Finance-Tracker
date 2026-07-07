from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.memory import MemoryCreate, MemoryUpdate, MemoryResponse
from app.services.memory_service import MemoryService
from typing import List

router = APIRouter(prefix="/api/memories", tags=["Financial Memory"])


@router.get("/", response_model=List[MemoryResponse])
async def list_memories(memory_type: str = Query(None), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = MemoryService(db)
    return await service.get_all(user.id, memory_type)


@router.post("/", response_model=MemoryResponse)
async def create_memory(data: MemoryCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = MemoryService(db)
    return await service.create(user.id, data)


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory(memory_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = MemoryService(db)
    return await service.get_by_key(user.id, memory_id)


@router.put("/{memory_id}", response_model=MemoryResponse)
async def update_memory(memory_id: str, data: MemoryUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = MemoryService(db)
    return await service.update(user.id, memory_id, data)


@router.delete("/{memory_id}")
async def delete_memory(memory_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = MemoryService(db)
    await service.delete(user.id, memory_id)
    return {"message": "Memory deleted"}
