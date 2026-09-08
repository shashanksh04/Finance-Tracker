# Finance Tracker — Project Map

> Web-first (mobile archived). File paths absolute. Generated 2026-09-08.

## 0. Workspace

```
J:\0Main Projects\Finance Tracker\
├── backend\                 # FastAPI + SQLAlchemy + Alembic + Celery
├── frontend\                # Vite + React 18 + TypeScript + Tailwind + Recharts
├── Dockerfile               # multi-stage node → python
├── docker-compose.yml       # db (pgvector) + redis + app
├── nginx.conf               # SPA + proxy /api /ws /uploads
├── supervisord.conf         # nginx + uvicorn(2w) + celery worker/beat
├── entrypoint.sh            # alembic upgrade head → supervisord
├── deploy.sh                # Pi bare-metal (systemd + nginx + cloudflared)
├── .env.example / backend/.env.example
└── README.md                # brief overview only
```

No `docs/`; this file is the detailed map.

---

## 1. Tech Stack

| Layer | Choice | File | Notes |
|-------|--------|------|-------|
| **Frontend** | React 18.3, TypeScript 5.6, Vite 6, Tailwind 3.4, Zustand 5, React Router 6.28, Recharts 2.13, Lucide 0.46, react-markdown 10 + remark-gfm, date-fns 4.1, axios 1.7, react-hook-form 7.54 + zod 3.24, react-hot-toast 2.4 | `frontend/package.json` `frontend/vite.config.ts` `frontend/tailwind.config.js` `frontend/tsconfig.json` | `vite:5173` proxies `/api→8000 /ws ws://8000 /uploads→8000` `tailwind darkMode class primary sky surface slate` `Inter` |
| **Backend** | Python 3.12, FastAPI ≥0.110, Uvicorn[standard], Pydantic 2.7 + pydantic-settings, SQLAlchemy 2.0, Alembic 1.13, asyncpg 0.29 + psycopg2-binary, python-jose[cryptography], passlib[bcrypt] + bcrypt 4, slowapi 0.1.9, celery[redis] 5.4 + redis 5.1, httpx 0.27, pgvector 0.3, langgraph 0.2 + langchain-core 0.3 + langchain-ollama 0.2, paddleocr 2.8.1 + paddlepaddle 2.6.1 + easyocr 1.7.1 + PyMuPDF 1.24 + Pillow 10, pandas 2.2 + matplotlib + seaborn + plotly + openpyxl, faster-whisper 1.0, python-dateutil, email-validator | `backend/requirements.txt` | `slowapi` limiter 1000/m + 5/m register 10/m login 30/m copilot 20/m ocr/voice/import 60/m transactions |
| **DB** | PostgreSQL 15+ + pgvector `pg16` `Vector(1024) ivfflat lists 100` | `docker-compose.yml:db pgvector/pgvector:pg16` `backend/alembic/versions/a3b8c9d0e1f2_add_pgvector_support.py` `backend/app/models/memory.py:18 Vector(1024)` | Async `asyncpg` + sync `psycopg2` for Alembic; pool `10/20 pre_ping recycle 3600 timeout 30 statement_timeout 30s` |
| **Cache/Queue** | Redis 7-alpine, Celery beat every 3600/43200/900s | `docker-compose.yml:redis` `backend/app/tasks/__init__.py` `backend/app/tasks/scheduled_tasks.py` | broker `0` result `1/2` |
| **AI** | Ollama Cloud `gpt-oss:120b-cloud` @ `https://ollama.com` (api_key), Embedding `mxbai-embed-large` dim 1024 `CONVERSATION_TTL 24h`, Whisper `base.en cpu auto` (language auto) `faster-whisper` | `backend/app/core/config.py:24` `backend/app/copilot/agents/base.py` `backend/app/embeddings/embedding_service.py` `backend/app/services/whisper_service.py` `backend/app/services/ocr_service.py` | No sentence-transformers; Ollama `/api/chat` + `/api/embed` via `httpx` |
| **Auth** | JWT HS256 `HS256` access 30m (jti) refresh 7d (jti) + Redis `token_blacklist:{jti}` + refresh rotation + logout blacklist both, bcrypt | `backend/app/core/security.py` `backend/app/api/deps.py` `backend/app/services/auth_service.py:89` `backend/app/api/routes/auth.py:39` | `get_current_user` checks `deleted_at is_active` |
| **Infra** | Docker multi-stage, Nginx 50M, Supervisor 4 procs, Systemd Pi, Cloudflare Tunnel | `Dockerfile` `nginx.conf` `supervisord.conf` `entrypoint.sh` `deploy.sh` | `EXPOSE 80` → uvicorn `127.0.0.1:8000` 2 workers |

---

## 2. Schemas (Pydantic v2) — `backend/app/schemas/*.py`

| File | Key Models | Validation |
|------|------------|------------|
| `schemas/auth.py` | `UserCreate(email EmailStr, password 8+ upper/lower/digit/special, full_name)` `UserLogin` `TokenResponse(access,refresh,token_type=bearer)` `TokenRefresh` `UserResponse(is_admin,is_verified,onboarding_completed,settings)` `ChangePassword` `UpdateProfile(settings whitelist currency/notifications/theme/language)` | strong pwd regex |
| `schemas/account.py` | `AccountCreate(name max100 type checking/savings/credit/investment/cash/loan/other balance currency USD icon/color)` `AccountUpdate(name/type/currency/icon/color/is_archived, no balance overwrite)` `AccountResponse + Summary(total_income/expenses/count)` | pattern `loan\|other` added |
| `schemas/category.py` | `CategoryCreate(name 1-80 ^\S type income\|expense icon/color/parent_id/sort_order 0-10000)` `CategoryUpdate` `CategoryResponse + WithChildren` | type enum |
| `schemas/transaction.py` | `TransactionCreate(account_id category_id? amount gt0 type income\|expense\|transfer description merchant? date notes? tags is_split)` `TransactionUpdate(amount gt0 type pattern description 1-500 merchant 120 notes 2000)` `TransactionResponse + PaginatedTransactions(page,page_size,total,total_pages)` | `_escape_like` for search |
| `schemas/category_rule.py` | `CategoryRuleCreate(category_id contains_keyword merchant_name min/max priority)` `RuleResponse(confidence hit/miss last_matched)` |  |
| `schemas/budget.py` | `BudgetCreate(category_id? amount gt0 period weekly\|monthly\|quarterly\|yearly start_date end_date? rollover)` `BudgetUpdate(amount gt0 period pattern)` `BudgetResponse(spent/remaining/percentage)` | weekly added |
| `schemas/recurring.py` | `RecurringCreate(amount gt0 type income\|expense description merchant frequency daily/weekly/biweekly/monthly/quarterly/yearly interval_value 1-365 next_date end_date)` `RecurringUpdate` similarly | interval 1-365 |
| `schemas/goal.py` | `GoalCreate(name target>0 current deadline category_id icon/color monthly_contribution notes)` `GoalResponse(progress%,days_remaining,suggested_monthly)` |  |
| `schemas/alert.py` | `AlertCreate(type title message severity info category_id? related_amount?)` `AlertPreferenceUpdate(enabled,threshold?)` `AlertResponse` | 8 types |
| `schemas/bill.py` | `BillCreate(name amount gt0 due_date file_path ocr_text is_paid paid_date category_id recurring_id notes)` `BillUploadResponse(extracted_ confidence)` | upload ALLOWED_EXT pdf/png/jpg/bmp/tiff 10MB |
| `schemas/memory.py` | `MemoryCreate(key value context? memory_type importance)` `MemoryResponse` |  |
| `schemas/copilot.py` | `CopilotRequest(message session_id? history context_type?)` `CopilotResponse(reply session_id suggested_actions insights agent_trace proposed_actions: ProposedAction(id,action_type,summary,payload))` `DecisionSimulationRequest/Response(impact_analysis recommendations risk low/med/high projected_outcome)` |  |
| `schemas/analysis.py` | `PeriodAnalysisRequest(period yearly/quarterly/monthly year month? quarter? account/category)` `SpendingTrend` `CategoryBreakdown` `PeriodAnalysisResponse` `DashboardSummary(total_balance monthly_income/expenses net_worth_change budget_health recent upcoming alerts goal_progress spending_by_category)` `NetWorthTrend` `Calendar` |  |
| `schemas/import_schema.py` | `ColumnMapping` `ImportOptions(delimiter whitelist ,; tab | : date_format default_account/category skip_first_row create_missing)` `PreviewRow` `ImportPreviewResponse` `ImportResult` | delimiter validated |
| `schemas/common.py` | `PaginatedResponse[T](items total page page_size total_pages)` | generic |
| `schemas/admin.py` | `DailyLoginCount` `AdminStats(total_users today daily[])` |  |

---

## 3. Routes — `backend/app/api/routes/*.py` (`/api/*`, `/ws`)

| File | Prefix | Methods |
|------|--------|---------|
| `auth.py` | `/api/auth` | `POST /register 5/m`, `POST /login 10/m`, `POST /refresh`, `POST /logout` (blacklist access 30m + refresh 7d via body), `GET /me`, `PUT /profile` (whitelist), `POST /change-password`, `PATCH /onboarding` |
| `accounts.py` | `/api/accounts` | `GET /?include_archived& page(0 wrapped→items/total/page1)`, `POST /`, `GET /{id}`, `GET /{id}/summary`, `PUT /{id}`, `DELETE /{id}` soft + bulk `transactions/recurring deleted_at+updated_at` + `dashboard notify` |
| `categories.py` | `/api/categories` | `GET /?type=income\|expense&page`, `POST /`, `POST /seed`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` |
| `category_rules.py` | `/api/category-rules` | `GET /`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` |
| `transactions.py` | `/api/transactions` | `GET /?account/category/type/start/end/min/max/merchant/search& sort whitelisted& page1 + page_size 50 (escape `_escape_like`)`, `POST / 60/m`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` (soft `FOR UPDATE` `Decimal` balance refund) |
| `budgets.py` | `/api/budgets` | `GET /?active_only&page`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` soft |
| `recurring.py` | `/api/recurring` | `GET /?active_only`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` |
| `goals.py` | `/api/goals` | `GET /?status&page`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` |
| `alerts.py` | `/api/alerts` | `GET /?unread_only&limit`, `POST /{id}/read` + `alert_read` ws, `POST /{id}/dismiss` + `alert_dismissed`, `GET /preferences` (deleted filter), `PUT /preferences/{type}`, `POST /generate` |
| `bills.py` | `/api/bills` | `GET /?unpaid_only`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`, `POST /{id}/upload` multipart ALLOWED_EXT 10MB sanitized `ocr_text` |
| `memories.py` | `/api/memories` | `GET /?memory_type`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` |
| `analysis.py` | `/api/analysis` | `GET /dashboard` (parallel gather), `GET /period`, `GET /net-worth-trend?months`, `GET /calendar?year&month` (cast extract) |
| `copilot.py` | `/api/copilot` | `POST /chat 30/m`, `POST /chat/stream 30/m SSE`, `POST /simulate 20/m` |
| `ocr.py` | `/api/ocr` | `POST /scan 20/m` multipart pdf/png/jpg/bmp/tiff → `OCRService.extract_text` + `parse_bill_text` → `OCRScanResponse` (finally unlink) |
| `import_routes.py` | `/api/import` | `POST /preview 20/m`, `POST /execute 20/m` (Form `options` JSON, delimiter whitelist, 10MB, `uploads/import/{uuid}.ext`) |
| `voice.py` | `/api/voice` | `POST /transcribe 20/m` multipart 25MB `WhisperService.transcribe` |
| `sync.py` | `/api/sync` | `GET /pull?last_pulled_at` (epoch vs `updated_at >= last`), `POST /push {changes:{table:{created/updated/deleted}}}` whitelist per table, `updated_at` server bump |
| `admin.py` | `/api/admin` | `GET /stats` (require `is_admin`) |
| `ws.py` | `/ws` | WebSocket: receive `{"token":access}` first, no double accept, `is_token_blacklisted` check, `manager.connect` `asyncio.Lock` |
| `main.py` | `/api/health` | `{status:healthy, version}`; `lifespan` warmup OCR+Whisper threads; `CORSMiddleware` filtered `exp://*`, `SlowAPIMiddleware` via `auth.limiter` |

**Deps:** `backend/app/api/deps.py` `HTTPBearer(auto_error=False)` `get_current_user` 401 + `deleted_at/is_active` + blacklist; `get_optional_user` returns None.

---

## 4. Services — `backend/app/services/*.py`

| File | Responsibilities |
|------|-----------------|
| `auth_service.py` | `register` `select deleted_at` + `IntegrityError` handle, seed 10+8 categories + Cash INR + `LoginRecord`, `login` checks `deleted_at/is_active`, `refresh_token` blacklist + rotation + `is_active` check, `update_profile` whitelist settings |
| `account_service.py` | CRUD, `get_all` wrapped `{items,total,page1}` `max(1)`; `delete` bulk soft `deleted_at+updated_at` where `deleted_at is None`; `get_summary` 3 sums `deleted_at` |
| `category_service.py` | CRUD `deleted_at` ordered `sort_order` wrapped pagination |
| `category_rule_service.py` | `match_transaction` `deleted_at` filter, `record_hit` `+0.05` max1, `learn_from_correction` `-0.15` disable <0.2 + create merchant/first-word 0.6 |
| `transaction_service.py` | `create` `SELECT FOR UPDATE` `Decimal` `+income/-else` + `record_hit`; `get_filtered` `joinedload` `VALID_SORT` `_escape_like` escape `\` + fallback enrich uses relation cache; `update` same-account single lock `refund+charge`; `delete` soft + refund `FOR UPDATE` |
| `budget_service.py` | CRUD wrapped; `_enrich_batch` groups by `(start,end)` anchored on `budget.start_date` (weekly `weekday`, monthly `replace day1`, quarterly, yearly) then batch `SUM` per `category_id` + `uncat` → `spent/remaining/percentage` |
| `recurring_service.py` | CRUD; `process_due` `FOR UPDATE SKIP LOCKED` creates `Transaction is_recurring` + `balance +=/- amt` per account + `next_date` calendar daily/weekly/biweekly/monthly/quarterly/yearly |
| `goal_service.py` | CRUD wrapped; `_enrich` `progress% days_remaining suggested_monthly=remaining/days*30` |
| `alert_service.py` | `get_alerts` `deleted_at`; `mark_read/dismiss` `deleted_at`; `get_preferences` 8 defaults; `generate_alerts` budget >90% → `budget_exceeded`, bill ≤7d → `bill_due`, goal 100% → `goal_milestone` via `_already_active` dedup |
| `bill_service.py` | CRUD; `upload_file` deleted filter, ALLOWED_EXT 6, 10MB, `aiofiles` write `uploads/bills/{id}{ext}` `OCRService` |
| `memory_service.py` | CRUD `deleted_at`; `cleanup_old_memories` hard-delete soft>30d + soft-delete excess `conversation/insight>100` via `updated_at` |
| `analysis_service.py` | `get_period_analysis` → `_analyze_period` → `_sum_with_filter/_count/_category_breakdown/_trends(parallel gather)/_top_merchants`; `get_dashboard_summary` parallel `income/expenses/breakdown/accounts`; `get_net_worth_trend` reverse balances per `account.type credit` liability; `get_calendar` cast `extract(day)` daily income/expense/count + bills |
| `sync_service.py` | `SYNC_TABLES 11` `MODEL_MAP` `SYNC_WRITABLE_FIELDS` whitelist per table + `PROTECTED` `balance/user_id`; `pull` initial `deleted_at is None` else `updated_at >= last` + partition `created >= last` else `updated` excluding `deleted_at>=last`; `push` filtered `id+writable` `user_id` injected `deleted_at None` `updated_at` server bump LWW `client_dt>server`; `deleted` soft `deleted_at now` |
| `ocr_service.py` | PaddleOCR `det 0.3` + EasyOCR fallback, `_preprocess_image` RGBA→RGB 960 JPEG, `_extract_pdf` fitz text else pixmap locked `load_page` save tmp 4 workers, `_call_llm_parse` sanitize `isprintable` `Ignore instructions`, regex fallback amount/date/merchant confidence `score/3` |
| `whisper_service.py` | `WhisperModel(base.en cpu auto)` singleton `threading.Lock` warmup `transcribe(data,ext)` temp file `vad_filter` `language or None` via executor |
| `import_service.py` | CSV `allowed_delims ,; \t | :` 10MB `openpyxl` pandas, `detect_mapping` fuzzy >=0.4, `_parse_row` dateutil `COMMON_FORMATS` + amount `()/-` + `CURRENCY_SYMBOLS`, `_resolve_account/category` ilike `create_missing`, `execute` `FOR UPDATE` balance `Decimal` per row |
| `goal_spending_service.py` | `detect_goal_spending_conflicts` month surplus vs `suggested_monthly*2` → embed `FinancialMemory goal_conflict_{id}_{today}` |
| `core/config.py` | `Settings(BaseSettings)` `SECRET_KEY ""` `ALGORITHM HS256` `ACCESS 30m REFRESH 7d` `REDIS :devpassword` `OLLAMA https://ollama.com gpt-oss:120b-cloud` `EMBED mxbai-embed-large 1024 TTL24` `WHISPER base.en cpu auto` `UPLOAD uploads` `CORS http://localhost:5173,8081` `LOG INFO` `env_file .env` `cors_origins_list` filter `exp://*` |
| `core/database.py` | `create_async_engine pool 10/20 pre_ping recycle 3600 timeout30 statement_timeout30s idle60s reset rollback` `async_sessionmaker expire_on_commit False` `get_db` yields `commit/rollback` finally `close` |
| `core/security.py` | `BLACKLIST token_blacklist:` `hash/verify bcrypt` `create_access/refresh jti+sub+exp+type HS256` `decode_token TokenPayload` `is_token_blacklisted/blacklist_token SETEX` |
| `core/redis.py` | `aio from_url decode retry` singleton `asyncio.Lock` cached `_init_exc` `get_redis ping` `close_redis` |
| `core/currency.py` | `CURRENCY_SYMBOLS USD$ EUR€ GBP£ INR₹ JPY¥ CAD C$...` `get_symbol/code from user.settings.currency default USD` |
| `core/authenticated_static.py` | `AuthenticatedStaticFiles(StaticFiles)` `authorization Bearer type access not blacklisted` `unquote normpath re ^/uploads/bills/([^/]+)` `UUID` check `Bill deleted_at` `owner == sub` else 403 |
| `ws/ws_manager.py` | `ConnectionManager _connections dict list asyncio.Lock` `connect accept async lock` `disconnect async _async_disconnect` `send_personal_message broadcast snapshot dead prune` |
| `tasks/__init__.py` | `Celery finance_tracker json UTC beat: recurring 3600 alerts 43200 cleanup 86400 index15m 900 goal 43200 memories 86400` |
| `tasks/scheduled_tasks.py` | `_run_async` `get_running_loop → ThreadPool(1).submit(asyncio.run timeout300) else asyncio.run`; tasks `process_recurring _process_recurring commit`, `generate_alerts per user`, `cleanup_old_alerts delete where deleted null`, `index_unindexed batch50`, `detect_goal_conflicts per user`, `cleanup_old_memories per user` |

---

## 5. Models — `backend/app/models/*.py` (all `id String36 uuid` `deleted_at created_at now updated_at onupdate`)

| File | Table | Columns | Indexes/Relations |
|------|-------|---------|-----------------|
| `user.py` | `users` | `id email unique idx password_hash full_name is_active is_admin server_default false is_verified onboarding_completed settings JSON deleted_at created_at updated_at` | `accounts, transactions, budgets, categories, goals, alerts, memories, bills, recurring` |
| `account.py` | `accounts` | `id user_id name type balance Numeric14,2 currency USD icon color is_archived deleted` | `transactions, recurring` |
| `category.py` | `categories` | `id user_id name icon color type parent_id sort_order deleted` | self `parent/children` |
| `transaction.py` | `transactions` | `id account_id user_id category_id amount type description merchant date is_recurring recurring_id bill_id auto_rule_id notes tags JSON is_split parent_split_id deleted` + `Index ix_transactions_user_deleted_date, ix_transactions_merchant_trgm, ix_transactions_user_type` | `account,user,category,recurring,bill` |
| `category_rule.py` | `category_rules` | `id user_id category_id contains_keyword merchant_name min/max priority is_active confidence 0.5 hit_count miss_count last_matched deleted` |  |
| `budget.py` | `budgets` | `id user_id category_id amount period weekly\|monthly\|quarterly\|yearly start_date end_date is_active rollover deleted` |  |
| `recurring.py` | `recurring_transactions` | `id user_id account_id category_id amount type description merchant frequency interval_value next_date end_date is_active deleted` + `Index ix_recurring_next_active_deleted` |  |
| `goal.py` | `goals` | `id user_id name target current deadline category_id icon color status active monthly_contribution notes deleted` |  |
| `alert.py` | `alerts` + `alert_preferences` | `Alert id user_id type title message severity category_id related_amount is_read is_dismissed deleted` + `AlertPreference id user_id alert_type enabled threshold deleted` + `Index ix_bills_user_due_deleted on bills` |  |
| `bill.py` | `bills` | `id user_id name amount due_date file_path ocr_text is_paid paid_date category_id recurring_id notes deleted` |  |
| `memory.py` | `financial_memories` | `id user_id key value context embedding JSON embedding_vector Vector1024 memory_type importance 0.5 deleted` | `ivfflat vector_cosine` |
| `login_record.py` | `login_records` | `id user_id idx created_at TZ now idx` |  |

**Alembic chain:** `172d2ca5cae9_initial` → `1375a454 onboarding` → `1f42e1b7 server_default` → `f279aac Cash INR` → `a3b8c9d0e1f2 pgvector vector(dim)` → `b4c5d6e7f8g9 deleted_at updated_at ix_updated_at` → `d5e6f7 is_admin login_records` → `e6f7a8b categorization learning fields` + model indexes `ix_transactions_*` etc.

---

## 6. Copilot — `backend/app/copilot/*` + `backend/app/embeddings/*`

| File | Role |
|------|------|
| `copilot_service.py` | `StreamingCallbackHandler(queue token/status)` `_build_state(message user session_id messages[-5] financial_context intent is_fast_path plan scratchpad final_response next_node proposed_actions)` `chat graph.ainvoke` → `CopilotResponse` `chat_stream SSE session_id status token actions done` polls queue 0.3s + cancels task finally opens fresh `async_session_factory` for `run_insights` |
| `graph.py` | `StateGraph(CopilotState)` `input_parser→context_builder→router --fast? financial_data : supervisor --conditional financial_data\|analysis\|advisor\|response_emitter → response_emitter → END` shared `proposed_actions` list |
| `state.py` | `TypedDict CopilotState` |
| `intent_router.py` | regex 15 intents `spending/budget/goal/bill/compare/account/income/create_transaction/update/delete/create_budget/goal/category/account/mark_bill_paid` `classify multi_step` |
| `agents/base.py` | `create_llm(callbacks?) ChatOllama model base_url temp0.1 num_predict2048 api_key` `dicts_to_langchain` `create_tools 9 finance +8 action` |
| `tools/finance_tools.py` | `get_spending_by_category(period type category?)` `get_budget_health` `get_recent_transactions` `get_upcoming_bills(days)` `compare_periods(a,b category)` `get_goal_progress` `get_goal_spending_impact` `get_accounts` `get_income_summary(period account_name)` each `_escape_like` `ilike escape \` `get_currency_symbol` |
| `tools/action_tools.py` | `make_action_tools(db,user_id,user,proposed_actions)` → `_escape_like _cc _money _parse_date _append_action(id act_* redis 86400)` `_resolve_category_id exact deleted` `_resolve_account_id exact` `_default_account most-used COUNT transactions` `_find_transactions/_find_bill` 8 tools `create_transaction/update/delete/create_budget/create_goal/create_category/create_account/mark_bill_paid` all validate `amount>0 type whitelist` `_money` summary → `Proposed but NOT executed` (no DB write) |
| `nodes/input_parser.py` | redis `conversation:{user}:{session}` TTL24 append user msg uuid |
| `nodes/context_builder.py` | `asyncio.gather` `_income/expense this/last month _top_categories _accounts _budgets _goals _bills _memories hybrid_search top4` strings symbol month ranges budgets goals need $/mo bills memories `format_context` |
| `nodes/router.py` | `is_fast_path` if direct intent |
| `nodes/supervisor.py` | LLM `with_structured_output(SupervisorPlan)` picks `next_node` fallback advisor |
| `nodes/financial_data_agent.py` | `llm.bind_tools(tools)` loop 3 tool calls must-use-tools scratchpad |
| `nodes/analysis_agent.py` | `analyze_period` `compare_periods_tool` loop 3 |
| `nodes/advisor_agent.py` | no tools friendly advice currency-aware |
| `nodes/response_emitter.py` | persist `conversation trimmed10` TTL `EmbeddingService.embed Q: … A: …[:500]` → `FinancialMemory conversation 0.5` |
| `nodes/insight_generator.py` | fire-and-forget after stream: if has transactions compute surplus goal lines → Ollama JSON array 1-2 insights → `FinancialMemory insight 0.4` |
| `rag_engine.py` | `retrieve top5 min0.3` `pgvector <=> cosine` fallback in-memory `hybrid_search` keyword `ilike` |
| `indexer.py` | `index_memory/transaction/bill reindex_user index_unindexed batch50 dual write embedding JSON + vector(1024)` |
| `embeddings/embedding_service.py` | `httpx AsyncClient 60s` `POST OLLAMA_BASE_URL/api/embed {model,input:text}` → `embeddings[0]` `embed_batch cosine_similarity` `mxbai-embed-large 1024` |

---

## 7. Frontend — `frontend/*`

| File | Purpose |
|------|---------|
| `package.json` | `finance-tracker 1.0 type module` scripts `dev/vite build/tsc -b vite build/preview/lint` deps `react18 react-dom zustand5 axios react-hook-form @hookform/resolvers zod react-hot-toast lucide recharts date-fns clsx react-markdown remark-gfm @tailwindcss/typography` dev `vite6 @vitejs/react tailwind3 postcss eslint9 typescript5.6` |
| `vite.config.ts` | `@vitejs/plugin-react` `5173` proxy `/api→8000 /ws ws://8000 /uploads→8000` |
| `tailwind.config.js` `postcss.config.js` `index.html` `src/index.css` | `darkMode class` `primary sky surface slate` `Inter JetBrains` animations `fade/slide/scale/pulse` `typography` `Inter 300-700` `card btn-primary input badge stat modal sidebar page progress table scrollbar` |
| `tsconfig.json` | `ES2020 bundler react-jsx strict @/* → ./src/*` |
| `src/main.tsx` | `BrowserRouter v7` `theme-storage` dark `documentElement.dark` `Toaster top-right 4s` |
| `src/App.tsx` | `ProtectedRoute` preserves `location.state.from` `isLoading` `border-2 border-t-transparent animate-spin` `AdminRoute` checks `user.is_admin` else `/` ; `useEffect tokenKey = tokens?.access_token` avoid double `loadUser`; routes `/login /register / →DashboardLayout index Dashboard /transactions/.../admin` + `* → /` |
| `src/store/authStore.ts` | zustand `persist auth-storage {user,tokens,isAuthenticated}` `login/register/logout/loadUser` `authApi` |
| `src/store/themeStore.ts` | `darkMode toggle` `documentElement.classList toggle` |
| `src/types/index.ts` | `User AdminStats Account+Summary Category+WithChildren Transaction+Paginated Budget Recurring Goal Alert Preference Bill FinancialMemory DashboardSummary PeriodAnalysis NetWorth Calendar AuthTokens ProposedAction` |
| `src/services/api.ts` | `axios /api` auth interceptor single-flight `pendingRefresh` + `getStoredTokens try` + raw `axios.post /api/auth/refresh` + queue + `clearAuth` flag + `Url includes /auth/refresh/login` bypass; groups `authApi accountsApi categoriesApi categoryRulesApi transactionsApi budgetsApi recurringApi goalsApi alertsApi billsApi memoriesApi ocrApi scan voiceApi transcribe analysisApi copilotApi chat chatStream(SSE fetch single-flight 401 refresh + `onDone` always + buffer remainder + `token/status/actions/error/done`) onboardingApi adminApi importApi preview/execute FormData |
| `src/services/voice.ts` | `getVoiceEngine browser>backend` `pickMimeType webm/ogg/mp4` `transcribeAudio blob` `startBackendRecording getUserMedia MediaRecorder chunks` `startBrowserRecognition en-US continuous false` `startVoice` |
| `src/hooks/useApi.ts` | `useApi<T> data isLoading error execute(apiCall,showSuccess?) toast getErrorMessage` (dead code) |
| `src/hooks/useWebSocket.ts` | `getWsUrl protocol wss/ws` `useWebSocket(handlers, deps)` refs `ws, reconnectTimeout, handlers, shouldReconnect, attempt` exponential `min(30000, 1000*1.6^attempt)+rand` `ws.send {token}` `onmessage JSON event/data` `onclose re-arm if shouldReconnect` `onerror close` cleanup `shouldReconnect=false + clear + close` deps `depsRef` |
| `src/utils/format.ts` | `CURRENCY_LOCALE 10` `formatCurrency(ZeroDecimal KRW/VND 0 else 2, Intl try catch fallback "CUR amount")` cached `cachedCurrency` `getDefaultCurrency localStorage auth-storage INR` `CURRENCIES 10` `formatDate parseISO` `formatRelativeTime distanceToNow` `formatPercentage getAccountTypeColor getSeverityColor cn getInitials getErrorMessage detail string/array/object` |
| `src/utils/validation.ts` | `zod login/register(8+ upper/lower/digit/special) account(type loan/other balance min0 max1e12) transaction(account_id amount positive max1e12 type description trim500 merchant120 date ISO notes2000) budget(weekly/monthly/quarterly/yearly start_date ISO) goal(name trim 200 target max1e12 deadline ISO) bill category recurring(interval 1-365) profile/password` |
| `src/utils/tts.ts` | `muted isTtsSupported stripMarkdown speak rate1.05 voice en-US/GB cancelSpeech` `voiceschanged` fix pending |
| `src/components/layout/DashboardLayout.tsx` `Sidebar.tsx` `TopBar.tsx` | `DashboardLayout flex surface50 OnboardingOverlay Sidebar TopBar Outlet`; `Sidebar w64 14 nav + Admin Shield is_admin AI promo mobile overlay`; `TopBar h16 sticky hamburger search →/transactions?search= bell unread `alertsApi.getAll(true,50) items ?? total` ws alerts_updated/read/dismissed user initials dropdown` |
| `src/components/ui/*` | `Modal role dialog aria-modal aria-labelledby size sm/md/lg lock body Esc focus restore` `PageHeader StatCard label/value/change/icon color 6 Trending Table generic DataTable empty pagination EmptyState Inbox LoadingSpinner border-t-transparent` |
| `src/components/ErrorBoundary.tsx` `ActionConfirmCard.tsx` `import/ImportModal.tsx` `onboarding/OnboardingOverlay.tsx` | `ErrorBoundary class` `ActionConfirmCard badge Awaiting busy Loader2 Approve Check Reject` `ImportModal 4-step drag&drop csv/txt/xlsx/xls preview detected_mapping rows max-h72 step Check` `OnboardingOverlay 10 steps Welcome…All Set quick links dots Skip/Prev/Next` |
| `src/pages/*.tsx` | `Login/Register split gradient neha easter-egg`; `Dashboard 318L Bar Pie Recent Upcoming Goal Alerts ws`; `Transactions 288L paginated 20 filter search/type/account reset page=1 abort DataTable OCR scan 10MB allowed ext validation + transcribing reset value + confirm amount>0 description trim ImportModal`; `Accounts 152L grid 7 currencies CURRENCIES full 10, 12/p page cards color15`; `Categories 162L expense/income 10 colors seed`; `Budgets 170L start_date anchored weekly monday quarterly`; `Goals 169L`; `Bills 267L overdue red 7d amber paid opacity markPaid createTx`; `Recurring 188L`; `Analysis 187L Area Pie`; `Reports 118L net worth Area`; `Calendar 166L parseISO slice billsByDay income/expense`; `Copilot 375L streaming messages sessionId pendingActions voiceMode muted recording transcribing speak cancel startVoice __mic_denied__ Abort buffer remainder onDone` `Alerts 138L severityIcons ws preferences Threshold Intl currency`; `Settings 219L tabs profile currency grid radio 10 CURRENCIES security password appearance Sun/Moon logout useEffect sync currencyCode reset profile`; `Admin 94L stats bar` |
| `src/App.tsx` routing | see above |

**Cross-cutting:** dark class persist `surface dark grid #1e293b tooltip #0f172a` toast dark `#065f46`; hook-form zod error `text-xs red-500` disabled `isSubmitting`; `getErrorMessage` standard; currency `settings.currency INR` fallback; OCR two flows `ocrApi.scan` vs `billsApi.upload` verify; TTS `speak` after stream `done` voiceMode; onboarding `!onboarding_completed && !dismissed` 10 steps.

---

## 8. Deployment

| File | Details |
|------|---------|
| `Dockerfile` | Stage1 `node:20-alpine npm ci && build → /app/dist`; Stage2 `python:3.12-slim-bookworm + nginx supervisor ffmpeg libgomp1` `user app` `pip no-cache` `COPY backend /app/backend` `COPY dist /var/www/finance-tracker` `COPY nginx/supervisord/entrypoint` `mkdir /var/lib/nginx/body… chown -R app` `sed pid/error/access → /var/www/finance-tracker/nginx*.log` `WORKDIR /app/backend USER app EXPOSE 80 ENTRYPOINT /entrypoint.sh` **no `--platform`** |
| `docker-compose.yml` | `db pgvector/pg16 healthcheck pg_isready -U finance_user -d finance_db interval10 timeout5 retries5` `redis 7-alpine redis-server --requirepass ${REDIS_PASSWORD} healthcheck redis-cli incr ping` `app build . 80:80 uploads:/var/www/finance-tracker/uploads env DATABASE_URL asyncpg finance_user:${DB_PASSWORD}@db:5432/finance_db + SYNC psycopg2 + REDIS :${REDIS_PASSWORD}@redis:6379/0-2 + SECRET_KEY + CORS https://finance.shashankakumar.com,neha...,http://localhost:5173,8081 + OLLAMA https://ollama.com gpt-oss:120b-cloud + EMBED mxbai 1024 TTL24 depends_on condition service_healthy restart unless-stopped` volumes `pgdata uploads` |
| `nginx.conf` | `listen 80 _ client_max_body 50M root /var/www/finance-tracker index index.html` headers `nosniff DENY X-XSS Referrer CSP default-src self script self style self unsafe-inline fonts.googleapis font.gstatic img self data connect self wss: https://ollama.com Permissions-Policy camera=(self),microphone=(self),geolocation=() Cache-Control no-cache` `location /api/ proxy_pass 127.0.0.1:8000 http1.1 Upgrade Connection $connection_upgrade Host X-Real-IP X-Forwarded-For X-Forwarded-Proto Host read/send 180s` `location /ws proxy 127.0.0.1:8000 http1.1 Upgrade $connection_upgrade Host read 86400s` `location /uploads/ proxy 127.0.0.1:8000/uploads/` `location / try_files $uri /index.html` `location =/health 200 ok` |
| `supervisord.conf` | `nodaemon user root logfile /dev/null` `program:nginx user root daemon off` `program:uvicorn bash -c uvicorn app.main:app 127.0.0.1:8000 --workers ${UVICORN_WORKERS:-2} user app` `program:celery-worker bash -c celery -A app.tasks worker --concurrency ${CELERY_CONCURRENCY:-2} user app` `program:celery-beat celery -A app.tasks beat user app` `stdout→/dev/stdout` |
| `entrypoint.sh` | `cd /app/backend; alembic upgrade head; exec supervisord -c supervisord.conf` |
| `deploy.sh` | Pi5 bookworm `apt nginx postgresql python3 nodejs npm redis` `postgres finance_user:finance_pass finance_db` `pip --break-system-packages` `frontend npm build cp /var/www` `write backend/.env <<ENVEOF DATABASE_URL asyncpg finance_user:${DB_PASSWORD_VAL}@localhost/finance_db + SYNC + SECRET_KEY $(secrets.token_hex 32) + ALGORITHM + REDIS :devpassword + CORS 80/trycloudflare + OLLAMA cloud + UPLOAD` `PYTHONPATH alembic upgrade head` `systemd finance-api.service User=${PI_USER} WorkingDirectory=${APP_DIR}/backend ExecStart uvicorn 127.0.0.1:8000 --workers 2 Restart always` `nginx sites-available finance-tracker alias /uploads/ try_files` `cloudflared arm64 tunnel login/create/route/run quick --url http://localhost:80` |
| `.env.example` | `DB_PASSWORD SECRET_KEY OLLAMA_API_KEY REDIS_PASSWORD EMBEDDING_MODEL mxbai-embed-large DIMENSION 1024 TTL 24` |
| `.gitignore` | `.env backend/.env *.log __pycache__ venv node_modules dist uploads/*` |

**Health:** `GET /api/health` + `GET /health 200 ok` + docker healthchecks `pg_isready` `redis ping`.

---

## 9. Voice (Web)

| File | Flow |
|------|------|
| `backend/app/services/whisper_service.py` `backend/app/api/routes/voice.py` | `POST /api/voice/transcribe 20/m 25MB` `faster-whisper base.en cpu auto vad_filter language or None` via executor temp file; `GET /api/voice/models` missing (deferred) |
| `frontend/src/services/voice.ts` `frontend/src/services/api.ts voiceApi` `frontend/src/utils/tts.ts` `frontend/src/pages/CopilotPage.tsx` | `getVoiceEngine browser>backend pickMimeType webm/ogg/mp4 transcribeAudio blob voiceApi.transcribe startBackendRecording getUserMedia MediaRecorder + startBrowserRecognition en-US single-shot startVoice choose` `stripMarkdown speak rate1.05 voice en-US/GB cancelSpeech voiceschanged pending` `CopilotPage streaming sessionId status/token/actions/error/done scroll Bot markdown ReactMarkdown+GFM ActionConfirmCard voiceMode banner Mic red spinner transcribing TTS on done powered Ollama Cloud` |

---

## 10. Notable Constraints Fixed Since Audit
- `SECRET_KEY ""` require env + `.gitignore` + merge conflicts resolved
- Refresh rotation + blacklist + `is_active/deleted` check
- `Decimal` `FOR UPDATE` `SKIP LOCKED` `refund+charge` single lock same account
- `SYNC_WRITABLE_FIELDS` whitelist + server bump `updated_at` + `pull` `deleted_at>=last` + tombstone soft pruning
- IDOR static `normpath re UUID deleted`
- `_escape_like escape \` in `transaction` + `finance_tools`
- `deploy.sh <<ENVEOF` expansion + `${PI_USER}/${APP_DIR}`
- CORS filtered `exp://*` + `SlowAPIMiddleware` via `auth.limiter` + limits `30/20/60`
- Soft-delete filters `auth login/alert/mark/read/preferences`, `account delete updated_at`, `category_rule deleted`, `memory soft prune`
- `budget _enrich start_date anchored weekly`, `rate limit` `SlowAPIMiddleware`, `ws asyncio.Lock` + no double accept
- `nginx CSP Permissions-Policy microphone=(self)` + `CACHE-CONTROL` `/health` + `connection $connection_upgrade`
- `supervisord user root + app` + `UVICORN_WORKERS` env + `healthcheck pg/redis depends_on condition`
- `database pool_timeout statement_timeout 30s idle60s`
- `ocr pdf load_page lock + RGBA→RGB`, `requirements pinned`
- `analysis _trends gather, dashboard gather, calendar cast Integer`
- `import delimiter whitelist 10MB`
- `action_tools exact deleted + most-used account Redis proposed_action 24h`
- `memory Vector dim from settings`
- `models Indexes ix_transactions_* ix_bills ix_recurring`
- Frontend `api single-flight refresh + chatStream 401 refresh + onDone + buffer + TopBar items count + Transactions filter reset page abort + Settings useEffect sync + format guard ZeroDecimal cachedCurrency + validation trim/max + Modal dialog Esc + Alert threshold Intl`

---

*Comprehensive map excludes mobile (archived). For mobile re-enable, add Expo SQLite offline-first sync + biometrics under `mobile-app/` (see git history `mobile-app/src/database/sync.ts` v2).*
