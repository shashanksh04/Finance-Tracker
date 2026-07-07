from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.services.category_service import CategoryService
from app.services.auth_service import DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES
from typing import List
from sqlalchemy import select

router = APIRouter(prefix="/api/categories", tags=["Categories"])


@router.get("/")
async def list_categories(type: str = Query(None), page: int = Query(0, ge=0), page_size: int = Query(0, ge=0, le=100), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CategoryService(db)
    return await service.get_all(user.id, type, page, page_size)


@router.post("/", response_model=CategoryResponse)
async def create_category(data: CategoryCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CategoryService(db)
    return await service.create(user.id, data)


@router.post("/seed")
async def seed_categories(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).where(Category.user_id == user.id).limit(1))
    if result.scalar_one_or_none():
        return {"message": "Categories already exist"}
    for cat in DEFAULT_EXPENSE_CATEGORIES:
        db.add(Category(user_id=user.id, type="expense", **cat))
    for cat in DEFAULT_INCOME_CATEGORIES:
        db.add(Category(user_id=user.id, type="income", **cat))
    await db.flush()
    return {"message": "Default categories created"}


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(category_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CategoryService(db)
    return await service.get_by_id(user.id, category_id)


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: str, data: CategoryUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CategoryService(db)
    return await service.update(user.id, category_id, data)


@router.delete("/{category_id}")
async def delete_category(category_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CategoryService(db)
    await service.delete(user.id, category_id)
    return {"message": "Category deleted"}
