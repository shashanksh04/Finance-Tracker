from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.category_rule import CategoryRuleCreate, CategoryRuleUpdate, CategoryRuleResponse
from app.services.category_rule_service import CategoryRuleService
from typing import List

router = APIRouter(prefix="/api/category-rules", tags=["Category Rules"])


@router.get("/", response_model=List[CategoryRuleResponse])
async def list_rules(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CategoryRuleService(db)
    return await service.get_all(user.id)


@router.post("/", response_model=CategoryRuleResponse)
async def create_rule(data: CategoryRuleCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CategoryRuleService(db)
    return await service.create(user.id, data)


@router.get("/{rule_id}", response_model=CategoryRuleResponse)
async def get_rule(rule_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CategoryRuleService(db)
    return await service.get_by_id(user.id, rule_id)


@router.put("/{rule_id}", response_model=CategoryRuleResponse)
async def update_rule(rule_id: str, data: CategoryRuleUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CategoryRuleService(db)
    return await service.update(user.id, rule_id, data)


@router.delete("/{rule_id}")
async def delete_rule(rule_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CategoryRuleService(db)
    await service.delete(user.id, rule_id)
    return {"message": "Rule deleted"}
