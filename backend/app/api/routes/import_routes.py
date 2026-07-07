from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.import_schema import ImportOptions, ImportPreviewResponse, ImportResult
from app.services.import_service import ImportService
from app.ws.events import notify_dashboard_updated
import os
import uuid

router = APIRouter(prefix="/api/import", tags=["Import"])

UPLOAD_DIR = "uploads/import"


@router.post("/preview", response_model=ImportPreviewResponse)
async def preview_import(
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
async def execute_import(
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


async def _save_upload(file: UploadFile) -> str:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "upload.csv")[1] or ".csv"
    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}{ext}")
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    return file_path
