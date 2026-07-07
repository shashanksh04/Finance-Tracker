from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.category import CategoryCreate, CategoryUpdate
from fastapi import HTTPException, status


class CategoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: str, data: CategoryCreate) -> Category:
        category = Category(user_id=user_id, **data.model_dump())
        self.db.add(category)
        await self.db.flush()
        return category

    async def get_all(self, user_id: str, type_filter: str = None, page: int = 0, page_size: int = 0) -> list[Category] | dict:
        query = select(Category).where(Category.user_id == user_id)
        if type_filter:
            query = query.where(Category.type == type_filter)
        query = query.order_by(Category.sort_order)
        if page > 0 and page_size > 0:
            count_query = select(func.count()).select_from(query.subquery())
            total = (await self.db.execute(count_query)).scalar() or 0
            query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        items = list(result.scalars().all())
        if page > 0 and page_size > 0:
            return {
                "items": items,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, (total + page_size - 1) // page_size),
            }
        return items

    async def get_by_id(self, user_id: str, category_id: str) -> Category:
        result = await self.db.execute(
            select(Category).where(Category.id == category_id, Category.user_id == user_id)
        )
        cat = result.scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")
        return cat

    async def update(self, user_id: str, category_id: str, data: CategoryUpdate) -> Category:
        cat = await self.get_by_id(user_id, category_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(cat, field, value)
        await self.db.flush()
        return cat

    async def delete(self, user_id: str, category_id: str) -> bool:
        cat = await self.get_by_id(user_id, category_id)
        await self.db.delete(cat)
        await self.db.flush()
        return True
