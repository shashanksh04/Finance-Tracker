# Plan: Credit cards as liabilities + statement payment flow

> Status: SAVED, NOT YET EXECUTED. Line citations re-verified against the code on 2026-09-28
> (v1.1.0); the analysis service has shifted since this was written.

## Problem (confirmed from code)
- `Account.balance` is a single signed total, and **every** account uses the same sign rule:
  `income -> +`, `expense -> -` (`backend/app/services/transaction_service.py:55`, and the
  mirrored reversal at `:181`/`:186`/`:205`).
  A credit card is a *liability*, so spending should **increase** debt and a payment should
  **decrease** it — currently it is backwards.
- There is **no way to pay a card**. `type:'transfer'` exists in the schema but is
  unimplemented (no `to_account_id`, no UI) and currently falls through to the expense branch.
- The dashboard `total_balance` just sums every balance with no sign handling
  (`backend/app/services/analysis_service.py:235`), so card debt is not subtracted.
  Note: `get_net_worth_trend` *does* already split assets from liabilities
  (`analysis_service.py:340-350`) — it treats `credit` as a liability. So the two code paths
  already disagree with each other, which is part of why this is worth fixing.

Decisions (confirmed with user):
- Statements: **auto-generate monthly + manual override**.
- Payment: transfer from a bank account (also fixes the broken `transfer` type).
- Net worth: **count cards as debt** (dashboard Total Balance = assets - liabilities).

## Core model change
Treat account semantics by `type`:
- **Asset** (checking/savings/cash/investment): money you own. `income +`, `expense -`.
- **Liability** (credit): money you owe. Store `balance` = amount owed (positive = you owe).
  `expense (purchase) +`, `income (refund) -`.
- **Transfer** (`account_id` -> `to_account_id`): source loses money, destination gains it;
  if destination is a card, its debt decreases. Net worth stays correct either way.

## 1. Data model (`backend/app/models/`)
- `account.py`: add `credit_limit`, `statement_day` (1-28, statement closes),
  `due_day_offset` (days after close when due, default 21), and statement snapshot:
  `statement_balance`, `statement_min_payment`, `statement_due_date`,
  `statement_period_start`, `statement_period_end`, `last_statement_generated_at`
  (all nullable).
- `transaction.py`: add `to_account_id` (FK -> accounts, nullable) for transfers.
- **Alembic migration**: add columns + **data backfill** -- for existing `type='credit'`
  accounts, `balance = -balance` so a card you had spent 100 on (old -100) becomes +100 owed.
  (Assumption: existing credit balances represent debt magnitude; one-time assumption, noted.)

## 2. Backend services
- `transaction_service.py`: replace the hard-coded sign with
  `balance_delta(account_type, txn_type, role)` so income/expense respect asset vs liability,
  and implement `transfer` (updates both `account_id` and `to_account_id`, with correct signs).
  Rework `update`/`delete` to reverse using the same rule (including transfers).
- `account_service.py`: add `generate_statement(account_id, as_of)` = snapshot current
  outstanding `balance` as `statement_balance`, compute `statement_due_date` from
  `statement_day` + `due_day_offset`, set period bounds, store `last_statement_generated_at`.
  Add `PATCH /statement` for manual override. Add `pay_credit_card(from_account_id, amount, date)`
  convenience that creates a `transfer` (from -> card).
- `analysis_service.py`: `total_balance` = sum(asset balances) - sum(credit balances).
  Also expose `total_assets` / `total_liabilities`.
- Keep `get_summary` returning the (debt) balance for cards.

## 3. API endpoints (`backend/app/api/routes/`)
- `POST /transactions/transfer` -- generic transfer (used for card payments and inter-account moves).
- `POST /accounts/{id}/generate-statement` and `GET`/`PATCH /accounts/{id}/statement`
  -- auto + manual override.
- (Pay UI just calls the transfer endpoint with `to_account_id` = card.)
- `scheduled_tasks.py`: daily Celery beat task to auto-generate statements whose `statement_day`
  matches today and have not been generated this period.

## 4. Frontend
- `frontend/src/types/index.ts`: extend `Account` (credit/statement fields) and `Transaction`
  (`to_account_id`, `to_account_name`).
- `frontend/src/utils/validation.ts`: `accountSchema` add optional `credit_limit` /
  `statement_day` / `due_day_offset`; `transactionSchema` add `transfer` type + optional
  `to_account_id` (required when transfer).
- `frontend/src/pages/AccountsPage.tsx`:
  - Credit cards rendered distinctly (e.g., red "**You owe X**"), showing statement:
    *Due X on DATE* and *Min Y*, plus **Pay** button -> `PayCreditCardModal`
    (pick source account, prefilled amount = statement balance / min / full, confirm -> transfer API).
    Also a "Generate statement" action.
  - Edit modal shows Credit-limit / Statement-day / Due-offset when `type='credit'`.
- `frontend/src/pages/TransactionsPage.tsx`: add a **Transfer** tab; when selected show
  From/To account selects; display transfers as `Checking -> SBI Card` with neutral styling.
- `frontend/src/pages/DashboardPage.tsx`: `total_balance` now shows true net worth
  (assets - debt); optionally a small "You owe" line for liabilities.

## 5. Out of scope (mention only)
- Linking credit-card payments to the existing **Bills** feature (can be added later).
- Import of transfer rows (`import_service`) -- leave transfers created manually for now.

## Verification
- `python -m py_compile` on changed backend; `npm run build` for frontend;
  rebuild + redeploy container.
- Manual test: create card, add purchases -> balance owed rises; **Pay** from checking ->
  card debt drops, checking drops; statement auto-fills due date; dashboard net worth
  subtracts debt; existing data backfill flips credit signs.
