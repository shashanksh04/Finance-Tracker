from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.config import settings
from app.core.redis import close_redis
from app.core.authenticated_static import AuthenticatedStaticFiles
from app.api.routes import auth, accounts, categories, category_rules, transactions, budgets, recurring, goals, alerts, bills, memories, analysis, copilot, ocr, import_routes, ws, sync, admin, voice

from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        import threading
        from app.services.ocr_service import OCRService
        from app.services.whisper_service import WhisperService
        threading.Thread(target=OCRService.warmup, daemon=True).start()
        threading.Thread(target=WhisperService.warmup, daemon=True).start()
    except Exception:
        pass
    yield
    await close_redis()

app = FastAPI(title=settings.APP_NAME, version=settings.VERSION, lifespan=lifespan)
app.state.limiter = auth.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

_cors_origins = [o for o in settings.cors_origins_list if o != "exp://*" and "*" not in o]
_has_wildcard = any("*" in o for o in settings.cors_origins_list)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=not _has_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(categories.router)
app.include_router(category_rules.router)
app.include_router(transactions.router)
app.include_router(budgets.router)
app.include_router(recurring.router)
app.include_router(goals.router)
app.include_router(alerts.router)
app.include_router(bills.router)
app.include_router(memories.router)
app.include_router(analysis.router)
app.include_router(copilot.router)
app.include_router(ocr.router)
app.include_router(import_routes.router)
app.include_router(voice.router)
app.include_router(ws.router)
app.include_router(sync.router)
app.include_router(admin.router)

app.mount("/uploads", AuthenticatedStaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}
