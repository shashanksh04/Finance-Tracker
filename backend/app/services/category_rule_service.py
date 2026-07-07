from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.category_rule import CategoryRule
from app.models.category import Category
from app.schemas.category_rule import CategoryRuleCreate, CategoryRuleUpdate
from fastapi import HTTPException, status


class CategoryRuleService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: str, data: CategoryRuleCreate) -> dict:
        cat_result = await self.db.execute(select(Category).where(Category.id == data.category_id, Category.user_id == user_id))
        if not cat_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Category not found")
        rule = CategoryRule(user_id=user_id, **data.model_dump())
        self.db.add(rule)
        await self.db.flush()
        return await self._enrich(rule)

    async def get_all(self, user_id: str) -> list[dict]:
        result = await self.db.execute(
            select(CategoryRule).where(CategoryRule.user_id == user_id).order_by(CategoryRule.priority.desc())
        )
        rules = list(result.scalars().all())
        return [await self._enrich(r) for r in rules]

    async def get_by_id(self, user_id: str, rule_id: str) -> CategoryRule:
        result = await self.db.execute(
            select(CategoryRule).where(CategoryRule.id == rule_id, CategoryRule.user_id == user_id)
        )
        rule = result.scalar_one_or_none()
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        return rule

    async def update(self, user_id: str, rule_id: str, data: CategoryRuleUpdate) -> dict:
        rule = await self.get_by_id(user_id, rule_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(rule, field, value)
        await self.db.flush()
        return await self._enrich(rule)

    async def delete(self, user_id: str, rule_id: str) -> bool:
        rule = await self.get_by_id(user_id, rule_id)
        await self.db.delete(rule)
        await self.db.flush()
        return True

    async def match_transaction(self, user_id: str, description: str, merchant: str = None, amount: float = None) -> str:
        result = await self.db.execute(
            select(CategoryRule).where(CategoryRule.user_id == user_id, CategoryRule.is_active == True)
            .order_by(CategoryRule.priority.desc())
        )
        rules = list(result.scalars().all())
        best_match = None
        for rule in rules:
            match = True
            if rule.contains_keyword and rule.contains_keyword.lower() not in (description or "").lower():
                match = False
            if rule.merchant_name and (not merchant or rule.merchant_name.lower() != merchant.lower()):
                match = False
            if rule.min_amount is not None and (amount is None or amount < rule.min_amount):
                match = False
            if rule.max_amount is not None and (amount is None or amount > rule.max_amount):
                match = False
            if match:
                best_match = rule
                break
        return best_match.category_id if best_match else None

    async def _enrich(self, rule: CategoryRule) -> dict:
        cat_name = ""
        if rule.category:
            cat_name = rule.category.name
        return {
            "id": rule.id,
            "category_id": rule.category_id,
            "category_name": cat_name,
            "contains_keyword": rule.contains_keyword,
            "merchant_name": rule.merchant_name,
            "min_amount": float(rule.min_amount) if rule.min_amount else None,
            "max_amount": float(rule.max_amount) if rule.max_amount else None,
            "priority": rule.priority,
            "is_active": rule.is_active,
            "created_at": rule.created_at.isoformat() if rule.created_at else None,
        }
