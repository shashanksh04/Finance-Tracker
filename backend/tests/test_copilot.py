import pytest
from app.copilot.intent_router import classify_intent, is_direct_answer_intent
from app.embeddings.embedding_service import EmbeddingService
from app.copilot.copilot_service import CopilotService
from app.copilot.tools import get_tool_schemas, execute_tool


class TestIntentRouter:
    def test_spending_intent(self):
        assert classify_intent("How much did I spend on food?") == "spending_query"
        assert classify_intent("What were my expenses last month?") == "spending_query"
        assert classify_intent("How much did I pay for groceries?") == "spending_query"

    def test_budget_intent(self):
        assert classify_intent("Am I over budget this month?") == "budget_query"
        assert classify_intent("Show me my budget remaining") == "budget_query"

    def test_goal_intent(self):
        assert classify_intent("How is my saving goal progressing?") == "goal_query"
        assert classify_intent("What are my financial targets?") == "goal_query"

    def test_bill_intent(self):
        assert classify_intent("What bills are due this week?") == "bill_query"
        assert classify_intent("Show my upcoming payments") == "bill_query"

    def test_multi_step_intent(self):
        result = classify_intent("How much did I spend on food and am I over budget?")
        assert result == "multi_step"

    def test_general_chat_intent(self):
        assert classify_intent("Give me financial advice") == "general_chat"
        assert classify_intent("What do you think about investing?") == "general_chat"

    def test_is_direct_answer(self):
        assert is_direct_answer_intent("spending_query") is True
        assert is_direct_answer_intent("budget_query") is True
        assert is_direct_answer_intent("goal_query") is True
        assert is_direct_answer_intent("bill_query") is True
        assert is_direct_answer_intent("general_chat") is False
        assert is_direct_answer_intent("multi_step") is False


class TestEmbeddingService:
    def test_cosine_similarity_identical(self):
        a = [1.0, 0.0, 0.0]
        b = [1.0, 0.0, 0.0]
        assert EmbeddingService.cosine_similarity(a, b) == pytest.approx(1.0)

    def test_cosine_similarity_orthogonal(self):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert EmbeddingService.cosine_similarity(a, b) == pytest.approx(0.0)

    def test_cosine_similarity_partial(self):
        a = [1.0, 1.0]
        b = [1.0, 0.0]
        result = EmbeddingService.cosine_similarity(a, b)
        assert result > 0 and result < 1

    def test_cosine_similarity_zero_vector(self):
        a = [0.0, 0.0]
        b = [1.0, 0.0]
        assert EmbeddingService.cosine_similarity(a, b) == pytest.approx(0.0)

    def test_cosine_similarity_empty(self):
        assert EmbeddingService.cosine_similarity([], [1.0]) == 0.0

    def test_cosine_similarity_dim_mismatch(self):
        assert EmbeddingService.cosine_similarity([1.0], [1.0, 2.0]) == 0.0


class TestToolSchemas:
    def test_get_tool_schemas_returns_list(self):
        schemas = get_tool_schemas()
        assert isinstance(schemas, list)
        assert len(schemas) == 9

    def test_each_tool_has_name(self):
        schemas = get_tool_schemas()
        for s in schemas:
            assert "function" in s
            assert "name" in s["function"]

    def test_tool_names_are_unique(self):
        schemas = get_tool_schemas()
        names = [s["function"]["name"] for s in schemas]
        assert len(names) == len(set(names))


class TestCopilotService:
    @pytest.mark.asyncio
    async def test_sse_format(self):
        from app.copilot.copilot_service import CopilotService
        svc = CopilotService(None, None)
        event = svc._sse_event("token", "hello world")
        assert event == 'data: {"type": "token", "content": "hello world"}\n\n'

    @pytest.mark.asyncio
    async def test_sse_format_dict_content(self):
        svc = CopilotService(None, None)
        event = svc._sse_event("done", "sess-123")
        assert '"type": "done"' in event
        assert '"content": "sess-123"' in event
