# Architecture

How the system is put together as of **v1.1.0**.

## Shape

A React SPA talking to a FastAPI backend over HTTP, with PostgreSQL as the system of record,
Redis for Celery and token revocation, and a Cloudflare tunnel in front of nginx. Two long-lived
background workers (Celery worker and beat) run alongside the API.

```
Browser
  │  HTTPS via Cloudflare tunnel
  ▼
nginx  ── /            → static React build
       ├─ /api/        → uvicorn  :8000
       ├─ /ws          → uvicorn  :8000  (websocket upgrade)
       └─ /uploads/    → on-disk uploads
  │
  ▼
FastAPI (4 processes under supervisord)
  ├── uvicorn        API + WebSocket
  ├── celery worker  background tasks
  ├── celery beat    task scheduler
  └── nginx          static + reverse proxy
        │
        ├── PostgreSQL 15 + pgvector   system of record
        ├── Redis                       Celery broker, token blacklist
        └── Ollama Cloud               chat, embeddings  (currently failing — see LIMITATIONS)
```

## Data model

12 models, all sharing the same conventions.

**IDs** are `String(36)` holding a UUID4, generated Python-side with
`default=lambda: str(uuid.uuid4())` — never database-side.

**Soft delete** is uniform: every user-owned table has `deleted_at` (nullable timestamp). "Delete"
sets it; reads filter on `deleted_at IS NULL`. Nothing is ever hard-deleted except via sync and
CSV import edge cases.

**Timestamps** use `server_default=func.now()` with `onupdate=func.now()`.

> **Important:** the initial migration made nearly every timestamp, boolean, and numeric column
> `nullable=True`, relying on the Python-side `default=` to populate them. Values inserted by
> paths that bypass the ORM — notably `POST /api/sync/push` — can therefore persist NULLs where
> the code and schemas assume a value. This is the root cause of a class of 500s. See
> [LIMITATIONS.md](LIMITATIONS.md#2-data-integrity-hazards).

| Model | Table | Notes |
|---|---|---|
| `User` | `users` | bcrypt hash, `settings` JSON (currency, onboarding) |
| `Account` | `accounts` | `type` enum, write-through `balance`, `is_archived` |
| `Transaction` | `transactions` | `date` is a DateTime; `is_recurring`, `recurring_id`, `bill_id` |
| `Category` | `categories` | income/expense, icon, color, sort_order |
| `CategoryRule` | `category_rules` | priority, match conditions, confidence, hit/miss counts |
| `Budget` | `budgets` | period daily/weekly/monthly/quarterly/yearly, rollover |
| `RecurringTransaction` | `recurring_transactions` | frequency + interval, `next_date`, `end_date` |
| `Bill` | `bills` | due date, `is_paid`, `file_path`, `ocr_text`, `recurring_id` |
| `Goal` | `goals` | target amount, current, status, milestones |
| `Alert` | `alerts` | 8 types, read/dismiss state, per-type preferences |
| `Memory` | `financial_memories` | pgvector `Vector(1024)`, used by RAG |
| `LoginRecord` | `login_records` | login audit trail |

There is no `ChatConversation` model in `models/`; copilot conversation state lives in Redis with
a TTL set by `CONVERSATION_TTL_HOURS` (24h).

`Account.balance` is maintained **on write**: every transaction create/update/delete adjusts it
inside the same transaction, with `SELECT ... FOR UPDATE` on the account row to serialise
concurrent writes. The Celery recurring job does the same. This is why the projection has to
reverse future-dated transactions to get a true current balance.

## Request flow

A typical authenticated call:

1. `get_current_user` decodes the bearer JWT and checks the Redis blacklist.
2. The route validates input with Pydantic.
3. A service method runs the query. Services own all business logic; routes stay thin and mostly
   just add `response_model`.
4. Schemas serialise the result.

`GET` list routes on envelope endpoints accept `page` (0-based) and `page_size` (0–100);
`page_size=0` means "no limit".

## Background jobs

Celery beat schedule (`backend/app/tasks/__init__.py`):

| Task | Interval |
|---|---|
| `process_recurring_transactions` | hourly (3600s) |
| `generate_alerts` | every 12h (43200s) |
| `detect_goal_spending_conflicts` | every 12h (43200s) |
| `cleanup_old_alerts` | daily (86400s) |
| `cleanup_old_memories` | daily (86400s) |
| `index_unindexed_content` | every 15 min (900s) |

`index_unindexed_content` has no backoff and no dead-lettering: while the Ollama key is invalid
it retries the same rows every 15 minutes indefinitely.

## The AI layer

`copilot_service` runs a LangGraph state machine. Flow:

```
message
  ├─ intent_router.classify_intent  → one of 14 intents
  ├─ context_builder                → assembles the user's financial context
  ├─ if write intent: tools.execute_tool  → mutates the DB
  └─ chat model → streamed response
```

The 14 intents: `spending_query`, `budget_query`, `goal_query`, `bill_query`, `compare_query`,
`account_query`, `income_query`, `create_transaction`, `update_transaction`,
`delete_transaction`, `create_budget`, `create_goal`, `create_category`, `create_account`.

Classification is regex: each intent owns a list of patterns, and **if two or more distinct
intents match, the result is `multi_step`**. That heuristic is why create-intents must require an
imperative verb — a bare noun phrase would collide with the matching query intent and misroute.

`EmbeddingService` generates 1024-dimension embeddings via Ollama and stores them in pgvector for
semantic recall over `memories`. `EmbeddingService` caches its `Authorization` header at
construction, so **rotating `OLLAMA_API_KEY` requires restarting the worker and beat**, not just
uvicorn.

The AI layer currently fails at the 401 — see [LIMITATIONS.md](LIMITATIONS.md#1-the-entire-ai-layer-is-non-functional).

## OCR

`ocr_service` is deliberately defensive about PaddleOCR:

1. In `auto` mode it loads PaddleOCR in a **subprocess** and probes it.
2. If the probe dies — PaddleOCR 3.7 segfaults natively on ARM64, and a segfault cannot be caught
   in-process — the service falls back to EasyOCR.
3. Parsing then extracts `amount`, `date`, and `merchant` with a regex extractor, optionally
   upgraded by the LLM parser (which currently falls back to regex, see above).

Setting `OCR_ENGINE=paddle` skips the probe and will crash the worker on a host where PaddleOCR
segfaults.

## Cashflow projection

Added in v1.1.0. `AnalysisService.get_cashflow_projection()` in
`backend/app/services/analysis_service.py`, exposed at `GET /api/analysis/cashflow`.

**Opening balance.** `Account.balance` includes future-dated transactions, so a naive sum would
overstate what is actually available. `_balance_as_of(account, transactions, as_of)` reverses
every transaction dated after `as_of` to recover the true balance. This helper is shared with
`get_net_worth_trend`, so the two cannot drift apart.

Only `checking`, `savings`, and `cash` accounts count as liquid. `credit` and `loan` balances are
reported separately as liabilities and are **not** netted against available cash.

**Three event sources:**

1. **Recurring transactions**, expanded forward from `next_date` using
   `RecurringService.calculate_next_date()`. This is the *same* method the hourly Celery job uses
   to roll `next_date`, so month-end clamping (Jan 31 → Feb 28) and `end_date` handling are
   identical to the scheduler. Because `next_date` is always the next **un-materialised**
   occurrence, expanding it cannot double-count the transactions the job has already written.
2. **Unpaid bills** due inside the window, with two dedup rules:
   - skipped if `recurring_id` is set, since the recurring expansion already covers it;
   - skipped if a future-dated transaction already links to it via `bill_id`.
3. **Future-dated transactions** that are neither recurring-linked nor bill-linked — things the
   user scheduled by hand.

**Bucketing.** `days <= 31` produces daily buckets; longer windows produce weekly buckets, so a
365-day request returns ~53 points. The bucket builder is a pure static method
(`_build_buckets`) so the boundary logic is unit-testable without a database.

**Lowest point** tracks the trough of the running balance and its day offset, which drives the
overdraw warning in the UI.

## Frontend

React 18 + Vite. State: Zustand for theme and auth, React Query is **not** used. Data fetching is
plain `axios` in `src/services/api.ts`, with each resource exposed as a `xxxApi` object.

Routing via React Router 6. `DashboardLayout` wraps authenticated routes; `Sidebar` provides
navigation (15 items, admin-gated).

18 pages. Shared primitives in `components/ui/`: `DataTable`, `EmptyState`, `LoadingSpinner`,
`Modal`, `PageHeader`, `StatCard`.

Charts use Recharts directly in each page — `ReportsPage` (net worth area chart) and
`CashflowPage` (composed bar + area) are the two charting examples to copy from.

`toList()` is the guard for the envelope/array inconsistency described in
[API.md](API.md#read-this-before-writing-a-client-the-list-endpoint-contract-is-inconsistent).
Every list read must go through it.
