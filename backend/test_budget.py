import asyncio
from app.core.database import async_session_factory
from app.models.category import Category
from app.services.budget_service import BudgetService
from app.schemas.budget import BudgetCreate
from datetime import date
from sqlalchemy import select


async def test():
    async with async_session_factory() as db:
        result = await db.execute(select(Category).limit(1))
        cat = result.scalar_one_or_none()
        if cat:
            print(f'Category: {cat.id} {cat.name}')

        service = BudgetService(db)

        # Test 1: null category_id
        try:
            b1 = await service.create(
                'test-user-id',
                BudgetCreate(category_id=None, amount=1000, period='monthly', start_date=date(2026, 6, 1)),
            )
            print(f'Test 1 (null cat): OK')
        except Exception as e:
            print(f'Test 1 FAILED: {type(e).__name__}: {e}')
            import traceback; traceback.print_exc()

        # Test 2: real category_id
        if cat:
            try:
                b2 = await service.create(
                    'test-user-id',
                    BudgetCreate(category_id=cat.id, amount=2000, period='monthly', start_date=date(2026, 6, 1)),
                )
                print(f'Test 2 (real cat): OK')
            except Exception as e:
                print(f'Test 2 FAILED: {type(e).__name__}: {e}')
                import traceback; traceback.print_exc()


asyncio.run(test())
