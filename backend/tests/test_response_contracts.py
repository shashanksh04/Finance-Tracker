"""Guard against response models silently dropping fields.

FastAPI's `response_model` filters the payload down to exactly the fields the
schema declares. A key the service returns but the schema omits is therefore
stripped *without error* -- the endpoint still answers 200, so a smoke test on
status codes passes while the frontend crashes on `undefined.map(...)`.

Both halves of that failure have bitten this codebase:

  * `DashboardSummary` omitted three keys the dashboard service returns, so
    every dashboard response lost `spending_by_category` and DashboardPage
    threw `TypeError: Cannot read properties of undefined (reading 'map')`.
  * `CashflowProjectionResponse` declared three keys the cashflow service
    never returns, so every cashflow response failed validation with a 500.

The expectations below are extracted from the service source with `ast` rather
than hard-coded, so they track the real implementation instead of a snapshot
someone can update in the same breath as the bug.
"""

import ast
from pathlib import Path

import pytest

from app.schemas.analysis import (
    CashflowProjectionResponse,
    DashboardSummary,
    PeriodAnalysisResponse,
)

SERVICE = Path(__file__).resolve().parent.parent / "app" / "services" / "analysis_service.py"

# Fields DashboardPage reads off the dashboard payload.
DASHBOARD_FIELDS_CONSUMED_BY_FRONTEND = {
    "spending_by_category",
    "goal_progress",
    "alerts",
}


def _service_return_keys(method_name: str) -> set:
    """Union of the string keys of every dict literal a service method returns.

    The union matters: a method with several `return {...}` statements can
    produce different keys on different branches, and it is the union that
    the response model has to accommodate. Collecting the union also makes
    this independent of traversal order, which `ast.walk` does not guarantee
    (it is breadth-first, not source order).
    """
    tree = ast.parse(SERVICE.read_text())
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == method_name:
            keys = set()
            for stmt in ast.walk(node):
                if (
                    isinstance(stmt, ast.Return)
                    and isinstance(stmt.value, ast.Dict)
                ):
                    keys |= {
                        key.value
                        for key in stmt.value.keys
                        if isinstance(key, ast.Constant)
                        and isinstance(key.value, str)
                    }
            if keys:
                return keys
    raise AssertionError(f"no dict-literal return found in {method_name}()")


class TestDashboardResponseContract:
    def test_service_does_return_the_three_stripped_keys(self):
        produced = _service_return_keys("get_dashboard_summary")
        assert DASHBOARD_FIELDS_CONSUMED_BY_FRONTEND <= produced, (
            "DashboardPage consumes keys get_dashboard() no longer returns: "
            f"{sorted(DASHBOARD_FIELDS_CONSUMED_BY_FRONTEND - produced)}"
        )

    def test_schema_declares_every_key_the_service_returns(self):
        produced = _service_return_keys("get_dashboard_summary")
        declared = set(DashboardSummary.model_fields)
        stripped = produced - declared
        assert not stripped, (
            "DashboardSummary omits keys the service returns; FastAPI will "
            f"silently strip them from the response: {sorted(stripped)}"
        )

    def test_schema_declares_every_key_the_frontend_reads(self):
        declared = set(DashboardSummary.model_fields)
        missing = DASHBOARD_FIELDS_CONSUMED_BY_FRONTEND - declared
        assert not missing, (
            f"DashboardPage reads keys the schema strips: {sorted(missing)}"
        )


class TestCashflowResponseContract:
    def test_schema_declares_every_key_the_service_returns(self):
        produced = _service_return_keys("get_cashflow_projection")
        declared = set(CashflowProjectionResponse.model_fields)
        stripped = produced - declared
        assert not stripped, (
            "CashflowProjectionResponse omits keys the service returns: "
            f"{sorted(stripped)}"
        )

    @pytest.mark.parametrize("key", sorted(DASHBOARD_FIELDS_CONSUMED_BY_FRONTEND))
    def test_dashboard_only_fields_are_not_on_the_cashflow_schema(self, key):
        # These three are dashboard fields. They were once appended to the
        # cashflow model by mistake, which 500'd every cashflow request.
        assert key not in CashflowProjectionResponse.model_fields


class TestPeriodResponseContract:
    def test_schema_declares_every_key_the_service_returns(self):
        # get_period_analysis() delegates straight to _analyze_period(), which
        # is where the payload is actually built.
        produced = _service_return_keys("_analyze_period")
        declared = set(PeriodAnalysisResponse.model_fields)
        stripped = produced - declared
        assert not stripped, (
            "PeriodAnalysisResponse omits keys the service returns; FastAPI "
            f"will silently strip them: {sorted(stripped)}"
        )
