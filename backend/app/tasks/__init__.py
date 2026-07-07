from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "finance_tracker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "process-recurring-every-hour": {
            "task": "app.tasks.scheduled_tasks.process_recurring_transactions",
            "schedule": 3600.0,
        },
        "generate-alerts-daily": {
            "task": "app.tasks.scheduled_tasks.generate_alerts",
            "schedule": 43200.0,
        },
        "cleanup-alerts-daily": {
            "task": "app.tasks.scheduled_tasks.cleanup_old_alerts",
            "schedule": 86400.0,
        },
        "index-unindexed-every-15-min": {
            "task": "app.tasks.scheduled_tasks.index_unindexed_content",
            "schedule": 900.0,
        },
    },
)
