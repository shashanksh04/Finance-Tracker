from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.category import Category
from app.schemas.import_schema import ColumnMapping, ImportOptions, PreviewRow, ImportPreviewResponse, ImportResult
from fastapi import HTTPException, status
from datetime import date, datetime
import csv
import io
import re
import tempfile
import os


COMMON_DATE_FORMATS = [
    "%Y-%m-%d", "%d-%m-%Y", "%m-%d-%Y",
    "%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y",
    "%d %b %Y", "%d %B %Y", "%b %d %Y",
    "%Y.%m.%d", "%d.%m.%Y",
]

FIELD_KEYWORDS = {
    "date": ["date", "datum", "trans date", "transaction date", "post date", "posted", "value date"],
    "amount": ["amount", "sum", "value", "amount (inr)", "amount (usd)", "debit", "credit", "transaction amount"],
    "description": ["description", "desc", "narrative", "particulars", "details", "memo", "note", "name", "payee"],
    "type": ["type", "transaction type", "txn type", "dr/cr", "debit/credit", "sign"],
    "category": ["category", "cat", "category name", "tags", "tag", "group"],
    "account": ["account", "account name", "from account", "to account"],
    "merchant": ["merchant", "vendor", "merchant name", "counterparty", "payee", "beneficiary", "company"],
}

AMOUNT_REGEX = re.compile(r'^[\d,]+\.?\d*$')
NEGATIVE_AMOUNT_REGEX = re.compile(r'^[-\(][\d,]+\.?\d*[\)]?$')


class ImportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def preview(self, user_id: str, file_path: str, options: ImportOptions) -> ImportPreviewResponse:
        rows, columns = await self._parse_file(file_path, options)
        detected = self._detect_mapping(columns) if not options.column_mapping else options.column_mapping
        mapping = options.column_mapping or detected

        preview_rows = []
        valid_count = 0
        error_count = 0
        warnings = []

        if not mapping.date:
            warnings.append("Date column not mapped. Rows without dates will be skipped.")
        if not mapping.amount:
            warnings.append("Amount column not mapped.")

        for i, row in enumerate(rows[:50]):
            parsed, errors = self._parse_row(row, mapping, options, i + 1)
            if errors:
                error_count += 1
            else:
                valid_count += 1
            preview_rows.append(PreviewRow(
                row_number=i + 1,
                date=str(parsed.get("date", "")) if parsed.get("date") else None,
                amount=parsed.get("amount"),
                description=parsed.get("description"),
                type=parsed.get("type"),
                category=parsed.get("category_name"),
                account=parsed.get("account_name"),
                merchant=parsed.get("merchant"),
                errors=errors,
            ))

        cat_names = set(r.get("category_name", "").strip().lower() for r, _ in (self._parse_row(row, mapping, options, i + 1) for i, row in enumerate(rows) if i < 50) if not _)
        if options.default_category_name:
            cat_names.discard(options.default_category_name.strip().lower())

        return ImportPreviewResponse(
            total_rows=len(rows),
            valid_rows=valid_count,
            error_rows=error_count,
            detected_mapping=detected if not options.column_mapping else None,
            columns=columns,
            rows=preview_rows,
            warnings=warnings,
        )

    async def execute(self, user_id: str, file_path: str, options: ImportOptions) -> ImportResult:
        rows, columns = await self._parse_file(file_path, options)
        mapping = options.column_mapping or self._detect_mapping(columns)

        imported = 0
        skipped = 0
        errors = []

        for i, row in enumerate(rows):
            parsed, row_errors = self._parse_row(row, mapping, options, i + 1)
            if row_errors:
                skipped += 1
                errors.extend(row_errors)
                continue

            account_id = await self._resolve_account(user_id, parsed, options)
            if not account_id:
                skipped += 1
                errors.append(f"Row {i + 1}: No account found or created")
                continue

            category_id = await self._resolve_category(user_id, parsed, options)
            txn_type = parsed.get("type") or "expense"
            if txn_type not in ("income", "expense", "transfer"):
                txn_type = "expense"

            txn_date = parsed.get("date") or date.today()
            if isinstance(txn_date, datetime):
                txn_date = txn_date.date()

            txn = Transaction(
                user_id=user_id,
                account_id=account_id,
                category_id=category_id,
                amount=parsed["amount"],
                type=txn_type,
                description=parsed.get("description", ""),
                merchant=parsed.get("merchant"),
                date=txn_date,
            )
            self.db.add(txn)
            imported += 1

        await self.db.flush()
        return ImportResult(imported=imported, skipped=skipped, errors=errors[:100], total_rows=len(rows))

    async def _parse_file(self, file_path: str, options: ImportOptions) -> tuple[list[dict], list[str]]:
        _, ext = os.path.splitext(file_path)
        if ext.lower() in (".csv", ".txt"):
            return await self._parse_csv(file_path, options)
        elif ext.lower() in (".xlsx", ".xls"):
            return self._parse_excel(file_path, options)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext}")

    async def _parse_csv(self, file_path: str, options: ImportOptions) -> tuple[list[dict], list[str]]:
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f, delimiter=options.delimiter)
            raw = list(reader)
        if not raw:
            return [], []
        header = raw[0]
        rows_raw = raw[1:] if options.skip_first_row else raw
        rows = []
        for r in rows_raw:
            row = {}
            for i, val in enumerate(r):
                if i < len(header):
                    row[header[i].strip()] = val.strip()
            rows.append(row)
        return rows, header

    def _parse_excel(self, file_path: str, options: ImportOptions) -> tuple[list[dict], list[str]]:
        import pandas as pd
        df = pd.read_excel(file_path, engine="openpyxl")
        header = list(df.columns)
        rows = df.to_dict(orient="records")
        return rows, header

    def _detect_mapping(self, columns: list[str]) -> ColumnMapping:
        mapping = {}
        col_lower = [c.lower().strip() for c in columns]

        for field, keywords in FIELD_KEYWORDS.items():
            best_match = None
            best_score = 0
            for col in col_lower:
                for kw in keywords:
                    if col == kw:
                        score = 1.0
                    elif col.startswith(kw) or kw.startswith(col):
                        score = 0.7
                    elif kw in col or col in kw:
                        score = 0.5
                    else:
                        score = 0
                    if score > best_score:
                        best_score = score
                        best_match = columns[col_lower.index(col)]
            if best_match and best_score >= 0.4:
                mapping[field] = best_match

        return ColumnMapping(**mapping)

    def _parse_row(self, row: dict, mapping: ColumnMapping, options: ImportOptions, row_num: int) -> tuple[dict, list[str]]:
        errors = []
        result = {}

        date_val = self._get_val(row, mapping.date)
        amount_val = self._get_val(row, mapping.amount)
        desc_val = self._get_val(row, mapping.description)
        type_val = self._get_val(row, mapping.type)
        cat_val = self._get_val(row, mapping.category)
        acct_val = self._get_val(row, mapping.account)
        merch_val = self._get_val(row, mapping.merchant)

        if date_val:
            parsed_date = self._parse_date(date_val, options.date_format)
            if parsed_date:
                result["date"] = parsed_date
            else:
                errors.append(f"Row {row_num}: Could not parse date '{date_val}'")

        if amount_val:
            parsed_amount = self._parse_amount(amount_val)
            if parsed_amount is not None:
                result["amount"] = parsed_amount
            else:
                errors.append(f"Row {row_num}: Could not parse amount '{amount_val}'")
        else:
            errors.append(f"Row {row_num}: No amount value")

        if desc_val:
            result["description"] = desc_val

        if type_val:
            t = type_val.strip().lower()
            if t in ("income", "deposit", "credit", "inflow", "cr", "+"):
                result["type"] = "income"
            elif t in ("expense", "debit", "withdrawal", "outflow", "dr", "payment", "-"):
                result["type"] = "expense"
            elif result.get("amount") and result["amount"] < 0:
                result["type"] = "expense"
                result["amount"] = abs(result["amount"])
            else:
                result["type"] = "expense"
        elif result.get("amount") and result["amount"] < 0:
            result["type"] = "expense"
            result["amount"] = abs(result["amount"])
        else:
            result["type"] = "expense"

        if cat_val:
            result["category_name"] = cat_val.strip()
        elif options.default_category_name:
            result["category_name"] = options.default_category_name

        if acct_val:
            result["account_name"] = acct_val.strip()
        elif options.default_account_name:
            result["account_name"] = options.default_account_name
        elif options.default_account_id:
            result["account_id"] = options.default_account_id

        if merch_val:
            result["merchant"] = merch_val.strip()

        return result, errors

    def _get_val(self, row: dict, key: str | None) -> str | None:
        if not key:
            return None
        if key in row:
            return str(row[key])
        for k in row:
            if k.strip().lower() == key.strip().lower():
                return str(row[k])
        return None

    def _parse_date(self, val: str, preferred_format: str) -> date | None:
        val = val.strip()
        for fmt in [preferred_format] + COMMON_DATE_FORMATS:
            try:
                return datetime.strptime(val, fmt).date()
            except ValueError:
                continue
        try:
            from dateutil import parser as dateparser
            return dateparser.parse(val, fuzzy=True).date()
        except ImportError:
            pass
        except Exception:
            pass
        return None

    def _parse_amount(self, val: str) -> float | None:
        val = val.strip()
        negative = False
        if val.startswith("(") and val.endswith(")"):
            negative = True
            val = val[1:-1]
        elif val.startswith("-"):
            negative = True
            val = val[1:]
        val = val.replace(",", "").replace(" ", "").replace("$", "").replace("€", "").replace("£", "").replace("₹", "")
        try:
            amount = float(val)
            return -amount if negative else amount
        except ValueError:
            return None

    async def _resolve_account(self, user_id: str, parsed: dict, options: ImportOptions) -> str | None:
        if parsed.get("account_id"):
            return parsed["account_id"]

        account_name = parsed.get("account_name")
        if account_name:
            result = await self.db.execute(
                select(Account).where(Account.user_id == user_id, Account.name.ilike(account_name))
            )
            account = result.scalar_one_or_none()
            if account:
                return account.id
            if options.create_missing_accounts:
                account = Account(user_id=user_id, name=account_name, type="checking", balance=0)
                self.db.add(account)
                await self.db.flush()
                return account.id

        if options.default_account_id:
            return options.default_account_id

        return None

    async def _resolve_category(self, user_id: str, parsed: dict, options: ImportOptions) -> str | None:
        cat_name = parsed.get("category_name")
        if cat_name:
            result = await self.db.execute(
                select(Category).where(Category.user_id == user_id, Category.name.ilike(cat_name.strip()))
            )
            cat = result.scalar_one_or_none()
            if cat:
                return cat.id
            if options.create_missing_categories:
                cat_type = parsed.get("type", "expense")
                cat = Category(user_id=user_id, name=cat_name.strip(), type=cat_type, color="#64748b")
                self.db.add(cat)
                await self.db.flush()
                return cat.id

        return None
