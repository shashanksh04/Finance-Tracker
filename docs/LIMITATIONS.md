# Known limitations

Everything below is a real, current state of the system as of **v1.1.0**. Nothing here is
speculative. If you are evaluating whether a feature is safe to depend on, this is the file to
read first.

---

## 1. The entire AI layer is non-functional

**Severity: high. Affects the largest single block of the product.**

`OLLAMA_API_KEY` in the deployed `.env` is not a valid credential. Every call to Ollama Cloud
returns 401, which has the following effects:

| Feature | Symptom |
|---|---|
| `POST /api/copilot/chat` | 500 |
| `POST /api/copilot/chat/stream` | 500 |
| `POST /api/copilot/simulate` | Degrades gracefully, returns a message instead |
| Automatic insight generation | Has produced **zero** insights, ever |
| Financial memory / RAG | Embeddings fail with 401; retrieval silently returns nothing |
| Goal-spending conflict alerts | Silently never fire |
| OCR LLM parser | Falls back to the regex parser, which works fine |

Three `memories` rows are stuck with no embedding and are retried by Celery beat **every 15
minutes, indefinitely** — there is no backoff and no dead-lettering. The chat service retries
embedding failures three times with a fixed 1s delay, so each failed request takes ~3s longer
than it should.

**To fix:** put a valid `OLLAMA_API_KEY` in `.env`, then restart **all three** supervisord
programs (uvicorn, celery worker, celery beat). Restarting only uvicorn is not enough — the
`EmbeddingService` instance caches the `Authorization` header at construction, so the worker and
beat keep the stale key until they are also restarted.

---

## 2. Data-integrity hazards

**Severity: high. These can permanently break individual records.**

### `POST /api/sync/push` writes NULLs into NOT NULL columns

The push handler copies client values straight onto the model without filtering. Since the
initial migration made nearly every column `nullable=True` (relying on Python-side `default=`
for values that are actually non-nullable by contract), a client can successfully push
`{"priority": null}` and permanently poison that record. Subsequent reads then fail Pydantic
validation and return 500 for that row. See `backend/app/services/sync_service.py`.

### 17 response fields are declared required but are nullable in the database

The same nullable-column decision means schemas declare fields as non-`Optional` that the
database permits to be NULL — a NULL in any of them makes the whole response fail validation.
This is the identical bug class to the `CategoryBreakdown.category_id` 500 that was fixed in
v1.0.1; the same class of fault still exists across account, category, category-rule,
transaction, recurring, goal, alert, memory, and auth schemas.

---

## 3. Correctness gaps in the AI-facing data layer

**Severity: medium.**

- **Copilot tools ignore soft delete.** The 8 finance tools in
  `backend/app/copilot/tools/finance_tools.py` query without `deleted_at IS NULL`, so the
  copilot can report soft-deleted transactions and bills as if they were live. The REST layer
  filters correctly; only the copilot is affected.
- **`GET /api/admin/stats` counts soft-deleted users**, because the count query does not filter
  `deleted_at`.

---

## 4. Not implemented

- **Account transfers.** Rejected with 400 on create, update, and delete. `plans.md` describes
  the intended design; no code exists. This is the most requested missing feature.
- **Weekly budget period.** The endpoint accepts `weekly` and the UI offers it, but until v1.1.0
  it raised `NameError: name 'timedelta' is not defined`. **Fixed in v1.1.0.** No production user
  has a weekly budget, so the fix is unexercised against real data.

---

## 5. PaddleOCR cannot run on ARM64

**Severity: medium, but it is worked around.**

PaddleOCR 3.7's native inference segfaults on the deployment host (Cortex-A76, aarch64). A
segfault cannot be caught in-process, so a naive call would kill the worker. The OCR service
therefore probes PaddleOCR in a subprocess and falls back to EasyOCR 1.7.2.

Consequences:
- `OCR_ENGINE=paddle` will crash the worker on this host. Use `auto` (the default).
- EasyOCR is materially slower than PaddleOCR. Receipt scans take seconds.
- **`Pillow` is unpinned in `requirements.txt`.** EasyOCR 1.7.2 requires `Pillow<11`. A future
  image rebuild that picks up Pillow 11+ will silently break OCR. Pin it before the next
  rebuild — this is a latent time bomb, not a current failure.

---

## 6. Engineering quality gaps

- **No CI.** The 44-test suite runs only when someone runs it. Nothing gates a push or deploy.
- **`npm run lint` does not work.** No ESLint config, no eslint dependency, and no
  `react-app` type script. The command is referenced but unusable. `npx tsc --noEmit` does work
  and is clean.
- **No frontend tests and no frontend test runner.**
- **61 unused imports** across the backend and frontend (measured with `pyflakes`), including two
  Postgres models in `copilot_service.py` that are imported and never referenced.
- **The JS bundle is 1.14 MB** (317 kB gzipped) and is not code-split. Vite warns about it on
  every build. It is a performance issue, not a correctness one.
- `mypy`/`ruff` are not configured.

---

## 7. Database

- **`pgvector` is not verified by any migration.** Migration `a3b8c9d0e1f2` checks for the
  extension, and if it is missing it prints a message and **exits successfully without creating
  the `vector` column**. The memory and RAG layer then fails at runtime while migrations report
  clean. Install the extension and `CREATE EXTENSION vector;` before relying on those features.
- **`deploy.sh` installs bare `postgresql` without pgvector.** On that deployment path the AI
  layer is guaranteed to be broken, and the script's nginx config has no `/ws` block, so
  WebSockets cannot work there either. See [OPERATIONS.md](OPERATIONS.md).
- **`ix_transactions_merchant_trgm` is not a trigram index.** Despite the name, the model
  declares it as a plain b-tree index with no `gin_trgm_ops`, and nothing in the codebase
  references `pg_trgm` or `gin_trgm_ops`. There is no trigram search capability. The index itself
  was missing from every migration until v1.1.0.

---

## 8. Unverified areas

Stated plainly so they are not mistaken for working features:

- **Voice transcription** has never been exercised with real audio. The endpoint validates
  requests correctly and Faster-Whisper is warmed up at startup, but no end-to-end
  transcription has been confirmed.
- **Calendar, net-worth trend, and the AI decision simulator's happy paths** have been smoke
  tested but not verified against reference data.

---

## 9. Fixed in v1.1.0

For completeness, these were broken and are now fixed:

- Weekly budgets returned 500 (`timedelta` was used but never imported).
- The Bills page crashed on every visit — it stored the paginated envelope and called
  `.map()` on it. The identical bug had already been fixed on eight other pages; Bills was
  missed.
- Five indexes declared on models existed in no migration, so none were present in the
  production database.
- `create_goal` in the intent router matched the bare phrase "saving goal", which misrouted
  read-only questions like "how is my saving goal progressing?" to the multi-step handler.
- The 25-test suite could not be executed at all: no `pytest` dependency, no `pytest.ini`, and
  `asyncio` tests unmarked.
