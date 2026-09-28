# Finance Tracker — Project Map

> Web-first (mobile archived `32193ef` removed). Absolute paths. Re-generated 2026-09-28 after full re-scan.

## 0. Workspace — 15 entries

```
/home/alpha/projects/Finance Tracker/
├── backend\                 # FastAPI 3.12 + SQLAlchemy 2.0 + Alembic + Celery + Whisper
│   ├── app\main.py (lifespan warmup OCR+Whisper)
│   ├── app\api\routes\ (19 routers)
│   ├── app\core\ (config, database pool, security JWT, redis Lock, currency, authenticated_static IDOR)
│   ├── app\models\ (12 models uuid36 soft-delete)
│   ├── app\schemas\ (17 pydantic v2)
│   ├── app\services\ (17 incl. OCR/Whisper/Import/Sync/Analysis)
│   ├── app\copilot\ (graph + 4 agents + 9 finance +8 action tools)
│   ├── app\embeddings\ (mxbai 1024)
│   ├── app\ws\ (manager + events)
│   ├── app\tasks\ (beat 6)
│   ├── alembic\versions\ (9 migrations)
│   └── uploads\ (AuthenticatedStaticFiles)
├── frontend\                # Vite 6 + React 18 + TS 5.6 + Tailwind 3.4 + Zustand + Recharts
│   ├── src\App.tsx (ProtectedRoute/AdminRoute *→/)
│   ├── src\pages\ (18)
│   ├── src\components\ (13: layout 3 + ui 6 + onboarding + import + Error + ActionConfirm)
│   ├── src\services\ (api single-flight + voice)
│   ├── src\hooks\ (useWebSocket exponential, useApi dead)
│   ├── src\store\ (auth persist, theme dark)
│   ├── src\utils\ (format cachedCurrency, validation zod, tts voiceschanged)
│   └── src\types\ (326 lines)
├── Dockerfile               # node:20-alpine build → python:3.12-slim + nginx/supervisor/ffmpeg (no --platform)
├── docker-compose.yml       # pgvector:pg16 healthcheck + redis healthcheck + app 80:80 condition service_healthy
├── nginx.conf               # 50M SPA CSP + /api /ws /uploads /health (NOTE mic still blocks — see §8)
├── supervisord.conf         # root + app, UVICORN_WORKERS env, celery concurrency env
├── entrypoint.sh            # alembic upgrade head → supervisord
├── deploy.sh                # Pi bare-metal 199 lines systemd + nginx alias + cloudflared
├── .env.example (8 lines) / backend/.env.example (23 lines)
├── .gitignore / .dockerignore
├── README.md (146 lines brief)
└── PROJECT_MAP.md (this file)
```

`mobile-app/` **deleted** — verified `Test-Path False`, `Glob mobile-app* No files`, git history `mobile-app/src/database/sync.ts v2`.

---

## 1. Tech Stack

| Layer | Choice | File | Notes |
|-------|--------|------|-------|
| **Frontend** | React 18.3.1, TS 5.6.2, Vite 6.0.3, Tailwind 3.4.16 + @tailwindcss/typography, Zustand 5.0.2, Router 6.28, Recharts 2.13.3, Lucide 0.46, date-fns 4.1, axios 1.7.9, react-hook-form 7.54 + zod 3.24, react-hot-toast 2.4, react-markdown 10.1 + remark-gfm, clsx 2.1 | `frontend/package.json` `frontend/vite.config.ts: proxy 5173 /api→8000 /ws ws /uploads` `frontend/tailwind.config.js darkMode class primary sky surface slate Inter JetBrains` | `tsc -b && vite build` 2859 modules 1.1 MB gz 312 kB |
| **Backend** | Python 3.12, FastAPI ≥0.110, Uvicorn[standard], Pydantic 2.7, SQLAlchemy 2.0.30, Alembic 1.13, asyncpg 0.29 psycopg2-binary 2.9, python-jose 3.3, passlib bcrypt 1.7+bcrypt4, slowapi 0.1.9, celery 5.4 redis 5.1, httpx 0.27, pgvector 0.3, langgraph 0.2 langchain-core 0.3 langchain-ollama 0.2, paddleocr 2.8.1 paddlepaddle 2.6.1 easyocr 1.7.1 PyMuPDF 1.24 Pillow 10, pandas 2.2 matplotlib seaborn plotly openpyxl, faster-whisper 1.0, dateutil, email-validator, dotenv | `backend/requirements.txt` (pinned 2.6.1/2.8.1/1.7.1) | limiter `1000/m default + 5/m register 10/m login 30/m copilot 20/m ocr/voice/import 60/m transactions` |
| **DB** | PG 15+ + pgvector `pg16 Vector(1024) ivfflat lists100` | `docker-compose.yml:db` `backend/app/models/memory.py:18` `backend/alembic/versions/a3b8c9d0e1f2_add_pgvector_support.py: dim from settings` | `asyncpg` + `psycopg2` pool `10/20 pre_ping recycle3600 timeout30 statement_timeout30s idle60s` `backend/app/core/database.py:5` |
| **Cache/Queue** | Redis 7-alpine, Celery beat 3600/43200/900/43200/86400 | `docker-compose.yml:redis --requirepass ${REDIS_PASSWORD} healthcheck` `backend/app/tasks/__init__.py: beat_schedule 6` `backend/app/tasks/scheduled_tasks.py: _run_async ThreadPool timeout300` | broker 1 result 2 |
| **AI** | Ollama Cloud `gpt-oss:120b-cloud` `https://ollama.com` + `mxbai-embed-large 1024 TTL24`, Whisper `base.en cpu auto` faster-whisper `vad_filter` single | `backend/app/core/config.py:24` `backend/app/copilot/agents/base.py temp0.1 num_predict2048` `backend/app/embeddings/embedding_service.py POST /api/embed` `backend/app/services/whisper_service.py singleton warmup` | No sentence-transformers, `/api/chat` + `/api/embed` via httpx 60s |
| **Auth** | JWT HS256 `HS256` `jti` access 30m refresh 7d + `token_blacklist:{jti}` Redis + rotation + `deleted_at/is_active` guard, bcrypt | `backend/app/core/security.py` `backend/app/api/deps.py HTTPBearer auto_error False` `backend/app/services/auth_service.py:89` `backend/app/api/routes/auth.py:39 logout blacklists both` | |
| **Infra** | Docker multi-stage, Nginx 50M SPA, Supervisor 4 procs, Systemd Pi, Cloudflared | `Dockerfile` `nginx.conf` `supervisord.conf` `entrypoint.sh` `deploy.sh` | `EXPOSE 80 → 127.0.0.1:8000 workers ${UVICORN_WORKERS:-2}` |

---

## 2. Schemas — `backend/app/schemas/*.py` (18 files)

| File | Models | Validation |
|------|--------|------------|
| `auth.py` | `UserCreate EmailStr pwd 8+ upper/lower/digit/special full_name` `UserLogin` `TokenResponse bearer` `TokenRefresh` `UserResponse is_admin/is_verified/onboarding/settings` `ChangePassword` `UpdateProfile whitelist currency/notifications/theme/language` | |
| `account.py` | `AccountCreate name max100 type checking/savings/credit/investment/cash/loan/other balance currency USD icon/color` `AccountUpdate no balance (no overwrite)` `AccountResponse/Summary total_income/expenses/count` | `loan\|other` added |
| `category.py` | `CategoryCreate name 1-80 type income\|expense icon/color parent_id sort_order 0-10000` `CategoryUpdate` `CategoryResponse/WithChildren` | |
| `transaction.py` | `TransactionCreate account_id category_id? amount gt0 type income\|expense\|transfer description merchant? date notes? tags is_split` `TransactionUpdate amount gt0 description 1-500 merchant120 notes2000` `TransactionResponse+PaginatedTransactions` `FilterParams page1 page_size50 sort whitelisted merchant/search escaped` | `_escape_like` |
| `category_rule.py` | `CategoryRuleCreate category_id contains_keyword merchant_name min/max priority` `RuleResponse confidence hit/miss` | |
| `budget.py` | `BudgetCreate category_id? amount gt0 period weekly\|monthly\|quarterly\|yearly start_date end_date rollover` `BudgetUpdate gt0 pattern weekly` `BudgetResponse spent/remaining/percentage` | weekly added |
| `recurring.py` | `RecurringCreate amount gt0 type income\|expense desc merchant frequency daily/weekly/biweekly/monthly/quarterly/yearly interval 1-365 next_date end_date` `RecurringUpdate same` | |
| `goal.py` | `GoalCreate name 200 target>0 current deadline category_id icon/color monthly notes` `GoalResponse progress% days_remaining suggested_monthly` | |
| `alert.py` | `AlertCreate type title message severity info related_amount` `AlertPreferenceUpdate` `AlertResponse` | 8 types |
| `bill.py` | `BillCreate name amount gt0 due_date file_path ocr_text is_paid paid_date category_id recurring_id notes` `BillUploadResponse` | ALLOWED_EXT 6 10MB |
| `memory.py` | `MemoryCreate key value context memory_type importance` `MemoryResponse` | |
| `copilot.py` | `CopilotRequest message session_id history` `CopilotResponse reply session_id suggested_actions insights agent_trace proposed_actions(id,action_type,summary,payload)` `DecisionSimulation` risk low/med/high | |
| `analysis.py` | `PeriodAnalysisRequest period yearly/quarterly/monthly year month? quarter? account/category` `CategoryBreakdown SpendingTrend DashboardSummary total_balance monthly_income/expenses net_worth_change budget_health recent upcoming alerts goal_progress spending_by_category` `NetWorthTrend Calendar` | |
| `import_schema.py` | `ColumnMapping` `ImportOptions delimiter whitelist ,; tab \| : date_format default_account/category skip_first_row create_missing` `PreviewRow ImportPreview ImportResult` | |
| `common.py` | `PaginatedResponse[T] items total page page_size total_pages` | |
| `admin.py` | `DailyLoginCount AdminStats total_users today daily[]` | |

---

## 3. Routes — `backend/app/api/routes/*.py` (19 includes)

| File | Prefix | Methods (rate limited) |
|------|--------|------------------------|
| `auth.py` | `/api/auth` | `POST /register 5/m` `POST /login 10/m` `POST /refresh` `POST /logout` (blacklist access 30m + refresh 7d body) `GET /me` `PUT /profile` whitelist `POST /change-password` `PATCH /onboarding` |
| `accounts.py` | `/api/accounts` | `GET /?include_archived&page(0 wrapped)` `POST /` `GET /{id}` `GET /{id}/summary` `PUT /{id}` `DELETE /{id}` soft bulk `transactions/recurring deleted+updated` |
| `categories.py` | `/api/categories` | `GET /?type=income\|expense&page` pattern `^(income\|expense)$` `POST /` `POST /seed` `GET /{id}` `PUT /{id}` `DELETE /{id}` |
| `category_rules.py` | `/api/category-rules` | `GET /` `POST /` `GET /{id}` `PUT /{id}` `DELETE /{id}` |
| `transactions.py` | `/api/transactions` | `GET /?account/category/type/start/end/min/max/merchant/search&sort whitelisted&page1 page_size50 escape` `POST / 60/m` `GET /{id}` `PUT /{id}` `DELETE /{id}` `FOR UPDATE Decimal` |
| `budgets.py` | `/api/budgets` | `GET /?active_only&page` `POST /` `GET /{id}` `PUT /{id}` `DELETE /{id}` |
| `recurring.py` | `/api/recurring` | `GET /?active_only` `POST /` `GET /{id}` `PUT /{id}` `DELETE /{id}` |
| `goals.py` | `/api/goals` | `GET /?status&page` `POST /` `GET /{id}` `PUT /{id}` `DELETE /{id}` |
| `alerts.py` | `/api/alerts` | `GET /?unread_only&limit` `POST /{id}/read` + ws `alert_read` `POST /{id}/dismiss` + `alert_dismissed` `GET /preferences` `PUT /preferences/{type}` `POST /generate` |
| `bills.py` | `/api/bills` | `GET /?unpaid_only` `POST /` `GET /{id}` `PUT /{id}` `DELETE /{id}` `POST /{id}/upload` multipart 10MB 6 ext |
| `memories.py` | `/api/memories` | `GET /?memory_type` `POST /` `GET /{id}` `PUT /{id}` `DELETE /{id}` |
| `analysis.py` | `/api/analysis` | `GET /dashboard` parallel gather `GET /period` `GET /net-worth-trend?months` `GET /calendar?year&month` cast day |
| `copilot.py` | `/api/copilot` | `POST /chat 30/m` `POST /chat/stream 30/m SSE` `POST /simulate 20/m` |
| `ocr.py` | `/api/ocr` | `POST /scan 20/m` `OCRScanResponse` finally unlink |
| `import_routes.py` | `/api/import` | `POST /preview 20/m` `POST /execute 20/m` `uploads/import/{uuid}.ext` delimiter whitelist 10MB |
| `voice.py` | `/api/voice` | `POST /transcribe 20/m` 25MB `WhisperService.transcribe` |
| `sync.py` | `/api/sync` | `GET /pull?last_pulled_at` `POST /push {changes:{table:{created/updated/deleted}}}` whitelist `updated_at` server bump |
| `admin.py` | `/api/admin` | `GET /stats` (is_admin) |
| `ws.py` | `/ws` | WS first `{"token":access}` no double accept `is_token_blacklisted` `manager.connect asyncio.Lock` |
| `main.py` | `/api/health` | `lifespan warmup` `SlowAPIMiddleware auth.limiter` `CORS filtered exp://*` |

`app/api/deps.py` `HTTPBearer` `get_current_user` 401 `deleted_at/is_active` + `get_optional_user`.

---

## 4. Services — `backend/app/services/*.py` (18 files)

| File | Notes |
|------|-------|
| `auth_service.py` | `register` `select deleted_at` + `IntegrityError` duplicate handle, seed 10+8 cats Cash INR `LoginRecord`, `login` `deleted_at/is_active`, `refresh_token` rotation blacklist 7d, `update_profile` whitelist settings |
| `account_service.py` | wrapped `{items,total,page1} max(1)` `delete` bulk soft `deleted+updated` where `deleted is None` `summary` 3 sums `deleted` |
| `category_service.py` | CRUD `deleted_at sort_order` wrapped |
| `category_rule_service.py` | `match` `deleted_at` `record_hit +0.05 max1` `learn_from_correction -0.15 disable <0.2` new merchant/first-word 0.6 |
| `transaction_service.py` | `create FOR UPDATE Decimal +income/-else record_hit` `get_filtered joinedload VALID_SORT _escape_like` enrich cached relation `update` single lock same-account `refund+charge` `delete` soft refund `FOR UPDATE` |
| `budget_service.py` | wrapped `delete` ` _enrich_batch` anchored `start_date` weekly `weekday` else monthly/quarterly/yearly batch `SUM` |
| `recurring_service.py` | `process_due FOR UPDATE SKIP LOCKED` `balance +=/- amt` `next_date` calendar |
| `goal_service.py` | wrapped `_enrich progress% days_remaining suggested_monthly remaining/days*30` |
| `alert_service.py` | `deleted_at` filters `get_preferences` 8 defaults `generate` budget 90% bill 7d goal 100% dedup |
| `bill_service.py` | `upload` deleted filter 6 ext 10MB `aiofiles` |
| `memory_service.py` | `deleted_at` `cleanup hard>30d + soft excess 100 via updated_at` |
| `analysis_service.py` | `get_period_analysis → _analyze → _sum/_count/_breakdown/_trends(parallel gather)/_top_merchants` `get_dashboard_summary parallel income/expenses/breakdown/accounts` `get_net_worth_trend reverse` `get_calendar cast Integer day` |
| `sync_service.py` | `SYNC_TABLES 11 MODEL_MAP SYNC_WRITABLE whitelist PROTECTED balance` `pull` initial `deleted is None` else `updated>=last` + tombstone `deleted>=last` `created>=last else updated` `push filtered id+writable updated server bump LWW` |
| `ocr_service.py` | Paddle+Easy `det 0.3` `_preprocess RGBA→RGB 960` `_extract_pdf locked load_page` `_call_llm_parse isprintable Ignore instructions` regex fallback `score/3` |
| `whisper_service.py` | `WhisperModel(base.en cpu auto)` singleton warmup `transcribe vad_filter` via executor temp file |
| `import_service.py` | `allowed_delims ,; \t | :` 10MB `detect_mapping fuzzy >=0.4` `_parse_row dateutil amount ()/-` `_resolve` ilike `FOR UPDATE Decimal` |
| `goal_spending_service.py` | surplus vs `suggested*2` → `FinancialMemory goal_conflict` |
| `core/config.py` | `SECRET_KEY ""` `HS256 30m/7d` `REDIS redis://:$REDIS_PASSWORD@localhost:6379/{0,1,2}` (password required) `OLLAMA https://ollama.com gpt-oss:120b-cloud` `EMBED mxbai 1024 TTL24` `WHISPER base.en cpu auto` `UPLOAD uploads` `CORS 5173,8081` `LOG INFO` |
| `core/database.py` | `create_async_engine pool 10/20 pre_ping recycle3600 timeout30 statement30s idle60s rollback` `get_db BaseException GeneratorExit rollback` |
| `core/security.py` | `token_blacklist jti hash/verify bcrypt jti sub exp type HS256 decode is_token_blacklisted/blacklist_token SETEX` |
| `core/redis.py` | `aio from_url decode retry` `asyncio.Lock` `_init_exc` `get_redis ping` |
| `core/currency.py` | `CURRENCY_SYMBOLS 10` `get_symbol/code user.settings.currency USD` |
| `core/authenticated_static.py` | `Bearer type access not blacklisted` `unquote normpath re ^/uploads/bills/([^/]+) UUID deleted owner==sub` |
| `ws/ws_manager.py` | `dict list asyncio.Lock` `connect accept lock` `disconnect _async_disconnect` `send_personal_message broadcast dead prune` |
| `tasks/__init__.py` | `Celery json UTC beat 6: recurring 3600 alerts 43200 cleanup 86400 index 900 goal 43200 memories 86400` |
| `tasks/scheduled_tasks.py` | `_run_async get_running_loop ThreadPool timeout300 else asyncio.run` tasks per user commit |

---

## 5. Models — `backend/app/models/*.py` (13 files, uuid36 soft-delete)

| File | Table | Columns | Indexes |
|------|-------|---------|---------|
| `user.py` | `users` | `id email unique password_hash full_name is_active is_admin false is_verified onboarding_completed settings JSON deleted` | relations 10 |
| `account.py` | `accounts` | `id user_id name type balance14,2 currency USD icon color is_archived deleted` | |
| `category.py` | `categories` | `id user_id name icon color type parent_id sort_order deleted` | self parent/children |
| `transaction.py` | `transactions` | `id account_id user_id category_id amount type desc merchant date is_recurring recurring_id bill_id auto_rule_id notes tags JSON is_split parent_split_id deleted` | `ix_transactions_user_deleted_date, ix_merchant_trgm, ix_user_type` |
| `category_rule.py` | `category_rules` | `id user_id category_id contains_keyword merchant_name min/max priority is_active confidence 0.5 hit/miss last_matched deleted` | |
| `budget.py` | `budgets` | `id user_id category_id amount period weekly|monthly|quarterly|yearly start_date end_date is_active rollover deleted` | |
| `recurring.py` | `recurring_transactions` | `id user_id account_id category_id amount type desc merchant frequency interval_value next_date end_date is_active deleted` | `ix_recurring_next_active_deleted` |
| `goal.py` | `goals` | `id user_id name target current deadline category_id icon color status monthly notes deleted` | |
| `alert.py` | `alerts` + `alert_preferences` | `Alert id user_id type title message severity category_id related_amount is_read is_dismissed deleted` + `AlertPreference id user_id alert_type enabled threshold deleted` | `ix_bills_user_due_deleted on bills` |
| `bill.py` | `bills` | `id user_id name amount due_date file_path ocr_text is_paid paid_date category_id recurring_id notes deleted` | |
| `memory.py` | `financial_memories` | `id user_id key value context embedding JSON embedding_vector Vector1024 memory_type importance 0.5 deleted` | `ivfflat vector_cosine` |
| `login_record.py` | `login_records` | `id user_id idx created_at TZ idx` | |

Alembic 8: `172d2ca5cae9_initial` → `1375a454 onboarding` → `1f42e1b7 server_default` → `f279aac Cash` → `a3b8c9d0e1f2 pgvector dim from settings` → `b4c5d6e7f8g9 deleted/updated ix` → `d5e6f7 is_admin login_records` → `e6f7a8b learning fields` + model indexes.

---

## 6. Copilot — `backend/app/copilot/*` + `backend/app/embeddings/*`

| File | Role |
|------|------|
| `copilot_service.py` | `StreamingCallbackHandler queue token/status` `_build_state message user session_id messages[-5] financial_context intent is_fast_path plan scratchpad final_response next_node proposed_actions` `chat graph.ainvoke` `chat_stream SSE session status token actions done` polls 0.3s cancel task finally fresh `async_session_factory` for `run_insights` |
| `graph.py` | `StateGraph input_parser→context_builder→router --fast? financial_data : supervisor --financial_data\|analysis\|advisor\|response_emitter → response_emitter → END` shared `proposed_actions` |
| `state.py` | `TypedDict CopilotState` |
| `intent_router.py` | regex 15 intents `spending/budget/goal/bill/compare/account/income/create_transaction/update/delete/create_budget/goal/category/account/mark_bill_paid` `classify multi_step` |
| `agents/base.py` | `create_llm ChatOllama temp0.1 num_predict2048` `create_tools 9 finance +8 action` |
| `tools/finance_tools.py` | `get_spending_by_category` `get_budget_health` `get_recent_transactions` `get_upcoming_bills` `compare_periods` `get_goal_progress` `get_goal_spending_impact` `get_accounts` `get_income_summary` each `_escape_like ilike` |
| `tools/action_tools.py` | `make_action_tools` `_escape_like _cc _money _parse_date _append_action act_* redis 86400` `_resolve_category exact deleted` `_resolve_account exact` `_default_account most-used COUNT` `_find_transactions/_find_bill` 8 tools `create_transaction/update/delete/create_budget/create_goal/create_category/create_account/mark_bill_paid` validate `amount>0 whitelist` `Proposed but NOT executed` |
| `nodes/input_parser.py` | `conversation:{user}:{session}` TTL24 uuid |
| `nodes/context_builder.py` | `asyncio.gather 11 _income/expense this/last _top_categories _accounts _budgets _goals _bills _memories hybrid_search top4` symbol month budgets goals need $/mo |
| `nodes/router.py` | `is_fast_path` |
| `nodes/supervisor.py` | `with_structured_output SupervisorPlan` fallback advisor |
| `nodes/financial_data_agent.py` | `bind_tools` loop 3 must-use |
| `nodes/analysis_agent.py` | `analyze_period compare_periods_tool` loop 3 |
| `nodes/advisor_agent.py` | no tools friendly currency-aware |
| `nodes/response_emitter.py` | persist trimmed10 TTL embed `Q: … A: …[:500]` → `FinancialMemory conversation 0.5` |
| `nodes/insight_generator.py` | after stream surplus goal → Ollama JSON array 1-2 insights → `Memory insight 0.4` |
| `rag_engine.py` | `retrieve top5 min0.3 pgvector <=> cosine` fallback in-memory `hybrid_search` |
| `indexer.py` | `index_memory/transaction/bill reindex_user index_unindexed batch50 dual JSON+vector` |
| `embeddings/embedding_service.py` | `httpx 60s POST /api/embed mxbai 1024` `embed_batch cosine` |

---

## 7. Frontend — `frontend/*` (17 pages 13 components 2 services 2 hooks 3 utils)

| File | Purpose |
|------|---------|
| `package.json` `vite.config.ts` `tailwind.config.js` `postcss.config.js` `index.html` `src/index.css` | `finance-tracker 1.0 type module dev vite build tsc -b` deps `react 18 zustand 5 axios hook-form zod recharts lucide date-fns clsx react-markdown` dev `vite6 @vitejs/react tailwind eslint` `vite 5173 proxy /api→8000 /ws ws /uploads` `darkMode class primary sky surface slate Inter JetBrains animations fade/slide/scale/pulse typography` |
| `tsconfig.json` | `ES2020 bundler react-jsx strict @/* ./src/*` |
| `src/main.tsx` | `BrowserRouter v7` `theme-storage dark` `Toaster top-right 4s` |
| `src/App.tsx` | `ProtectedRoute` preserves `location.state.from` `AdminRoute is_admin else /` `tokenKey = access_token` avoid double `loadUser` routes 18 `*→/` |
| `src/store/authStore.ts` `themeStore.ts` | `persist auth-storage {user,tokens,isAuthenticated}` `login/register/logout/loadUser` `darkMode toggle documentElement` |
| `src/types/index.ts` | `User AdminStats Account+Summary Category+WithChildren Transaction+Paginated Budget Recurring Goal Alert Preference Bill Memory DashboardSummary PeriodAnalysis NetWorth Calendar AuthTokens ProposedAction CashflowProjection CashflowBucket CashflowLowestPoint` 326 lines |
| `src/services/api.ts` | `axios /api` `getStoredTokens try` `pendingRefresh` single-flight raw `axios.post /api/auth/refresh` `clearAuth` flag `Url includes refresh/login bypass` groups `authApi accountsApi categoriesApi categoryRulesApi transactionsApi (GET paginated 50 escape) budgetsApi recurringApi goalsApi alertsApi billsApi upload FormData memoriesApi ocrApi scan voiceApi transcribe analysisApi copilotApi chat chatStream(SSE fetch 401 refresh onDone buffer remainder token/status/actions) onboardingApi adminApi importApi` |
| `src/services/voice.ts` | `getVoiceEngine browser>backend` `pickMimeType webm/ogg/mp4 transcribeAudio` `startBackendRecording getUserMedia MediaRecorder` `startBrowserRecognition en-US continuous false` `startVoice` |
| `src/hooks/useWebSocket.ts` | `getWsUrl wss/ws` `useWebSocket handlers deps` `shouldReconnect attempt exponential min30s 1.6^ + jitter` `send {token}` `onmessage event/data` `onclose re-arm if shouldReconnect` |
| `src/utils/format.ts` `validation.ts` `tts.ts` | `CURRENCY_LOCALE 10 ZERO_DECIMAL KRW/VND try catch fallback` cached `cachedCurrency` `getDefaultCurrency INR` `CURRENCIES 10` `formatDate Relative formatPercentage cn getInitials getErrorMessage` `zod login/register 8+ account loan/other balance max1e12 transaction amount positive max1e12 description trim500 merchant120 date ISO budget weekly` `muted isTtsSupported stripMarkdown speak 1.05 voiceschanged queue cancel` |
| `src/components/layout/*` `ui/*` | `DashboardLayout flex surface50 OnboardingOverlay Sidebar w64 14 nav + Admin Shield AI promo TopBar h16 sticky hamburger search ?search bell unread items ?? total ws user initials dropdown` `Modal role dialog aria-modal size sm/md/lg lock Esc focus restore` `PageHeader StatCard trending DataTable pagination EmptyState LoadingSpinner` `ErrorBoundary ActionConfirmCard ImportModal 4-step drag&drop wizard OnboardingOverlay 10 steps Welcome…All Set` |
| `src/pages/*.tsx` | `Login/Register split neha easter-egg` `Dashboard 318L Bar Pie Recent Upcoming Goal ws` `Transactions 296L paginated 20 filter reset page abort OCR 10MB allowed ext + confirm amount>0 ImportModal` `Accounts 152L CURRENCIES 10` `Categories 162L 10 colors seed` `Budgets 170L anchored weekly` `Goals 169L` `Bills 267L overdue 7d` `Recurring 188L` `Analysis 187L` `Reports 118L` `Calendar 166L` `Copilot 375L streaming session pendingActions voiceMode muted recording TTS on done powered Ollama` `Alerts 136L severityIcons ws Threshold Intl` `Settings 221L tabs profile currency grid 10 security appearance Sun/Moon useEffect sync` `Admin 94L stats bar` |

---

## 8. Deployment

| File | Details |
|------|---------|
| `Dockerfile` | `node:20-alpine npm ci build → /app/dist` + `python:3.12-slim + nginx supervisor ffmpeg libgomp1` `user app` `pip no-cache` `COPY backend /app/backend` `COPY dist /var/www/finance-tracker` `COPY nginx/supervisord/entrypoint mkdir /var/lib/nginx/body… chown sed pid/error/access → /var/www/nginx*.log WORKDIR /app/backend USER app EXPOSE 80 ENTRYPOINT /entrypoint.sh` **no `--platform`** |
| `docker-compose.yml` | `db pgvector:pg16 healthcheck pg_isready interval10 timeout5 retries5` `redis 7-alpine --requirepass ${REDIS_PASSWORD} healthcheck` `app 80:80 uploads:/var/www/finance-tracker/uploads env DATABASE_URL asyncpg finance_user:${DB_PASSWORD}@db:5432/finance_db + SYNC psycopg2 + REDIS :${REDIS_PASSWORD}@redis + SECRET_KEY + CORS https://finance.shashankakumar.com,neha...,5173,8081 + OLLAMA https://ollama.com gpt-oss:120b-cloud + EMBED mxbai 1024 TTL24 depends_on condition service_healthy restart unless-stopped` `volumes pgdata uploads` |
| `nginx.conf` | `listen 80 _ client_max_body 50M root /var/www/finance-tracker index index.html` headers `nosniff DENY X-XSS Referrer CSP default-src self script self style self unsafe-inline fonts.googleapis font.gstatic img self data connect self wss://ollama.com` `Permissions-Policy camera=(), microphone=(self), geolocation=()` **(fixed in 3b858f1 — `microphone=(self)` is now allowed for voice capture)** `Cache-Control no-cache` `location /api/ proxy 127.0.0.1:8000 Upgrade $connection_upgrade Host X-Real-IP X-Forwarded-Host 180s` `location /ws proxy 127.0.0.1:8000 86400s` `location /uploads/ proxy` `location / try_files` `location =/health 200 ok` |
| `supervisord.conf` | `nodaemon` `program:nginx user app daemon off` `program:uvicorn bash -c uvicorn app.main:app 127.0.0.1:8000 --workers ${UVICORN_WORKERS:-2} user app` `program:celery-worker bash -c celery worker --concurrency ${CELERY_CONCURRENCY:-2} user app` `program:celery-beat user app` |
| `entrypoint.sh` | `cd /app/backend; alembic upgrade head; exec supervisord -c supervisord.conf` |
| `deploy.sh` | `PI_USER/APP_DIR/PI_HOST` `apt nginx postgresql python3 nodejs npm redis` `postgres finance_user:finance_pass finance_db` `pip --break-system-packages` `frontend npm build cp /var/www` `write backend/.env <<ENVEOF DATABASE_URL asyncpg ${DB_PASSWORD_VAL}@localhost/finance_db + SYNC + SECRET_KEY token_hex + ALGORITHM + REDIS :devpassword + CORS 80/trycloudflare + OLLAMA cloud + UPLOAD` `PYTHONPATH alembic upgrade head` `systemd finance-api.service User=${PI_USER} WorkingDirectory=${APP_DIR}/backend ExecStart uvicorn 127.0.0.1:8000 workers2 Restart always` `nginx sites-available alias /uploads/ try_files nginx -t restart` `cloudflared arm64 tunnel login/create/route/run quick --url 80` |
| `.env.example` `backend/.env.example` | `DB_PASSWORD SECRET_KEY OLLAMA_API_KEY REDIS_PASSWORD EMBEDDING mxbai 1024 TTL24 WHISPER base.en cpu auto UPLOAD uploads CORS 5173 LOG INFO` |
| `.gitignore` `.dockerignore` | `.env backend/.env *.log __pycache__ venv node_modules dist uploads/*` |

Health: `GET /api/health` + `GET /health 200` + docker healthchecks.

---

## 9. Voice (Web)

| File | Flow |
|------|------|
| `backend/app/services/whisper_service.py` `backend/app/api/routes/voice.py` | `POST /api/voice/transcribe 20/m 25MB` `faster-whisper base.en cpu auto vad_filter` via executor temp file |
| `frontend/src/services/voice.ts` `frontend/src/services/api.ts voiceApi` `frontend/src/utils/tts.ts` `frontend/src/pages/CopilotPage.tsx` | `getVoiceEngine browser>backend pickMimeType` `startBackendRecording getUserMedia MediaRecorder + startBrowserRecognition en-US` `stripMarkdown speak 1.05 voiceschanged queue` `CopilotPage streaming session pendingActions voiceMode muted recording TTS on done powered Ollama` voice planned: `useVoiceOrchestrator` header Mic push-to-talk + continuous 5s + barge-in (see plan) |

---

## 10. Fixes Applied (post-audit)
- Merge `authenticated_static` resolved, `SECRET_KEY ""` + `.gitignore`, refresh rotation blacklist `is_active/deleted`, `FOR UPDATE SKIP LOCKED Decimal`, whitelist `SYNC_WRITABLE`, IDOR `normpath UUID deleted`, `_escape_like`, `deploy <<ENVEOF`, CORS filtered + `SlowAPIMiddleware`, soft-delete filters, `budget anchored`, `ws asyncio.Lock`, `nginx CSP Cache /health`, `supervisord root/app env workers`, `database timeouts`, `ocr locked load_page RGBA→RGB`, pinned `2.6.1/2.8.1/1.7.1`, `analysis gather cast Integer`, `import whitelist 10MB`, `action_tools exact most-used Redis 24h`, `Vector dim from settings`, `indexes ix_*`, frontend `single-flight refresh chatStream onDone TopBar items Settings useEffect format guard validation Modal Esc`.

---

## 11. V1.1 Additions

| Path | What it is |
|------|------|
| `frontend/src/pages/CashflowPage.tsx` | Cashflow projection page. Composed Recharts bar (inflow/outflow) + area (closing balance), `ReferenceLine y=0`, overdraw banner, 14/30/60/90/180/365d range, per-account filter |
| `backend/app/services/analysis_service.py` | `get_cashflow_projection()` + pure `_build_buckets()` (daily ≤31d, weekly above) + shared `_balance_as_of()` extracted from `get_net_worth_trend` |
| `backend/app/schemas/analysis.py` | `CashflowProjectionResponse`, `CashflowBucket`, `CashflowLowestPoint` — 14 fields, fully declared (unlike the 25 untyped operations). A contract test pins the service output to the schema, because a required field the service omits 500s at runtime while every other test still passes |
| `backend/app/api/routes/analysis.py` | `GET /api/analysis/cashflow` (`days` 7–365 default 90, `account_id` optional) |
| `backend/app/services/recurring_service.py` | `calculate_next_date()` promoted from private `_calculate_next_date` so the projection and the hourly Celery job share one date-roll implementation |
| `backend/alembic/versions/f1a2b3c4d5e6_add_missing_model_indexes.py` | Creates the 5 indexes declared on models but absent from every migration; `if_not_exists=True`, reversible |
| `backend/pytest.ini` | `pythonpath=.`, `testpaths=tests`, `asyncio_mode=strict` |
| `backend/requirements-dev.txt` | `pytest` + `pytest-asyncio`, kept out of `requirements.txt` so the production image does not ship them |
| `backend/tests/test_cashflow_projection.py` | 22 tests: future-transaction reversal, recurring date expansion incl. month-end/leap-year clamping, daily↔weekly boundary, running balance, lowest-point tracking, plus a response-contract test that pins service output to the schema |
| `docs/API.md` `docs/ARCHITECTURE.md` `docs/OPERATIONS.md` `docs/LIMITATIONS.md` | Generated from the live OpenAPI schema and source, not maintained by hand |

Also changed in v1.1: `frontend/src/services/api.ts` (`analysisApi.getCashflow`), `frontend/src/types/index.ts`, `frontend/src/App.tsx` (route), `frontend/src/components/layout/Sidebar.tsx` (nav), `backend/app/copilot/intent_router.py` (`create_goal` no longer matches the bare noun "saving goal"), `backend/app/services/budget_service.py` (`timedelta` import), `frontend/src/pages/BillsPage.tsx` (`toList`).

Counts after v1.1: **19 routers, 78 REST operations, 51 paths, 1 WebSocket, 12 models, 17 schemas, 17 services, 18 pages, 9 migrations, 47 tests.**

---

*Web-first only. Mobile under `mobile-app/` in git history `32193ef~1` for reference.*
