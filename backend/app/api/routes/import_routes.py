from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.import_schema import ImportOptions, ImportPreviewResponse, ImportResult
from app.services.import_service import ImportService
from app.api.routes.auth import limiter
from app.ws.events import notify_dashboard_updated
import os
import uuid

router = APIRouter(prefix="/api/import", tags=["Import"])

UPLOAD_DIR = "uploads/import"


@router.post("/preview", response_model=ImportPreviewResponse)
@limiter.limit("20/minute")
async def preview_import(
    request: Request,
    file: UploadFile = File(...),
    options: str = Form("{}"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import json
    opts = ImportOptions(**json.loads(options))
    file_path = await _save_upload(file)
    try:
        service = ImportService(db)
        return await service.preview(user.id, file_path, opts)
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@router.post("/execute", response_model=ImportResult)
@limiter.limit("20/minute")
async def execute_import(
    request: Request,
    file: UploadFile = File(...),
    options: str = Form("{}"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import json
    opts = ImportOptions(**json.loads(options))
    file_path = await _save_upload(file)
    try:
        service = ImportService(db)
        result = await service.execute(user.id, file_path, opts)
        await notify_dashboard_updated(user.id)
        return result
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


ALLOWED_IMPORT_EXT = {".csv", ".txt", ".xlsx", ".xls"}
MAX_IMPORT_SIZE = 10 * 1024 * 1024

async def _save_upload(file: UploadFile) -> str:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "upload.csv")[1].lower() or ".csv"
    if ext not in ALLOWED_IMPORT_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
    content = await file.read()
    if len(content) > MAX_IMPORT_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}{ext}")
    with open(file_path, "wb") as f:
        f.write(content)
    return file_path
