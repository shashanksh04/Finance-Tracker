# Finance Tracker

A personal finance management application: multi-account bookkeeping, budgets, recurring
transactions, bills with receipt OCR, an alert engine, and an AI layer (copilot, financial
memory, insights) backed by Ollama Cloud.

Version **1.1.0**. Deployed at `https://finance.shashankakumar.com`.

> This README describes the system as it is today, including the parts that do not work.
> See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) before relying on anything here.

## Contents

- [Tech stack](#tech-stack)
- [Features](#features)
- [Requirements](#requirements)
- [Running locally](#running-locally)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Deployment](#deployment)
- [Testing](#testing)
- [Further reading](#further-reading)

## Tech stack

**Frontend** — React 18, TypeScript, Vite 6, Tailwind CSS 3, Recharts, Zustand, React Router 6,
Lucide Icons, React Hook Form + Zod, Axios, `react-hot-toast`.
**Backend** — Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async), Alembic, Celery + Redis,
slowapi rate limiting.
**Database** — PostgreSQL 15+ **with the `pgvector` extension**.
**AI/ML** — Ollama Cloud `gpt-oss:120b-cloud`, `mxbai-embed-large` (1024-dim, pgvector),
EasyOCR 1.7.2 with PaddleOCR 3.x detection, Faster-Whisper `base.en`.
**Auth** — JWT HS256 (30m access / 7d refresh rotation) with a Redis blacklist, bcrypt,
rate-limited login.
**OCR note** — on ARM64 (Cortex-A76 and similar) PaddleOCR 3.7 segfaults in native code. The OCR
service probes PaddleOCR in a subprocess and falls back to EasyOCR. See
[OCR engine selection](#ocr-engine-selection).

## Features

**Money management**
- Multiple accounts (checking, savings, cash, credit, loan, investment, other) with a
  write-through `balance`
- Transaction CRUD with filtering, and transaction date entry
- Categories (income/expense) with icon, colour, and sort order
- Category rules for auto-categorisation, with confidence and hit/miss counts
- Account archiving, soft delete across entities

**Planning**
- Budgets on monthly, quarterly, yearly, **and weekly** periods, with rollover
- Goals with milestones
- Recurring transactions (daily, weekly, biweekly, monthly, quarterly, yearly; interval and
  optional end date) auto-generated hourly by Celery
- Bills with due date, paid state, notes, and receipt upload + OCR
- Transfer support is **not** implemented — see [Limitations](docs/LIMITATIONS.md)

**Analysis**
- Dashboard summary: balance, income, expenses, net-worth change
- Period analysis by month/quarter/year: category breakdown, spending trends, top merchants,
  generated insights
- Calendar view with per-day income/expense and upcoming bills
- Net-worth trend with an assets/liabilities split
- **Cashflow projection** (new in 1.1.0): forward balance over 14–365 days, combining unpaid
  bills, recurring transactions, and future-dated transactions, with a lowest-point/overdraw
  warning

**Alerts** — 8 types, generated on a Celery schedule: spending limit, budget exceeded, bill due,
goal milestone, unusual spending, low account balance, recurring failed, monthly summary.

**AI (requires a working `OLLAMA_API_KEY`)**
- Copilot chat, streaming, and a 14-intent router covering queries and creates
- Financial memory engine with pgvector retrieval
- Automatic insight generation
- Goal-spending conflict detection
- AI decision simulator (degrades gracefully when AI is unavailable)
- LLM receipt parser (degrades to a regex parser)

**Capture and platform**
- Receipt/bill OCR (image and PDF)
- Voice transcription via Faster-Whisper
- CSV/Excel import (preview then execute)
- Offline push/pull sync
- Live WebSocket updates
- Admin statistics, dark mode, currency symbols, 6 shared UI primitives

## Requirements

| Component | Version | Notes |
|---|---|---|
| Node.js | 18+ | With npm |
| Python | 3.11+ | |
| PostgreSQL | 15+ | **Must have `pgvector`** |
| Redis | 5+ | Celery broker and token blacklist |
| Ollama | optional | Cloud by default; needed only for AI features |

**`pgvector` is a hard requirement, not a recommendation.** Migration `a3b8c9d0e1f2` creates the
`vector` column for the memory engine, but if the extension is missing it prints a message and
**continues anyway** — the migration reports success while the column is never created, and the
whole memory/copilot RAG layer fails at runtime. On Debian/Ubuntu:

```bash
sudo apt-get install -y postgresql-15-pgvector
psql -d finance_tracker -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

## Running locally

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Celery

```bash
cd backend
celery -A app.tasks worker --loglevel=info
celery -A app.tasks beat   --loglevel=info
```

Beat is required for recurring-transaction generation and alert creation.

## Configuration

All settings live in `backend/app/core/config.py` and every one has a default, so the app
imports cleanly without a populated environment. Put overrides in a gitignored `.env`.

| Variable | Default | Purpose |
|---|---|---|
| `APP_NAME` | `Finance Tracker API` | FastAPI title |
| `VERSION` | `1.1.0` | Reported by `/api/health` |
| `DEBUG` | `False` | |
| `DATABASE_URL` | `postgresql+asyncpg://finance_user:finance_pass@localhost:5432/finance_db` | Async connection |
| `DATABASE_URL_SYNC` | `postgresql+psycopg2://finance_user:finance_pass@localhost:5432/finance_db` | Sync connection, used by Alembic |
| `SECRET_KEY` | `""` (empty) | JWT signing — **must be set in production** |
| `ALGORITHM` | `HS256` | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
| `REDIS_URL` | `redis://:$REDIS_PASSWORD@localhost:6379/0` | Password comes from `REDIS_PASSWORD` |
| `CELERY_BROKER_URL` | `redis://:$REDIS_PASSWORD@localhost:6379/1` | |
| `CELERY_RESULT_BACKEND` | `redis://:$REDIS_PASSWORD@localhost:6379/2` | |
| `OLLAMA_BASE_URL` | `https://ollama.com` | |
| `OLLAMA_MODEL` | `gpt-oss:120b-cloud` | |
| `OLLAMA_API_KEY` | `""` (empty) | **Required for any AI feature** |
| `EMBEDDING_MODEL` | `mxbai-embed-large` | |
| `EMBEDDING_DIMENSION` | `1024` | Must match the vector column width |
| `CONVERSATION_TTL_HOURS` | `24` | Copilot conversation expiry |
| `WHISPER_MODEL` | `base.en` | |
| `WHISPER_DEVICE` | `cpu` | |
| `WHISPER_COMPUTE_TYPE` | `auto` | |
| `WHISPER_LANGUAGE` | `""` (auto-detect) | |
| `UPLOAD_DIR` | `uploads` | OCR/import file storage |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated |
| `OCR_ENGINE` | `auto` | `auto` \| `paddle` \| `easyocr` — see below |
| `LOG_LEVEL` | `INFO` | |
| `DB_PASSWORD` | `finance_pass` | Read by `docker-compose.yml` to build the DB URLs |
| `REDIS_PASSWORD` | `""` | Read by `config.py` and `docker-compose.yml`; a strong value is required |

Note that `REDIS_URL` and the Celery URLs are built from `REDIS_PASSWORD` rather than set
independently. If `REDIS_PASSWORD` is empty the URLs contain an empty password, which fails
authentication against a password-protected Redis.

### OCR engine selection

`OCR_ENGINE=auto` (the default) is the only value that works reliably on ARM64. In `auto` mode the
service loads PaddleOCR in a **subprocess** and probes it; a native segfault in that probe cannot
take down the worker, and if PaddleOCR fails to initialise the request falls back to EasyOCR. If
you force `OCR_ENGINE=paddle` on a host where PaddleOCR segfaults, the worker process will crash.

> `Pillow` is currently unpinned in `requirements.txt`. EasyOCR 1.7.2 requires `Pillow<11`, so a
> future unpinned rebuild can silently break OCR. Pin it before the next image rebuild.

## Architecture

```
backend/
├── app/
│   ├── api/routes/     19 routers, 78 REST operations + 1 WebSocket
│   ├── core/           config, security, database, redis, currency, authenticated_static
│   ├── models/         12 SQLAlchemy models
│   ├── schemas/        17 Pydantic schema modules
│   ├── services/       17 service modules (analysis, OCR, whisper, import, sync, ...)
│   ├── tasks/          Celery tasks
│   ├── copilot/        LangGraph copilot: intent router, nodes, tools
│   ├── embeddings/     Embedding service
│   └── ws/             WebSocket manager
├── alembic/versions/   9 migrations, single linear head
├── tests/              44 tests
├── alembic.ini
└── pytest.ini

frontend/
├── src/
│   ├── pages/          18 pages
│   ├── components/     layout/, ui/, import/, onboarding/
│   ├── services/api.ts
│   ├── types/
│   ├── store/          Zustand
│   └── utils/
└── package.json
```

Detailed breakdowns: [PROJECT_MAP.md](PROJECT_MAP.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Deployment

Two deployment paths exist and **they are not equivalent**. The Docker Compose path is the one in
use; `deploy.sh` is a systemd/nginx path that has drifted.

| | Docker Compose (in use) | `deploy.sh` |
|---|---|---|
| pgvector | included in the `db` image | **not installed** — `postgresql` only, so the AI layer breaks |
| Redis auth | required, via `REDIS_PASSWORD` | **no password** (`redis://localhost:6379/0`) |
| WebSocket `/ws` | proxied | **no `/ws` location** in its nginx config |
| Security headers | set | absent |
| Processes | 4 supervisord programs | systemd unit + Celery units |

If you use `deploy.sh`, install `postgresql-15-pgvector`, set a Redis password, and add a `/ws`
location block before trusting it with a production database.

Runbook: [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Testing

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

44 tests: 19 covering the cashflow projection maths (future-transaction reversal, recurring date
expansion, daily/weekly bucketing boundaries) and 25 pre-existing copilot/embedding/OCR tests.
`backend/pytest.ini` sets `pythonpath = .` so `app.*` resolves.

Two things to know:

- Importing `app.core.database` builds a SQLAlchemy engine at import time, so the DB drivers
  (`asyncpg`, `psycopg2-binary`) must be importable even for pure unit tests. Nothing connects.
- There is no CI workflow. The suite runs when someone runs it.

## Further reading

| Document | Contents |
|---|---|
| [PROJECT_MAP.md](PROJECT_MAP.md) | File-level map of the whole repository |
| [docs/API.md](docs/API.md) | All 78 operations, with the list-endpoint contract |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Data model, request flow, background jobs, AI layer |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Deploy, migrate, back up, rotate secrets, troubleshoot |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | **What is broken or missing — read this** |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [plans.md](plans.md) | Roadmap and prior planning notes |
