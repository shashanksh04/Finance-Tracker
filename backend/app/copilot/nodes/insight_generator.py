import json
from datetime import date
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.transaction import Transaction
from app.models.memory import FinancialMemory
from app.embeddings.embedding_service import EmbeddingService
from app.core.config import settings


async def run_insights(db: AsyncSession, user_id: str, user, messages: list):
    try:
        r = await db.execute(
            select(sa_func.count(Transaction.id)).where(Transaction.user_id == user_id)
        )
        if not r.scalar():
            return

        today = date.today()
        month_start = today.replace(day=1)

        income_r = await db.execute(
            select(sa_func.coalesce(sa_func.sum(Transaction.amount), 0))
            .where(Transaction.user_id == user_id, Transaction.date >= month_start, Transaction.type == "income")
        )
        expense_r = await db.execute(
            select(sa_func.coalesce(sa_func.sum(Transaction.amount), 0))
            .where(Transaction.user_id == user_id, Transaction.date >= month_start, Transaction.type == "expense")
        )
        income = float(income_r.scalar() or 0)
        expense = float(expense_r.scalar() or 0)

        context = f"This month: income ₹{income:.2f}, expenses ₹{expense:.2f}"

        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            headers = {}
            if settings.OLLAMA_API_KEY:
                headers["Authorization"] = f"Bearer {settings.OLLAMA_API_KEY}"
            payload = {
                "model": settings.OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": (
                        "Generate 1-2 very short proactive financial insights (1 sentence each). "
                        "Only if you have actual data to base them on. Format as a JSON array of strings."
                    )},
                    {"role": "user", "content": context},
                ],
                "stream": False,
                "options": {"num_predict": 256},
            }
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            reply = response.json().get("message", {}).get("content", "")
            insights = []
            try:
                parsed = json.loads(reply)
                if isinstance(parsed, list):
                    insights = parsed
            except (json.JSONDecodeError, TypeError):
                lines = [l.strip() for l in reply.split("\n") if l.strip()]
                insights = [l for l in lines if l.endswith(".")][:2]

            for insight in insights:
                emb = await EmbeddingService.embed(insight)
                memory = FinancialMemory(
                    user_id=user_id,
                    key=f"insight_{date.today().isoformat()}",
                    value=insight,
                    embedding=emb,
                    embedding_vector=emb,
                    memory_type="insight",
                    importance=0.4,
                )
                db.add(memory)
            await db.flush()

    except Exception:
        pass
