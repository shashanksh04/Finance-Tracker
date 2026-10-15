"""Regression tests for creating and reading transactions.

These lock in two production regressions that produced HTTP 500s:

1. The add-transaction form posts an empty string for an optional
   ``category_id``. Because ``""`` is falsy it slipped past the
   "no category supplied" branch and was written to the ``category_id``
   foreign key, raising a ForeignKeyViolationError.
2. ``TransactionService._enrich`` touched the ``account`` / ``category``
   relationships directly. Under the async engine an unloaded relationship
   triggers a lazy load, which raises ``MissingGreenlet``.
"""
import sys
from datetime import date
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.transaction import TransactionCreate, TransactionUpdate
from app.services.transaction_service import TransactionService


class TestBlankStringCoercion:
    def test_create_blank_category_becomes_none(self):
        payload = TransactionCreate(
            account_id="acct-1",
            category_id="",
            amount=10,
            type="expense",
            description="Coffee",
            merchant="  ",
            notes="",
            date="2026-10-15",
        )
        assert payload.category_id is None
        assert payload.merchant is None
        assert payload.notes is None

    def test_create_valid_values_are_preserved(self):
        payload = TransactionCreate(
            account_id="acct-1",
            category_id="cat-1",
            amount=10,
            type="expense",
            merchant="Blue Bottle",
            notes="latte",
            date="2026-10-15",
        )
        assert payload.category_id == "cat-1"
        assert payload.merchant == "Blue Bottle"
        assert payload.notes == "latte"

    def test_create_omitted_category_is_none(self):
        payload = TransactionCreate(
            account_id="acct-1",
            amount=10,
            type="expense",
            date="2026-10-15",
        )
        assert payload.category_id is None

    def test_update_blank_strings_become_none(self):
        payload = TransactionUpdate(
            account_id="",
            category_id="",
            merchant="",
            notes="",
        )
        assert payload.account_id is None
        assert payload.category_id is None
        assert payload.merchant is None
        assert payload.notes is None

    def test_update_valid_category_preserved(self):
        payload = TransactionUpdate(category_id="cat-9")
        assert payload.category_id == "cat-9"


def _fake_txn(**overrides):
    """A transaction stand-in with NO ``account``/``category`` attributes.

    Accessing a relationship here would raise AttributeError, so the test
    fails loudly if ``_enrich`` regresses to touching them.
    """
    attrs = {
        "id": "txn-1",
        "account_id": "acct-1",
        "user_id": "user-1",
        "category_id": "cat-1",
        "auto_rule_id": None,
        "amount": 12.5,
        "type": "expense",
        "description": "Coffee",
        "merchant": "Blue Bottle",
        "date": date(2026, 10, 15),
        "is_recurring": False,
        "notes": None,
        "tags": None,
        "created_at": None,
        "updated_at": None,
    }
    attrs.update(overrides)
    return type("Txn", (), attrs)()


class _Obj:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class TestEnrichIsAsyncSafe:
    @pytest.mark.asyncio
    async def test_enrich_loads_relations_via_get_not_lazy_load(self):
        db = AsyncMock()
        db.identity_map = MagicMock()
        db.identity_map.get = MagicMock(return_value=None)
        db.get = AsyncMock(side_effect=[_Obj(name="Cash", icon=None, color=None),
                                        _Obj(name="Food", icon="🍔", color="#f00")])
        svc = TransactionService(db)

        out = await svc._enrich(_fake_txn())

        assert out["account_name"] == "Cash"
        assert out["category_name"] == "Food"
        assert out["category_icon"] == "🍔"
        assert out["category_color"] == "#f00"
        assert db.get.await_count == 2

    @pytest.mark.asyncio
    async def test_enrich_without_category_skips_category_lookup(self):
        db = AsyncMock()
        db.identity_map = MagicMock()
        db.identity_map.get = MagicMock(return_value=None)
        db.get = AsyncMock(return_value=_Obj(name="Cash", icon=None, color=None))
        svc = TransactionService(db)

        out = await svc._enrich(_fake_txn(category_id=None))

        assert out["account_name"] == "Cash"
        assert out["category_name"] is None
        assert db.get.await_count == 1
