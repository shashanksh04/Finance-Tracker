from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import date


class ColumnMapping(BaseModel):
    date: Optional[str] = None
    amount: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    category: Optional[str] = None
    account: Optional[str] = None
    merchant: Optional[str] = None


class ImportOptions(BaseModel):
    column_mapping: Optional[ColumnMapping] = None
    date_format: str = "%Y-%m-%d"
    default_account_id: Optional[str] = None
    default_account_name: Optional[str] = None
    default_category_name: Optional[str] = None
    skip_first_row: bool = True
    delimiter: str = ","
    create_missing_accounts: bool = False
    create_missing_categories: bool = False


class PreviewRow(BaseModel):
    row_number: int
    date: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    type: Optional[str] = None
    category: Optional[str] = None
    account: Optional[str] = None
    merchant: Optional[str] = None
    errors: List[str] = []


class ImportPreviewResponse(BaseModel):
    total_rows: int
    valid_rows: int
    error_rows: int
    detected_mapping: Optional[ColumnMapping] = None
    columns: List[str]
    rows: List[PreviewRow]
    warnings: List[str] = []


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: List[str]
    total_rows: int


class ImportColumnSuggestion(BaseModel):
    column: str
    suggested_field: str
    confidence: float
