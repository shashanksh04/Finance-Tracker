from app.ws.ws_manager import manager


async def notify_alerts_updated(user_id: str):
    await manager.broadcast_to_user(user_id, "alerts_updated")


async def notify_dashboard_updated(user_id: str):
    await manager.broadcast_to_user(user_id, "dashboard_updated")


async def notify_alert_read(user_id: str, alert_id: str):
    await manager.broadcast_to_user(user_id, "alert_read", {"alert_id": alert_id})


async def notify_alert_dismissed(user_id: str, alert_id: str):
    await manager.broadcast_to_user(user_id, "alert_dismissed", {"alert_id": alert_id})
