import json
import uuid
from datetime import date, timedelta
from typing import AsyncGenerator, Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.redis import get_redis
from app.schemas.copilot import CopilotRequest, CopilotResponse, DecisionSimulationRequest, DecisionSimulationResponse
from app.copilot.intent_router import classify_intent, is_direct_answer_intent
from app.copilot.tools import get_tool_schemas, execute_tool
from app.copilot.rag_engine import RAGEngine
from app.models.memory import FinancialMemory


CONVERSATION_TTL = getattr(settings, "CONVERSATION_TTL_HOURS", 24) * 3600
MAX_HISTORY = 20


class CopilotService:
    def __init__(self, db: AsyncSession, user=None):
        self.db = db
        self.user = user
        self.rag = RAGEngine(db)

    async def chat(self, user_id: str, request: CopilotRequest) -> CopilotResponse:
        messages = await self._load_or_create_conversation(user_id, request.session_id)
        messages.append({"role": "user", "content": request.message})

        intent = classify_intent(request.message)

        if is_direct_answer_intent(intent):
            reply = await self._direct_answer(user_id, intent, request.message)
        else:
            context = await self.rag.retrieve(request.message, user_id)
            rag_context = self.rag.format_context(context)
            reply = await self._llm_chat(messages, rag_context, intent == "multi_step", user_id)

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
        yield self._sse_event("status", "Analyzing your request...")

        intent = classify_intent(request.message)
        yield self._sse_event("intent", intent)

        if is_direct_answer_intent(intent):
            yield self._sse_event("status", f"Looking up your financial data...")
            reply = await self._direct_answer(user_id, intent, request.message)
            yield self._sse_event("token", reply)
        else:
            context = await self.rag.retrieve(request.message, user_id)
            rag_context = self.rag.format_context(context)
            reply = ""
            async for event in self._llm_chat_stream(messages, rag_context, intent == "multi_step", user_id):
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

    async def _direct_answer(self, user_id: str, intent: str, message: str) -> str:
        from app.copilot.tools.finance_tools import (
            get_spending_by_category,
            get_budget_health,
            get_recent_transactions,
            get_upcoming_bills,
            get_goal_progress,
        )

        tool_map = {
            "spending_query": get_spending_by_category,
            "budget_query": get_budget_health,
            "goal_query": get_goal_progress,
            "bill_query": get_upcoming_bills,
        }
        fn = tool_map.get(intent)
        if not fn:
            return "I understand your question but need more details to give a precise answer."

        try:
            result = await fn(db=self.db, user_id=user_id, user=self.user)
            return self._format_direct_answer(intent, result)
        except Exception as e:
            return f"I ran into an issue fetching your data: {str(e)}"

    def _format_direct_answer(self, intent: str, data: dict) -> str:
        if intent == "spending_query":
            items = data.get("items", [])
            total = data.get("formatted_total", "$0.00")
            if not items:
                return f"No spending found for this period. Your total tracked spending is {total}."
            lines = [f"Your total spending this period is {total}."]
            for item in items[:5]:
                lines.append(f"- {item['category']}: {item['formatted']} ({item['count']} transactions)")
            return "\n".join(lines)

        if intent == "budget_query":
            budgets = data.get("budgets", [])
            if not budgets:
                return "You have no active budgets. Consider creating one to track your spending."
            lines = ["Here's your budget health this month:"]
            for b in budgets:
                emoji = "🔴" if b["status"] == "over" else "🟡" if b["status"] == "warning" else "🟢"
                lines.append(
                    f"{emoji} {b['category']}: {b['formatted_spent']} / {b['formatted_budgeted']} "
                    f"({b['percentage']}%) — {b['formatted_remaining']} remaining"
                )
            return "\n".join(lines)

        if intent == "goal_query":
            goals = data.get("goals", [])
            if not goals:
                return "You have no active financial goals. Setting goals can help you save more effectively."
            lines = ["Here's your goal progress:"]
            for g in goals:
                lines.append(
                    f"- {g['name']}: {g['formatted_current']} / {g['formatted_target']} "
                    f"({g['progress_percentage']}%) — {g['formatted_remaining']} to go"
                )
            return "\n".join(lines)

        if intent == "bill_query":
            bills = data.get("bills", [])
            if not bills:
                return "No upcoming bills due in this period. You're all clear!"
            lines = [f"You have {data['count']} bill(s) due totaling {data['formatted_total']}:"]
            for b in bills:
                lines.append(
                    f"- {b['name']}: {b['formatted']} due {b['due_date']} ({b['days_until']} days away)"
                )
            return "\n".join(lines)

        return json.dumps(data, default=str)

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
            "options": {"num_predict": 1024},
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
        system = {
            "role": "system",
            "content": (
                "You are a helpful financial copilot assistant. You help users understand their "
                "spending, budgets, goals, bills, and overall financial health. "
                "Be concise, accurate, and friendly. Use the provided context and tools to answer "
                "questions. If you use tools, interpret the results naturally for the user."
            ),
        }
        if rag_context:
            system["content"] += f"\n\n{rag_context}"

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
        context = await self.rag.retrieve(f"spending in {request.category or 'all'}", user_id)
        rag_context = self.rag.format_context(context)

        prompt = (
            f"You are a financial advisor. The user is considering spending "
            f"{request.amount:.2f} on '{request.scenario}' "
            f"in the '{request.category or 'general'}' category ({request.timeframe}).\n\n"
            f"Current financial context:\n{rag_context}\n\n"
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
