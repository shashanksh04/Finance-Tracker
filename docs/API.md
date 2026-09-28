# API reference

Generated from the live OpenAPI schema, so it reflects what the application actually serves.

**78 REST operations across 51 paths, plus 1 WebSocket** (`/ws`).

Base URL in production: `https://finance.shashankakumar.com`

## Authentication

All endpoints except `/api/health`, `/api/auth/register`, `/api/auth/login`, and
`/api/auth/refresh` require `Authorization: Bearer <access_token>`.

Access tokens live 30 minutes. Refresh tokens live 7 days and rotate on use; the old token is
added to a Redis blacklist. Login is rate limited by slowapi.

## Read this before writing a client: the list-endpoint contract is inconsistent

Seven list endpoints exist and they do **not** return the same shape. This is the single most
common source of bugs against this API — it previously caused a 100% crash on the Bills page.

| Endpoint | Shape |
|---|---|
| `GET /api/accounts/` | `{ "items": [...], "total", "page", "page_size", "total_pages" }` |
| `GET /api/budgets/` | `{ "items": [...], "total", "page", "page_size", "total_pages" }` |
| `GET /api/categories/` | `{ "items": [...], "total", "page", "page_size", "total_pages" }` |
| `GET /api/goals/` | `{ "items": [...], "total", "page", "page_size", "total_pages" }` |
| `GET /api/bills/` | plain array `[...]` |
| `GET /api/recurring/` | plain array `[...]` |
| `GET /api/alerts/` | plain array `[...]` |

Four return a paginated envelope; three return a bare array. **The envelope endpoints are also
the ones with no declared response schema**, so the contract is not discoverable from OpenAPI —
only from the source.

The frontend handles this with a `toList()` helper in `frontend/src/services/api.ts` that accepts
either shape. Use it (or an equivalent) for any new list consumer.

Pass `page=0&page_size=0` to an envelope endpoint to get everything back in one response.

## Response schemas are often undeclared

25 of the 78 operations return no declared JSON schema. That includes all 9 `DELETE` endpoints
(which return `{"message": ...}`), the 4 envelope list endpoints, `/api/sync/pull`,
`/api/sync/push`, `/api/analysis/calendar`, `/api/analysis/net-worth-trend`,
`/api/alerts/generate`, `/api/auth/logout`, `/api/auth/change-password`, and
`/api/copilot/chat/stream`.

The `List shape` column below is `—` for every endpoint other than the seven list routes.

## Cashflow projection (new in 1.1.0)

`GET /api/analysis/cashflow`

| Query param | Default | Range |
|---|---|---|
| `days` | `90` | 7–365 |
| `account_id` | none | restrict to one account; omit to use all liquid accounts |

Windows of 31 days or fewer come back as daily buckets; longer windows are weekly, so a
year-long projection returns ~53 points rather than 365.

```json
{
  "generated_at": "2026-09-28T10:00:00+00:00",
  "start_date": "2026-09-28",
  "end_date": "2026-12-27",
  "days": 90,
  "granularity": "weekly",
  "currency": "USD",
  "opening_balance": 4820.55,
  "liabilities": 1290.0,
  "projected_closing_balance": 3910.20,
  "total_inflow": 5400.00,
  "total_outflow": 6310.35,
  "lowest_point": { "balance": 1120.40, "label": "Nov 02 - Nov 08", "in_days": 41 },
  "is_overdrawn": false,
  "buckets": [
    {
      "label": "Sep 28 - Oct 04",
      "start_date": "2026-09-28",
      "end_date": "2026-10-04",
      "inflow": 1200.0,
      "outflow": 340.5,
      "net": 859.5,
      "closing_balance": 5680.05
    }
  ]
}
```

How the numbers are derived, and the deduplication rules that prevent double counting, are
documented in [ARCHITECTURE.md](ARCHITECTURE.md#cashflow-projection).

## All endpoints

| Method | Path | Response schema | Query params | List shape |
|---|---|---|---|---|
| `GET` | `/api/accounts/` | — | include_archived, page, page_size | envelope |
| `POST` | `/api/accounts/` | AccountResponse | — | envelope |
| `GET` | `/api/accounts/{account_id}` | AccountResponse | — | — |
| `PUT` | `/api/accounts/{account_id}` | AccountResponse | — | — |
| `DELETE` | `/api/accounts/{account_id}` | — | — | — |
| `GET` | `/api/accounts/{account_id}/summary` | AccountSummary | — | — |
| `GET` | `/api/admin/stats` | AdminStatsResponse | — | — |
| `GET` | `/api/alerts/` |  | unread_only, limit | array |
| `POST` | `/api/alerts/generate` | — | — | — |
| `GET` | `/api/alerts/preferences` |  | — | — |
| `PUT` | `/api/alerts/preferences/{alert_type}` | AlertPreferenceResponse | — | — |
| `POST` | `/api/alerts/{alert_id}/dismiss` | — | — | — |
| `POST` | `/api/alerts/{alert_id}/read` | — | — | — |
| `GET` | `/api/analysis/calendar` | — | year, month | — |
| `GET` | `/api/analysis/cashflow` | CashflowProjectionResponse | days, account_id | — |
| `GET` | `/api/analysis/dashboard` | DashboardSummary | — | — |
| `GET` | `/api/analysis/net-worth-trend` | — | months | — |
| `GET` | `/api/analysis/period` | PeriodAnalysisResponse | period, year, month, quarter, account_id, category_id | — |
| `POST` | `/api/auth/change-password` | — | — | — |
| `POST` | `/api/auth/login` | TokenResponse | — | — |
| `POST` | `/api/auth/logout` | — | — | — |
| `GET` | `/api/auth/me` | UserResponse | — | — |
| `PATCH` | `/api/auth/onboarding` | UserResponse | — | — |
| `PUT` | `/api/auth/profile` | UserResponse | — | — |
| `POST` | `/api/auth/refresh` | TokenResponse | — | — |
| `POST` | `/api/auth/register` | TokenResponse | — | — |
| `GET` | `/api/bills/` |  | unpaid_only | array |
| `POST` | `/api/bills/` | BillResponse | — | array |
| `GET` | `/api/bills/{bill_id}` | BillResponse | — | — |
| `PUT` | `/api/bills/{bill_id}` | BillResponse | — | — |
| `DELETE` | `/api/bills/{bill_id}` | — | — | — |
| `POST` | `/api/bills/{bill_id}/upload` | BillUploadResponse | — | — |
| `GET` | `/api/budgets/` | — | active_only, page, page_size | envelope |
| `POST` | `/api/budgets/` | BudgetResponse | — | envelope |
| `GET` | `/api/budgets/{budget_id}` | BudgetResponse | — | — |
| `PUT` | `/api/budgets/{budget_id}` | BudgetResponse | — | — |
| `DELETE` | `/api/budgets/{budget_id}` | — | — | — |
| `GET` | `/api/categories/` | — | type, page, page_size | envelope |
| `POST` | `/api/categories/` | CategoryResponse | — | envelope |
| `POST` | `/api/categories/seed` | — | — | — |
| `GET` | `/api/categories/{category_id}` | CategoryResponse | — | — |
| `PUT` | `/api/categories/{category_id}` | CategoryResponse | — | — |
| `DELETE` | `/api/categories/{category_id}` | — | — | — |
| `GET` | `/api/category-rules/` |  | — | — |
| `POST` | `/api/category-rules/` | CategoryRuleResponse | — | — |
| `GET` | `/api/category-rules/{rule_id}` | CategoryRuleResponse | — | — |
| `PUT` | `/api/category-rules/{rule_id}` | CategoryRuleResponse | — | — |
| `DELETE` | `/api/category-rules/{rule_id}` | — | — | — |
| `POST` | `/api/copilot/chat` | CopilotResponse | — | — |
| `POST` | `/api/copilot/chat/stream` | — | — | — |
| `POST` | `/api/copilot/simulate` | DecisionSimulationResponse | — | — |
| `GET` | `/api/goals/` | — | status, page, page_size | envelope |
| `POST` | `/api/goals/` | GoalResponse | — | envelope |
| `GET` | `/api/goals/{goal_id}` | GoalResponse | — | — |
| `PUT` | `/api/goals/{goal_id}` | GoalResponse | — | — |
| `DELETE` | `/api/goals/{goal_id}` | — | — | — |
| `GET` | `/api/health` | — | — | — |
| `POST` | `/api/import/execute` | ImportResult | — | — |
| `POST` | `/api/import/preview` | ImportPreviewResponse | — | — |
| `GET` | `/api/memories/` |  | memory_type | — |
| `POST` | `/api/memories/` | MemoryResponse | — | — |
| `GET` | `/api/memories/{memory_id}` | MemoryResponse | — | — |
| `PUT` | `/api/memories/{memory_id}` | MemoryResponse | — | — |
| `DELETE` | `/api/memories/{memory_id}` | — | — | — |
| `POST` | `/api/ocr/scan` | OCRScanResponse | — | — |
| `GET` | `/api/recurring/` |  | active_only | array |
| `POST` | `/api/recurring/` | RecurringResponse | — | array |
| `GET` | `/api/recurring/{recurring_id}` | RecurringResponse | — | — |
| `PUT` | `/api/recurring/{recurring_id}` | RecurringResponse | — | — |
| `DELETE` | `/api/recurring/{recurring_id}` | — | — | — |
| `GET` | `/api/sync/pull` | — | last_pulled_at | — |
| `POST` | `/api/sync/push` | — | — | — |
| `GET` | `/api/transactions/` | PaginatedTransactions | account_id, category_id, type, start_date, end_date, min_amount, max_amount, merchant, search, page, page_size, sort_by, sort_order | — |
| `POST` | `/api/transactions/` | TransactionResponse | — | — |
| `GET` | `/api/transactions/{txn_id}` | TransactionResponse | — | — |
| `PUT` | `/api/transactions/{txn_id}` | TransactionResponse | — | — |
| `DELETE` | `/api/transactions/{txn_id}` | — | — | — |
| `POST` | `/api/voice/transcribe` | TranscribeResponse | — | — |

TOTAL_OPERATIONS=78

## WebSocket

`/ws?token=<access_token>` — dashboard updates. The token may be passed as a query parameter
because browsers cannot set headers on a WebSocket handshake. The server accepts the connection
before reading the token, then closes unauthorised sockets.
