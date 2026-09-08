# Finance Tracker

A comprehensive finance management application with AI-powered features, built with React, TypeScript, FastAPI, and PostgreSQL.

## Tech Stack

**Frontend:** React 18, TypeScript, Vite 6, Tailwind CSS 3, Recharts, Zustand, React Router 6, Lucide Icons
**Backend:** Python 3.11+, FastAPI, Pydantic, SQLAlchemy 2.0, Alembic, Celery, Redis
**Database:** PostgreSQL
**AI/ML:** Ollama Cloud `gpt-oss:120b-cloud` + `mxbai-embed-large` 1024 (pgvector), PaddleOCR + EasyOCR, Faster-Whisper `base.en`
**Auth:** JWT (HS256, 30m access / 7d refresh rotation) + Redis blacklist, bcrypt, rate-limited

## Features

- Secure Authentication (JWT + refresh tokens)
- Smart Budgeting with rollover support
- Multiple Account Management
- Category Rules for auto-categorization
- Transaction CRUD with advanced filtering
- Interactive Dashboards with charts
- Recurring Transactions with auto-generation
- Local Financial Copilot (Ollama integration)
- Quarterly/Monthly/Yearly Analysis
- AI Decision Simulator
- Financial Memory Engine
- Bill/E-Bill Upload with OCR
- Smart Alerts (spending limits, budget exceeded, bill due, goal milestones, unusual spending, account low, recurring failures)
- Explainable Insights
- Goal-Linked Spending Advice

## Setup

### Prerequisites

- Node.js 18+ (with npm)
- Python 3.11+
- PostgreSQL 15+
- Redis (for Celery)
- Ollama (optional, for AI features)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/Mac
# source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Configure PostgreSQL
# Create a database named 'finance_tracker'
# Update .env with your database credentials

# Run migrations
alembic upgrade head

# Start the backend server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Celery Workers (for background tasks)

```bash
cd backend
celery -A app.tasks worker --loglevel=info
celery -A app.tasks beat --loglevel=info
```

### Ollama Setup (Optional — cloud by default)

```bash
# Cloud: set OLLAMA_BASE_URL=https://ollama.com + OLLAMA_API_KEY
# Local:
ollama pull gpt-oss:120b-cloud
ollama pull mxbai-embed-large
```

## Architecture

```
backend/
├── app/
│   ├── api/routes/     # REST: auth, accounts, categories, transactions, budgets, recurring, goals, alerts, bills, memories, analysis, copilot, ocr, import, voice, ws, sync, admin
│   ├── core/           # Config, security, database, redis, currency, authenticated_static
│   ├── models/         # SQLAlchemy models
│   ├── schemas/        # Pydantic schemas
│   ├── services/       # Business logic incl. OCR/Whisper/Import/Sync
│   ├── tasks/          # Celery async tasks
│   ├── copilot/        # AI Copilot LangGraph
│   ├── embeddings/     # Embedding service
│   └── ws/             # WebSocket manager
├── alembic/            # Database migrations
└── uploads/            # File uploads

frontend/            # React SPA (Vite, Tailwind, Zustand, Recharts)

```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/auth/*` | Authentication (register, login, refresh, profile) |
| `/api/accounts/*` | Account management |
| `/api/categories/*` | Category management |
| `/api/category-rules/*` | Auto-categorization rules |
| `/api/transactions/*` | Transaction CRUD with filtering |
| `/api/budgets/*` | Budget management with tracking |
| `/api/recurring/*` | Recurring transactions |
| `/api/goals/*` | Financial goals |
| `/api/alerts/*` | Alerts and preferences |
| `/api/bills/*` | Bill management with file upload |
| `/api/memories/*` | Financial memory |
| `/api/analysis/*` | Dashboard and period analysis |
| `/api/copilot/*` | AI Copilot chat and decision simulation |
| `/api/ocr/*` | OCR bill scan |
| `/api/import/*` | CSV/Excel preview & execute |
| `/api/voice/*` | Whisper transcription |
| `/api/sync/*` | Offline pull/push |
| `/api/admin/*` | Admin stats |
| `/ws` | WebSocket real-time |

## Alert Types

1. **Spending Limit** - Alerts when spending exceeds user-defined threshold
2. **Budget Exceeded** - Alerts when budget usage hits 90%
3. **Goal Milestone** - Notifies when a goal is completed
4. **Unusual Spending** - Detects abnormal spending patterns
5. **Bill Due** - Reminds of upcoming bills (7 days before)
6. **Low Account Balance** - Alerts when balance drops below threshold
7. **Recurring Failed** - Notifies if recurring transaction processing fails
8. **Monthly Summary** - Periodic financial summary
