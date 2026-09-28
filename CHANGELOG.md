# Changelog

All notable changes to Finance Tracker. Versions follow SemVer.

The three `1.0.1` / `1.0.2` / `1.0.3`-style fix batches below were deployed to production but
were never given release notes at the time; they are recorded here for the first time.

---

## [1.1.0] — 2026-09-28

### Added

- **Cashflow projection** — `GET /api/analysis/cashflow`, `/cashflow` page, sidebar entry.
  Projects the balance forward over 14–365 days from unpaid bills, active recurring
  transactions, and future-dated transactions. Daily buckets for windows ≤31 days, weekly above.
  Reports opening balance, liabilities (un-netted), total in/out, projected closing balance, and
  the lowest projected point with an overdraw warning.
  - Declared with a full `CashflowProjectionResponse` schema rather than left untyped, so the
    contract is discoverable from OpenAPI.
  - `AnalysisService._build_buckets()` and `_balance_as_of()` are pure static methods, covered by
    19 new tests.
- **`AnalysisService._balance_as_of()`** — extracted from `get_net_worth_trend` so the projection
  and the net-worth trend share one implementation of the future-transaction reversal.
- **`RecurringService.calculate_next_date()`** — promoted from private to public so the projection
  and the hourly Celery job roll recurring dates with identical month-end clamping and `end_date`
  handling.
- **Alembic migration `f1a2b3c4d5e6`** — creates the five indexes declared on models but never
  migrated, so they never existed in the production database:
  `ix_bills_user_due_deleted`, `ix_recurring_next_active_deleted`,
  `ix_transactions_user_deleted_date`, `ix_transactions_user_type`,
  `ix_transactions_merchant_trgm`. Idempotent (`if_not_exists=True`) and reversible.
- **A runnable test suite** — `pytest.ini`, `requirements-dev.txt` (kept separate from
  `requirements.txt` so the production image does not ship pytest), and 19 projection tests. The
  suite is now **44 passing**.
- **Documentation** — `docs/API.md` (generated from the live OpenAPI schema),
  `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`, `docs/LIMITATIONS.md`, this changelog, and a
  rewritten `README.md` and `PROJECT_MAP.md`.

### Fixed

- **Weekly budgets returned 500** — `budget_service.py` used `timedelta` without importing it.
- **The Bills page crashed on every visit** — it stored the paginated envelope and called `.map()`
  on it. The identical bug had already been fixed on eight other pages; Bills was missed.
- **`create_goal` intent misrouting** — the intent router matched the bare phrase
  "saving goal", so read-only questions like *"how is my saving goal progressing?"* collided with
  the create intent and were routed to the multi-step handler. Now requires an explicit request
  verb.

### Changed

- Version bumped to `1.1.0` in `config.py`, `package.json`, and `package-lock.json`.
- `PROJECT_MAP.md` corrected: stale Windows path, `REDIS :devpassword`, `supervisord user root`,
  the long-resolved microphone `Permissions-Policy` TODO, "routes 15", "ui 5", and every stale
  file count (models 13→12, schemas 18→17, services 18→17, pages 17→18, migrations 8→9,
  types 293→326 lines).
- `README.md` rewritten as an accurate current-state document, including the correction that
  **pgvector is a hard requirement** — migration `a3b8c9d0e1f2` prints a message and succeeds
  without creating the `vector` column when the extension is missing, breaking the entire
  memory/copilot RAG layer silently.

### Known issues at this release

Documented in [docs/LIMITATIONS.md](docs/LIMITATIONS.md). The most significant:

- **The entire AI layer is non-functional** — `OLLAMA_API_KEY` is invalid, so copilot chat
  returns 500, insights have never been generated, and RAG retrieval silently returns nothing.
  Fixable with a valid key plus recreating the `app` container (all three processes; the
  embedding client caches its auth header).
- `sync/push` can write NULLs into columns the schemas treat as required, permanently breaking
  individual records.
- The copilot's 8 finance tools and the admin user count ignore soft delete.
- Account transfers are not implemented.
- `Pillow` is unpinned and EasyOCR 1.7.2 requires `Pillow<11` — a latent OCR breakage.
- No CI; `npm run lint` is unusable (no ESLint config).

---

## [1.0.3] — 2026-09-28

Never released as a version; reconstructed from commit `3b858f1`.

- **Fixed** `GET /api/categories` returning 422 when filtering by an empty `type`; the client now
  omits the parameter instead of sending `""`.
- **Fixed** WebSockets never connecting — the route read the token before accepting the
  handshake, and the manager called `accept()` twice.
- **Fixed** `CategoryBreakdown.category_id` being declared non-nullable, which 500'd every
  analysis endpoint for users with uncategorised transactions.
- **Fixed** the API-backed container healthcheck and an nginx startup wait that removed
  transient 502s after deploys.
- **Fixed** the CSP blocking the Cloudflare Insights beacon.
- Added `toList()` envelope normalisation across 8 pages.

## [1.0.2] — 2026-09-28

Never released as a version; reconstructed from commit `0516973`.

- **Fixed** total OCR failure — ported to the PaddleOCR 3.x constructor and
  `predict()`/`rec_texts` API, and added a subprocess probe with an EasyOCR fallback so PaddleOCR
  segfaults on ARM64 can no longer kill the worker.
- **Security**: generated a strong `REDIS_PASSWORD`, removed the `devpassword` default, added an
  authenticated Redis healthcheck.

## [1.0.1] — 2026-09-27

Never released as a version; reconstructed from commit `2b09ed6`.

- **Fixed** ARM64 deployment breakage, including a platform-pinned image that would not build.
- Fixed five latent runtime bugs found during the deployment audit.

## [1.0.0]

- Initial tagged release. See git history for the pre-1.0 development line.

---

[1.1.0]: https://github.com/shashanksh04/Finance-Tracker/releases/tag/v1.1.0
