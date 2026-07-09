export const TABLES = {
  ACCOUNTS: 'accounts',
  TRANSACTIONS: 'transactions',
  CATEGORIES: 'categories',
  BUDGETS: 'budgets',
  GOALS: 'goals',
  BILLS: 'bills',
  RECURRING: 'recurring',
  ALERTS: 'alerts',
  MEMORIES: 'memories',
  SYNC_LOG: 'sync_log',
} as const;

const CREATE_ACCOUNTS = `
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'checking',
    balance REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    icon TEXT,
    color TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
`;

const CREATE_TRANSACTIONS = `
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    category_id TEXT,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    merchant TEXT,
    date TEXT NOT NULL,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    receipt_url TEXT,
    location TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`;

const CREATE_CATEGORIES = `
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
`;

const CREATE_BUDGETS = `
  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    amount REAL NOT NULL,
    period TEXT NOT NULL DEFAULT 'monthly',
    spent REAL NOT NULL DEFAULT 0,
    remaining REAL NOT NULL DEFAULT 0,
    start_date TEXT NOT NULL,
    end_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`;

const CREATE_GOALS = `
  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    current_amount REAL NOT NULL DEFAULT 0,
    deadline TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    category TEXT,
    icon TEXT,
    color TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
`;

const CREATE_BILLS = `
  CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    due_date TEXT NOT NULL,
    paid_date TEXT,
    is_paid INTEGER NOT NULL DEFAULT 0,
    category TEXT,
    recurrence TEXT,
    document_url TEXT,
    reminder_days_before INTEGER NOT NULL DEFAULT 3,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
`;

const CREATE_RECURRING = `
  CREATE TABLE IF NOT EXISTS recurring (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    category_id TEXT,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    merchant TEXT,
    frequency TEXT NOT NULL,
    interval INTEGER NOT NULL DEFAULT 1,
    next_date TEXT NOT NULL,
    end_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`;

const CREATE_ALERTS = `
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    is_read INTEGER NOT NULL DEFAULT 0,
    is_dismissed INTEGER NOT NULL DEFAULT 0,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
`;

const CREATE_MEMORIES = `
  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'fact',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
`;

const CREATE_SYNC_LOG = `
  CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL,
    data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id);
  CREATE INDEX IF NOT EXISTS idx_recurring_account ON recurring(account_id);
  CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
  CREATE INDEX IF NOT EXISTS idx_accounts_deleted ON accounts(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
  CREATE INDEX IF NOT EXISTS idx_categories_deleted ON categories(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
  CREATE INDEX IF NOT EXISTS idx_sync_log_table ON sync_log(table_name);
`;

export const TABLE_COLUMNS: Record<string, string[]> = {
  accounts: ['id', 'user_id', 'name', 'type', 'balance', 'currency', 'icon', 'color', 'is_archived', 'created_at', 'updated_at', 'deleted_at'],
  transactions: ['id', 'user_id', 'account_id', 'category_id', 'amount', 'type', 'description', 'merchant', 'date', 'is_recurring', 'receipt_url', 'location', 'tags', 'created_at', 'updated_at', 'deleted_at'],
  categories: ['id', 'user_id', 'name', 'type', 'icon', 'color', 'is_default', 'created_at', 'updated_at', 'deleted_at'],
  budgets: ['id', 'user_id', 'category_id', 'amount', 'period', 'spent', 'remaining', 'start_date', 'end_date', 'is_active', 'created_at', 'updated_at', 'deleted_at'],
  goals: ['id', 'user_id', 'name', 'target_amount', 'current_amount', 'deadline', 'status', 'category', 'icon', 'color', 'created_at', 'updated_at', 'deleted_at'],
  bills: ['id', 'user_id', 'name', 'amount', 'due_date', 'paid_date', 'is_paid', 'category', 'recurrence', 'document_url', 'reminder_days_before', 'created_at', 'updated_at', 'deleted_at'],
  recurring: ['id', 'user_id', 'account_id', 'category_id', 'amount', 'type', 'description', 'merchant', 'frequency', 'interval', 'next_date', 'end_date', 'is_active', 'created_at', 'updated_at', 'deleted_at'],
  alerts: ['id', 'user_id', 'type', 'title', 'message', 'severity', 'is_read', 'is_dismissed', 'metadata', 'created_at', 'updated_at', 'deleted_at'],
  memories: ['id', 'user_id', 'key', 'value', 'type', 'created_at', 'updated_at', 'deleted_at'],
};

export function stripUnknownFields(table: string, data: Record<string, any>): Record<string, any> {
  const allowed = TABLE_COLUMNS[table];
  if (!allowed) return data;
  const filtered: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    if (allowed.includes(key)) filtered[key] = data[key];
  }
  return filtered;
}

export const CREATE_TABLES = [
  CREATE_ACCOUNTS,
  CREATE_TRANSACTIONS,
  CREATE_CATEGORIES,
  CREATE_BUDGETS,
  CREATE_GOALS,
  CREATE_BILLS,
  CREATE_RECURRING,
  CREATE_ALERTS,
  CREATE_MEMORIES,
  CREATE_SYNC_LOG,
  CREATE_INDEXES,
].join('\n');
