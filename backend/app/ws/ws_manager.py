import json
import threading
from typing import Any
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}
        import asyncio
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            if user_id not in self._connections:
                self._connections[user_id] = []
            self._connections[user_id].append(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            if loop.is_running():
                loop.create_task(self._async_disconnect(user_id, ws))
                return
        except RuntimeError:
            pass
        if user_id in self._connections:
            self._connections[user_id] = [w for w in self._connections[user_id] if w is not ws]
            if not self._connections[user_id]:
                del self._connections[user_id]

    async def _async_disconnect(self, user_id: str, ws: WebSocket):
        async with self._lock:
            if user_id in self._connections:
                self._connections[user_id] = [w for w in self._connections[user_id] if w is not ws]
                if not self._connections[user_id]:
                    del self._connections[user_id]

    async def send_personal_message(self, user_id: str, event: str, data: Any = None):
        async with self._lock:
            connections = list(self._connections.get(user_id, []))
        message = json.dumps({"event": event, "data": data})
        dead = []
        for ws in connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    async def broadcast_to_user(self, user_id: str, event: str, data: Any = None):
        await self.send_personal_message(user_id, event, data)

    async def broadcast(self, event: str, data: Any = None):
        async with self._lock:
            snapshot = [(uid, list(conns)) for uid, conns in self._connections.items()]
        message = json.dumps({"event": event, "data": data})
        all_dead: list[tuple[str, WebSocket]] = []
        for uid, connections in snapshot:
            for ws in connections:
                try:
                    await ws.send_text(message)
                except Exception:
                    all_dead.append((uid, ws))
        for uid, ws in all_dead:
            self.disconnect(uid, ws)


manager = ConnectionManager()
