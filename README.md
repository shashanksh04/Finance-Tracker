# Finance Tracker

A comprehensive finance management application with AI-powered features, built with React, TypeScript, FastAPI, and PostgreSQL.

## Tech Stack

**Frontend:** React 18, TypeScript, Vite 6, Tailwind CSS 3, Recharts, Zustand, React Router 6, Lucide Icons
**Backend:** Python 3.11+, FastAPI, Pydantic, SQLAlchemy 2.0, Alembic, Celery, Redis
**Database:** PostgreSQL
**AI/ML:** Ollama (local LLM), Sentence Transformers (embeddings), PaddleOCR (document scanning)
**Auth:** JWT with refresh tokens, bcrypt

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

### Ollama Setup (Optional)

```bash
# Install Ollama from https://ollama.ai
ollama pull mistral:7b
ollama pull nomic-embed-text
```

## Architecture

```
backend/
├── app/
│   ├── api/routes/     # REST API endpoints
│   ├── core/           # Config, security, database
│   ├── models/         # SQLAlchemy models
│   ├── schemas/        # Pydantic schemas
│   ├── services/       # Business logic
│   ├── tasks/          # Celery async tasks
│   ├── copilot/        # AI Copilot service
│   └── embeddings/     # Embedding service
├── alembic/            # Database migrations
└── uploads/            # File uploads

frontend/
├── src/
│   ├── components/     # UI and layout components
│   │   ├── layout/     # Dashboard layout, sidebar, topbar
│   │   └── ui/         # Reusable UI components
│   ├── pages/          # Page components
│   ├── services/       # API client
│   ├── store/          # Zustand state management
│   ├── types/          # TypeScript interfaces
│   └── utils/          # Utility functions
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

## Alert Types

1. **Spending Limit** - Alerts when spending exceeds user-defined threshold
2. **Budget Exceeded** - Alerts when budget usage hits 90%
3. **Goal Milestone** - Notifies when a goal is completed
4. **Unusual Spending** - Detects abnormal spending patterns
5. **Bill Due** - Reminds of upcoming bills (7 days before)
6. **Low Account Balance** - Alerts when balance drops below threshold
7. **Recurring Failed** - Notifies if recurring transaction processing fails
8. **Monthly Summary** - Periodic financial summary
