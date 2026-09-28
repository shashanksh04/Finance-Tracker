"""Tests for the cashflow projection maths.

These cover the pure helpers that decide the numbers: the future-transaction
reversal that produces a true opening balance, the recurring date expansion
that is shared with the Celery scheduler, and the daily/weekly bucketing
boundary. The database queries around them are exercised in production, not
here.
"""
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.analysis_service import AnalysisService
from app.services.recurring_service import RecurringService


def _txn(amount, type_, day, month=6, year=2026, recurring_id=None, bill_id=None):
    return type(
        "T",
        (),
        {
            "amount": None if amount is None else Decimal(str(amount)),
            "type": type_,
            "date": datetime(year, month, day),
            "recurring_id": recurring_id,
            "bill_id": bill_id,
        },
    )()


def _account(balance, account_type="checking"):
    return type("A", (), {"balance": Decimal(str(balance)), "type": account_type, "id": "acct-1"})()


class TestBalanceAsOf:
    def test_past_date_is_untouched(self):
        acct = _account(1000)
        txns = [_txn(200, "expense", 5)]
        # Everything is before as_of, so balance is used as-is.
        assert AnalysisService._balance_as_of(acct, txns, date(2026, 6, 10)) == 1000

    def test_future_expense_is_reversed(self):
        acct = _account(1000)
        txns = [_txn(300, "expense", 20)]
        # 1000 already includes the 300 outflow; the true balance today is 1300.
        assert AnalysisService._balance_as_of(acct, txns, date(2026, 6, 10)) == 1300

    def test_future_income_is_reversed(self):
        acct = _account(1000)
        txns = [_txn(500, "income", 15)]
        # 1000 already includes the 500 inflow; the true balance is 500.
        assert AnalysisService._balance_as_of(acct, txns, date(2026, 6, 10)) == 500

    def test_multiple_future_transactions(self):
        acct = _account(1000)
        txns = [_txn(100, "expense", 12), _txn(400, "income", 20), _txn(50, "expense", 25)]
        assert AnalysisService._balance_as_of(acct, txns, date(2026, 6, 10)) == 1000 + 100 - 400 + 50

    def test_null_balance_and_amount_are_tolerated(self):
        acct = _account(0)
        acct.balance = None
        txns = [_txn(None, "expense", 15)]
        assert AnalysisService._balance_as_of(acct, txns, date(2026, 6, 10)) == 0


class TestRecurringDateExpansion:
    """The projection must roll dates exactly the way the Celery job does."""

    @pytest.fixture
    def svc(self):
        return RecurringService(db=None)

    def test_daily_and_weekly(self, svc):
        assert svc.calculate_next_date(date(2026, 6, 1), "daily", 1) == date(2026, 6, 2)
        assert svc.calculate_next_date(date(2026, 6, 1), "weekly", 1) == date(2026, 6, 8)
        assert svc.calculate_next_date(date(2026, 6, 1), "biweekly", 1) == date(2026, 6, 15)
        assert svc.calculate_next_date(date(2026, 6, 1), "weekly", 2) == date(2026, 6, 15)

    def test_monthly_clamps_to_short_month(self, svc):
        # 31 Jan + 1 month has no 31st, so it must clamp to the last day.
        assert svc.calculate_next_date(date(2026, 1, 31), "monthly", 1) == date(2026, 2, 28)

    def test_monthly_clamps_leap_year(self, svc):
        assert svc.calculate_next_date(date(2028, 1, 31), "monthly", 1) == date(2028, 2, 29)

    def test_monthly_rolls_over_year(self, svc):
        assert svc.calculate_next_date(date(2026, 12, 15), "monthly", 1) == date(2027, 1, 15)

    def test_quarterly_and_yearly(self, svc):
        assert svc.calculate_next_date(date(2026, 1, 31), "quarterly", 1) == date(2026, 4, 30)
        assert svc.calculate_next_date(date(2026, 2, 28), "yearly", 1) == date(2027, 2, 28)

    def test_unknown_frequency_is_a_no_op(self, svc):
        d = date(2026, 6, 1)
        assert svc.calculate_next_date(d, "fortnightly-ish", 1) == d

    def test_rolling_repeatedly_never_skips_a_month(self, svc):
        # 31st should walk 31 -> 28 -> 31 rather than drifting to the 27th.
        assert svc.calculate_next_date(date(2026, 1, 31), "monthly", 1) == date(2026, 2, 28)
        assert svc.calculate_next_date(date(2026, 2, 28), "monthly", 1) == date(2026, 3, 28)


class TestResponseContract:
    """Pin the service output to the response schema.

    Regression guard: a required field on CashflowProjectionResponse that
    get_cashflow_projection never populates makes every /api/analysis/cashflow
    request fail with ResponseValidationError (HTTP 500) at runtime, while
    every other test still passes. Validating a complete sample of the real
    service output catches that here instead.
    """

    def _service_output(self):
        buckets, running, lowest = AnalysisService._build_buckets(
            {date(2026, 6, 3): 500.0, date(2026, 6, 5): -200.0},
            1000.0,
            date(2026, 6, 1),
            14,
            date(2026, 6, 15),
        )
        return {
            "generated_at": "2026-06-01T00:00:00+00:00",
            "start_date": "2026-06-01",
            "end_date": "2026-06-15",
            "days": 14,
            "granularity": "daily",
            "currency": "USD",
            "opening_balance": 1000.0,
            "liabilities": 250.0,
            "projected_closing_balance": running,
            "total_inflow": 500.0,
            "total_outflow": 200.0,
            "lowest_point": lowest,
            "is_overdrawn": False,
            "buckets": buckets,
        }

    def test_service_output_validates_against_the_schema(self):
        from app.schemas.analysis import CashflowProjectionResponse

        model = CashflowProjectionResponse(**self._service_output())
        assert model.days == 14
        assert model.buckets[2].closing_balance == 1500.0

    def test_schema_has_no_field_the_service_omits(self):
        from app.schemas.analysis import CashflowProjectionResponse

        produced = set(self._service_output())
        required = {
            name
            for name, field in CashflowProjectionResponse.model_fields.items()
            if field.is_required()
        }
        missing = required - produced
        assert not missing, f"schema requires fields the service never returns: {sorted(missing)}"

    def test_schema_declares_exactly_the_documented_fields(self):
        from app.schemas.analysis import CashflowProjectionResponse

        assert set(CashflowProjectionResponse.model_fields) == produced_fields()


def produced_fields():
    return {
        "generated_at",
        "start_date",
        "end_date",
        "days",
        "granularity",
        "currency",
        "opening_balance",
        "liabilities",
        "projected_closing_balance",
        "total_inflow",
        "total_outflow",
        "lowest_point",
        "is_overdrawn",
        "buckets",
    }
class TestBucketing:
    def test_daily_up_to_31_days(self):
        today = date(2026, 6, 1)
        buckets, running, lowest = AnalysisService._build_buckets(
            {}, 1000, today, 31, today + timedelta(days=31)
        )
        assert len(buckets) == 32  # today plus 31 days inclusive
        assert all(b["label"] == b["start_date"] for b in buckets)
        assert running == 1000

    def test_weekly_above_31_days(self):
        today = date(2026, 6, 1)
        buckets, running, _ = AnalysisService._build_buckets(
            {}, 1000, today, 90, today + timedelta(days=90)
        )
        assert len(buckets) == 13  # Jun 1..Jul 30 inclusive is 91 days = 13 weeks
        assert " - " in buckets[0]["label"]

    def test_boundary_is_31_not_32(self):
        today = date(2026, 6, 1)
        b31, _, _ = AnalysisService._build_buckets({}, 0, today, 31, today + timedelta(days=31))
        b32, _, _ = AnalysisService._build_buckets({}, 0, today, 32, today + timedelta(days=32))
        assert b31[0]["label"] == "2026-06-01"  # daily
        assert " - " in b32[0]["label"]  # weekly

    def test_running_balance_folds_in_and_out(self):
        today = date(2026, 6, 1)
        by_day = {
            date(2026, 6, 3): 500.0,   # inflow
            date(2026, 6, 5): -200.0,  # outflow
        }
        buckets, running, _ = AnalysisService._build_buckets(
            by_day, 1000, today, 14, today + timedelta(days=14)
        )
        assert buckets[2]["inflow"] == 500.0
        assert buckets[4]["outflow"] == 200.0
        assert running == 1300.0
        assert buckets[-1]["closing_balance"] == 1300.0

    def test_lowest_point_tracks_the_trough(self):
        today = date(2026, 6, 1)
        by_day = {date(2026, 6, 5): -800.0, date(2026, 6, 9): 5000.0}
        _, running, lowest = AnalysisService._build_buckets(
            by_day, 1000, today, 14, today + timedelta(days=14)
        )
        assert lowest["balance"] == 200.0
        assert lowest["label"] == "2026-06-05"
        assert running == 5200.0

    def test_lowest_point_defaults_to_opening_when_nothing_moves(self):
        today = date(2026, 6, 1)
        _, running, lowest = AnalysisService._build_buckets(
            {}, 750.0, today, 30, today + timedelta(days=30)
        )
        assert lowest == {"balance": 750.0, "label": None, "in_days": 0}
        assert running == 750.0

    def test_overdraw_is_detectable(self):
        today = date(2026, 6, 1)
        by_day = {date(2026, 6, 4): -2500.0}
        _, running, lowest = AnalysisService._build_buckets(
            by_day, 1000, today, 14, today + timedelta(days=14)
        )
        assert lowest["balance"] < 0
        assert running < 0
