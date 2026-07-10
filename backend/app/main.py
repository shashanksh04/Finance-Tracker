from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.redis import close_redis
from app.core.static_auth import AuthenticatedStaticFilesMiddleware
from app.api.routes import auth, accounts, categories, category_rules, transactions, budgets, recurring, goals, alerts, bills, memories, analysis, copilot, ocr, import_routes, ws, sync, admin

app = FastAPI(title=settings.APP_NAME, version=settings.VERSION)
app.state.limiter = auth.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.on_event("startup")
async def startup():
    try:
        import asyncio, threading
        from app.services.ocr_service import OCRService
        threading.Thread(target=OCRService.warmup, daemon=True).start()
    except Exception:
        pass

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuthenticatedStaticFilesMiddleware)

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
app.include_router(ws.router)
app.include_router(sync.router)
app.include_router(admin.router)

app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.on_event("shutdown")
async def shutdown():
    await close_redis()


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}
