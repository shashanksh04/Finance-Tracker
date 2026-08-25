from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
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
            select(CategoryRule).where(CategoryRule.user_id == user_id, CategoryRule.deleted_at.is_(None)).order_by(CategoryRule.priority.desc())
        )
        rules = list(result.scalars().all())
        return [await self._enrich(r) for r in rules]

    async def get_by_id(self, user_id: str, rule_id: str) -> CategoryRule:
        result = await self.db.execute(
            select(CategoryRule).where(CategoryRule.id == rule_id, CategoryRule.user_id == user_id, CategoryRule.deleted_at.is_(None))
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
        rule.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
        await self.db.flush()
        return True

    async def match_transaction(self, user_id: str, description: str, merchant: str = None, amount: float = None):
        result = await self.db.execute(
            select(CategoryRule).where(CategoryRule.user_id == user_id, CategoryRule.is_active == True)
        )
        rules = list(result.scalars().all())
        best = None
        best_score = (-1,)
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
                score = (float(rule.confidence or 0.5), rule.priority or 0)
                if score > best_score:
                    best_score = score
                    best = rule
        if best:
            return best.category_id, best.id
        return None, None

    async def record_hit(self, rule_id: str | None) -> None:
        if not rule_id:
            return
        rule = await self.db.get(CategoryRule, rule_id)
        if not rule:
            return
        rule.hit_count = (rule.hit_count or 0) + 1
        rule.last_matched_at = datetime.now(timezone.utc).replace(tzinfo=None)
        rule.confidence = min(1.0, round(float(rule.confidence or 0.5) + 0.05, 2))
        await self.db.flush()

    async def learn_from_correction(self, user_id: str, txn, old_category_id, new_category_id) -> None:
        # Penalize the rule that auto-assigned the overridden category.
        auto_rule_id = getattr(txn, "auto_rule_id", None)
        if auto_rule_id:
            old_rule = await self.db.get(CategoryRule, auto_rule_id)
            if old_rule and old_rule.category_id != new_category_id:
                old_rule.miss_count = (old_rule.miss_count or 0) + 1
                old_rule.confidence = max(0.0, round(float(old_rule.confidence or 0.5) - 0.15, 2))
                if old_rule.confidence < 0.2:
                    old_rule.is_active = False
                await self.db.flush()

        merchant = (getattr(txn, "merchant", None) or "").strip()
        desc = (getattr(txn, "description", None) or "").strip()
        keyword = None
        if merchant:
            match_field_value = merchant
            is_merchant = True
        else:
            keyword = desc.split()[0] if desc else None
            match_field_value = keyword
            is_merchant = False
        if not match_field_value:
            return

        if is_merchant:
            existing = await self.db.execute(
                select(CategoryRule).where(
                    CategoryRule.user_id == user_id,
                    CategoryRule.category_id == new_category_id,
                    CategoryRule.is_active == True,
                    CategoryRule.merchant_name == merchant,
                )
            )
        else:
            existing = await self.db.execute(
                select(CategoryRule).where(
                    CategoryRule.user_id == user_id,
                    CategoryRule.category_id == new_category_id,
                    CategoryRule.is_active == True,
                    CategoryRule.contains_keyword == keyword,
                )
            )
        rule = existing.scalar_one_or_none()
        if rule:
            rule.hit_count = (rule.hit_count or 0) + 1
            rule.confidence = min(1.0, round(float(rule.confidence or 0.5) + 0.1, 2))
            rule.last_matched_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await self.db.flush()
        else:
            new_rule = CategoryRule(
                user_id=user_id,
                category_id=new_category_id,
                merchant_name=merchant or None,
                contains_keyword=keyword,
                priority=0,
                is_active=True,
                confidence=0.6,
            )
            self.db.add(new_rule)
            await self.db.flush()

    async def _enrich(self, rule: CategoryRule) -> dict:
        cat_name = ""
        if rule.category_id:
            cat = await self.db.get(Category, rule.category_id)
            if cat:
                cat_name = cat.name
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
            "confidence": round(float(rule.confidence if rule.confidence is not None else 0.5), 2),
            "hit_count": rule.hit_count or 0,
            "miss_count": rule.miss_count or 0,
            "created_at": rule.created_at.isoformat() if rule.created_at else None,
        }
