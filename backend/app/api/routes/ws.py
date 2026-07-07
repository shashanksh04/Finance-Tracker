import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from app.core.security import decode_token
from app.ws.ws_manager import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    user_id = None
    await ws.accept()
    try:
        data = await ws.receive_text()
        msg = json.loads(data)
        token = msg.get("token", "")
        payload = decode_token(token)
        if not payload or payload.type != "access":
            await ws.send_json({"event": "error", "data": "Authentication failed"})
            await ws.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_id = payload.sub
        await manager.connect(user_id, ws)
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if user_id:
            manager.disconnect(user_id, ws)
    except Exception:
        if user_id:
            manager.disconnect(user_id, ws)
