import json
import uuid
from datetime import date, timedelta
from typing import AsyncGenerator, Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.core.config import settings
from app.core.redis import get_redis
from app.schemas.copilot import CopilotRequest, CopilotResponse, DecisionSimulationRequest, DecisionSimulationResponse
from app.copilot.intent_router import classify_intent
from app.copilot.tools import get_tool_schemas, execute_tool
from app.copilot.rag_engine import RAGEngine
from app.models.memory import FinancialMemory
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.budget import Budget
from app.models.bill import Bill
from app.models.goal import Goal


CONVERSATION_TTL = getattr(settings, "CONVERSATION_TTL_HOURS", 24) * 3600
MAX_HISTORY = 20


class CopilotService:
    def __init__(self, db: AsyncSession, user=None):
        self.db = db
        self.user = user

    async def _build_full_context(self, user_id: str) -> str:
        parts = []

        name = self.user.full_name if self.user and self.user.full_name else "there"
        parts.append(f"User's name: {name}")

        accts = await self.db.execute(
            select(Account).where(Account.user_id == user_id, Account.is_archived == False)
        )
        accounts = accts.scalars().all()
        if accounts:
            parts.append("Accounts:")
            for a in accounts:
                bal = float(a.balance) if a.balance else 0
                parts.append(f"  - {a.name} ({a.type}): balance {bal:.2f}")
        else:
            parts.append("No accounts set up yet.")

        today = date.today()
        month_start = today.replace(day=1)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        three_months_ago = (month_start - timedelta(days=90)).replace(day=1)
        last_month_end = month_start
        last_month_start = (last_month_end - timedelta(days=1)).replace(day=1)

        income = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.user_id == user_id, Transaction.date >= month_start, Transaction.date < month_end, Transaction.type == "income")
        )
        income_total = income.scalar()
        expense = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.user_id == user_id, Transaction.date >= month_start, Transaction.date < month_end, Transaction.type == "expense")
        )
        expense_total = expense.scalar()

        lm_income = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.user_id == user_id, Transaction.date >= last_month_start, Transaction.date < last_month_end, Transaction.type == "income")
        )
        lm_expense = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.user_id == user_id, Transaction.date >= last_month_start, Transaction.date < last_month_end, Transaction.type == "expense")
        )
        parts.append(f"Current month ({month_start} through {today}): income {income_total:.2f}, expenses {expense_total:.2f}")
        parts.append(f"Last month ({last_month_start} to {last_month_end}): income {lm_income.scalar():.2f}, expenses {lm_expense.scalar():.2f}")

        for label, p_start, p_end in [
            ("Current month", month_start, month_end),
            ("Last month", last_month_start, last_month_end),
        ]:
            cat_rows = await self.db.execute(
                select(
                    Transaction.category_id,
                    func.coalesce(func.sum(Transaction.amount), 0).label("total"),
                )
                .where(
                    Transaction.user_id == user_id,
                    Transaction.date >= p_start,
                    Transaction.date < p_end,
                    Transaction.type == "expense",
                )
                .group_by(Transaction.category_id)
                .order_by(func.sum(Transaction.amount).desc())
                .limit(8)
            )
            rows = cat_rows.all()
            if rows:
                cat_ids = [r.category_id for r in rows if r.category_id]
                cat_map = {}
                if cat_ids:
                    cats = await self.db.execute(select(Category).where(Category.id.in_(cat_ids)))
                    for c in cats.scalars().all():
                        cat_map[c.id] = c
                parts.append(f"Top spending categories ({label}):")
                for r in rows:
                    name = cat_map[r.category_id].name if r.category_id and r.category_id in cat_map else "Uncategorized"
                    parts.append(f"  - {name}: {float(r.total):.2f}")
            else:
                parts.append(f"No expenses in {label}.")

        budgets = await self.db.execute(
            select(Budget).where(Budget.user_id == user_id, Budget.is_active == True)
        )
        budgets_list = budgets.scalars().all()
        if budgets_list:
            parts.append("Active budgets (monthly):")
            for b in budgets_list:
                cat_name = "Overall"
                if b.category_id:
                    cat = await self.db.get(Category, b.category_id)
                    cat_name = cat.name if cat else "Unknown"
                parts.append(f"  - {cat_name}: limit {float(b.amount):.2f}")
        else:
            parts.append("No active budgets.")

        goals = await self.db.execute(
            select(Goal).where(Goal.user_id == user_id)
        )
        goals_list = goals.scalars().all()
        if goals_list:
            parts.append("Goals:")
            for g in goals_list:
                parts.append(f"  - {g.name}: {float(g.current_amount):.2f} / {float(g.target_amount):.2f} ({g.status})")
        else:
            parts.append("No goals.")

        bills = await self.db.execute(
            select(Bill).where(Bill.user_id == user_id, Bill.is_paid == False)
            .order_by(Bill.due_date).limit(10)
        )
        bills_list = bills.scalars().all()
        if bills_list:
            parts.append("Upcoming bills:")
            for b in bills_list:
                parts.append(f"  - {b.name}: {float(b.amount):.2f} due {b.due_date}")
        else:
            parts.append("No upcoming bills.")

        return "\n".join(parts)

    async def chat(self, user_id: str, request: CopilotRequest) -> CopilotResponse:
        messages = await self._load_or_create_conversation(user_id, request.session_id)
        messages.append({"role": "user", "content": request.message})

        context = await self._build_full_context(user_id)
        reply = await self._llm_chat(messages, context, True, user_id)

        messages.append({"role": "assistant", "content": reply})
        await self._save_conversation(user_id, request.session_id, messages)
        await self._store_as_memory(user_id, request.message, reply)

        return CopilotResponse(
            reply=reply,
            session_id=request.session_id or "",
            suggested_actions=[],
            insights=[],
        )

    async def chat_stream(
        self, user_id: str, request: CopilotRequest
    ) -> AsyncGenerator[str, None]:
        session_id = request.session_id or str(uuid.uuid4())
        messages = await self._load_or_create_conversation(user_id, session_id)
        messages.append({"role": "user", "content": request.message})

        yield self._sse_event("session_id", session_id)
        yield self._sse_event("status", "Analyzing your finances...")
        yield self._sse_event("status", "Gathering your financial data...")

        context = await self._build_full_context(user_id)
        reply = ""
        async for event in self._llm_chat_stream(messages, context, True, user_id):
            yield event
            if event.startswith("data: "):
                try:
                    parsed = json.loads(event[6:])
                    if parsed.get("type") == "token":
                        reply += parsed.get("content", "")
                except json.JSONDecodeError:
                    pass

        messages.append({"role": "assistant", "content": reply})
        await self._save_conversation(user_id, session_id, messages)
        await self._store_as_memory(user_id, request.message, reply)

        yield self._sse_event("done", session_id)

    async def _llm_chat(
        self,
        messages: list,
        rag_context: str,
        enable_tools: bool,
        user_id: str,
    ) -> str:
        ollama_messages = self._build_ollama_messages(messages, rag_context)
        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": ollama_messages,
            "stream": False,
            "options": {"num_predict": 1024},
        }
        if enable_tools:
            payload["tools"] = get_tool_schemas()

        try:
            async with httpx.AsyncClient(timeout=180) as client:
                headers = {}
                if settings.OLLAMA_API_KEY:
                    headers["Authorization"] = f"Bearer {settings.OLLAMA_API_KEY}"
                response = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/chat",
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()
                result = response.json()
                msg = result.get("message", {})
                content = msg.get("content", "")
                tool_calls = msg.get("tool_calls", [])

                if tool_calls:
                    return await self._handle_tool_calls(tool_calls, messages, rag_context, user_id)

                return content or "I'm not sure how to answer that. Could you rephrase?"
        except httpx.HTTPStatusError as e:
            return f"Sorry, the AI service returned an error ({e.response.status_code}). Please try again."
        except httpx.RequestError:
            return "Sorry, I can't reach the AI service right now. Check your connection and try again."

    async def _llm_chat_stream(
        self,
        messages: list,
        rag_context: str,
        enable_tools: bool,
        user_id: str,
    ) -> AsyncGenerator[str, None]:
        ollama_messages = self._build_ollama_messages(messages, rag_context)
        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": ollama_messages,
            "stream": True,
            "options": {"num_predict": 2048},
        }
        if enable_tools:
            payload["tools"] = get_tool_schemas()

        try:
            async with httpx.AsyncClient(timeout=180) as client:
                headers = {}
                if settings.OLLAMA_API_KEY:
                    headers["Authorization"] = f"Bearer {settings.OLLAMA_API_KEY}"
                async with client.stream(
                    "POST",
                    f"{settings.OLLAMA_BASE_URL}/api/chat",
                    json=payload,
                    headers=headers,
                ) as response:
                    response.raise_for_status()
                    tool_calls = None
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            chunk = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        msg = chunk.get("message", {})
                        delta = msg.get("content", "")
                        if delta:
                            yield self._sse_event("token", delta)

                        if msg.get("tool_calls"):
                            tool_calls = msg.get("tool_calls")

                        if chunk.get("done"):
                            break

                    if tool_calls:
                        yield self._sse_event("status", "Processing tool results...")
                        tool_result = await self._handle_tool_calls(
                            tool_calls, messages, rag_context, user_id
                        )
                        yield self._sse_event("token", tool_result)

        except httpx.HTTPStatusError as e:
            err = f"AI service error ({e.response.status_code}). Please try again."
            yield self._sse_event("error", err)
        except httpx.RequestError:
            err = "Can't reach the AI service. Check your connection."
            yield self._sse_event("error", err)

    async def _handle_tool_calls(
        self,
        tool_calls: list,
        messages: list,
        rag_context: str,
        user_id: str,
    ) -> str:
        results = []
        for tc in tool_calls:
            fn_info = tc.get("function", {})
            name = fn_info.get("name", "")
            args = fn_info.get("arguments", {})
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except json.JSONDecodeError:
                    args = {}
            try:
                result = await execute_tool(self.db, user_id, self.user, name, args)
                results.append({"tool": name, "result": result})
            except Exception as e:
                results.append({"tool": name, "result": {"error": str(e)}})

        summary = "\n".join(
            f"Tool '{r['tool']}' returned: {json.dumps(r['result'], default=str)[:500]}"
            for r in results
        )
        follow_up_messages = messages + [
            {"role": "assistant", "content": None, "tool_calls": tool_calls},
            {"role": "tool", "content": summary},
        ]
        return await self._llm_chat(follow_up_messages, rag_context, False, user_id)

    def _build_ollama_messages(self, messages: list, rag_context: str) -> list:
        user_name = self.user.full_name if self.user and self.user.full_name else "there"
        system = {
            "role": "system",
            "content": (
                f"You are a helpful financial copilot assistant. The user's name is {user_name}.\n\n"
                "The data below is only a summary overview. You have tools available.\n"
                "CRITICAL: You MUST use a tool to answer ANY question about spending, income, transactions,"
                " budgets, or other financial data. Do NOT try to answer from the summary context alone.\n"
                "For example, if asked 'how much did I spend on food last month', call"
                " get_spending_by_category(category_name='Food & Dining', period='last_month').\n"
                "If asked 'show my recent transactions', call get_recent_transactions().\n"
                "If asked about budget health, call get_budget_health().\n"
                "Always prefer using a tool over guessing from context.\n\n"
                f"Summary overview:\n{rag_context}"
            ),
        }

        history = []
        for m in messages[-MAX_HISTORY:]:
            entry = {"role": m["role"], "content": m.get("content", "")}
            if m.get("tool_calls"):
                entry["tool_calls"] = m["tool_calls"]
            history.append(entry)

        return [system] + history

    async def simulate_decision(
        self, user_id: str, request: DecisionSimulationRequest
    ) -> DecisionSimulationResponse:
        context = await self._build_full_context(user_id)
        prompt = (
            f"You are a financial advisor. The user is considering spending "
            f"{request.amount:.2f} on '{request.scenario}' "
            f"in the '{request.category or 'general'}' category ({request.timeframe}).\n\n"
            f"Current financial context:\n{context}\n\n"
            f"Provide:\n1. Impact analysis on their finances\n"
            f"2. 3-5 specific recommendations\n"
            f"3. Risk level (low/medium/high)\n"
            f"4. Projected outcome in JSON format\n\n"
            f"Be realistic, specific, and actionable."
        )

        messages = [{"role": "user", "content": prompt}]
        ollama_messages = self._build_ollama_messages(messages, "")
        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": ollama_messages,
            "stream": False,
            "options": {"num_predict": 1024},
        }

        try:
            async with httpx.AsyncClient(timeout=180) as client:
                headers = {}
                if settings.OLLAMA_API_KEY:
                    headers["Authorization"] = f"Bearer {settings.OLLAMA_API_KEY}"
                response = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/chat",
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()
                result = response.json()
                reply = result.get("message", {}).get("content", "")
        except Exception:
            reply = "Unable to run simulation. Please try again."

        risk = "medium"
        if "low risk" in reply.lower():
            risk = "low"
        elif "high risk" in reply.lower():
            risk = "high"

        return DecisionSimulationResponse(
            impact_analysis=reply,
            recommendations=[
                r.strip() for r in reply.split("\n")
                if r.strip() and any(r.strip().startswith(p) for p in ("-", "1", "2", "3", "4", "5", "*"))
            ][:5],
            risk_level=risk,
            projected_outcome={"scenario": request.scenario, "amount": request.amount, "risk": risk},
        )

    async def _load_or_create_conversation(self, user_id: str, session_id: Optional[str]) -> list:
        if not session_id:
            return []
        try:
            redis = await get_redis()
            key = f"conversation:{user_id}:{session_id}"
            data = await redis.get(key)
            if data:
                await redis.expire(key, CONVERSATION_TTL)
                return json.loads(data)
            return []
        except Exception:
            return []

    async def _save_conversation(self, user_id: str, session_id: Optional[str], messages: list):
        if not session_id:
            return
        try:
            redis = await get_redis()
            key = f"conversation:{user_id}:{session_id}"
            trimmed = messages[-MAX_HISTORY:]
            await redis.setex(key, CONVERSATION_TTL, json.dumps(trimmed))
        except Exception:
            pass

    async def _store_as_memory(self, user_id: str, query: str, response: str):
        try:
            text = f"Q: {query}\nA: {response[:500]}"
            from app.embeddings.embedding_service import EmbeddingService
            embedding = await EmbeddingService.embed(text)
            memory = FinancialMemory(
                user_id=user_id,
                key=f"conv_{date.today().isoformat()}",
                value=response[:500],
                context=query[:200],
                embedding=embedding,
                embedding_vector=embedding,
                memory_type="conversation",
                importance=0.5,
            )
            self.db.add(memory)
            await self.db.flush()
        except Exception:
            pass

    def _sse_event(self, event_type: str, data) -> str:
        payload = json.dumps({"type": event_type, "content": data}, default=str)
        return f"data: {payload}\n\n"
