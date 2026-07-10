import asyncio
from app.tasks import celery_app
from app.core.database import async_session_factory
from app.services.recurring_service import RecurringService
from app.services.alert_service import AlertService


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    if loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, coro)
            return future.result()
    return loop.run_until_complete(coro)


@celery_app.task
def process_recurring_transactions():
    _run_async(_process_recurring())


async def _process_recurring():
    async with async_session_factory() as db:
        service = RecurringService(db)
        processed = await service.process_due()
        await db.commit()
        print(f"Processed {len(processed)} recurring transactions")


@celery_app.task
def generate_alerts():
    _run_async(_generate_alerts())


async def _generate_alerts():
    from sqlalchemy import select
    from app.models.user import User
    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.is_active == True))
        users = list(result.scalars().all())
        for user in users:
            alert_service = AlertService(db)
            await alert_service.generate_alerts(user.id)
        await db.commit()
        print(f"Generated alerts for {len(users)} users")


@celery_app.task
def cleanup_old_alerts():
    _run_async(_cleanup())


async def _cleanup():
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import delete
    from app.models.alert import Alert
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    async with async_session_factory() as db:
        stmt = delete(Alert).where(Alert.created_at < cutoff)
        await db.execute(stmt)
        await db.commit()
        print(f"Cleaned up old alerts")


@celery_app.task
def index_unindexed_content():
    _run_async(_index_unindexed())


async def _index_unindexed():
    from app.copilot.indexer import IndexingService
    async with async_session_factory() as db:
        service = IndexingService(db)
        stats = await service.index_unindexed(batch_size=50)
        await db.commit()
        print(f"Indexed {stats['memories']} memories ({stats['errors']} errors)")


@celery_app.task
def detect_goal_spending_conflicts():
    _run_async(_detect_goal_conflicts())


async def _detect_goal_conflicts():
    from sqlalchemy import select
    from app.models.user import User
    from app.services.goal_spending_service import detect_goal_spending_conflicts
    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.is_active == True))
        users = list(result.scalars().all())
        total = 0
        for user in users:
            alerts = await detect_goal_spending_conflicts(db, user.id)
            total += len(alerts)
        await db.commit()
        print(f"Detected {total} goal-spending conflicts for {len(users)} users")
