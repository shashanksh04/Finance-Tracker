export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_verified: boolean;
  onboarding_completed: boolean;
  created_at: string;
  settings: Record<string, any> | null;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash';
  balance: number;
  currency: string;
  icon: string | null;
  color: string | null;
  is_archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: 'income' | 'expense';
  parent_id: string | null;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRule {
  id: string;
  user_id: string;
  category_id: string;
  contains_keyword: string | null;
  merchant_name: string | null;
  min_amount: number | null;
  max_amount: number | null;
  priority: number;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  merchant: string | null;
  date: string;
  is_recurring: boolean;
  recurring_id: string | null;
  bill_id: string | null;
  notes: string | null;
  tags: string[] | null;
  is_split: boolean;
  parent_split_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  rollover: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  merchant: string | null;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  interval_value: number;
  next_date: string;
  end_date: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  category_id: string | null;
  icon: string | null;
  color: string | null;
  status: string;
  monthly_contribution: number | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bill {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  due_date: string;
  file_path: string | null;
  ocr_text: string | null;
  is_paid: boolean;
  paid_date: string | null;
  category_id: string | null;
  recurring_id: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  category_id: string | null;
  related_amount: number | null;
  is_read: boolean;
  is_dismissed: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertPreference {
  id: string;
  user_id: string;
  alert_type: string;
  enabled: boolean;
  threshold: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialMemory {
  id: string;
  user_id: string;
  key: string;
  value: string;
  context: string | null;
  embedding: any;
  embedding_vector: any;
  memory_type: string;
  importance: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncChange<T> {
  created: T[];
  updated: T[];
  deleted: T[];
}

export interface SyncPullResponse {
  changes: {
    accounts: SyncChange<Account>;
    categories: SyncChange<Category>;
    category_rules: SyncChange<CategoryRule>;
    transactions: SyncChange<Transaction>;
    budgets: SyncChange<Budget>;
    recurring_transactions: SyncChange<RecurringTransaction>;
    goals: SyncChange<Goal>;
    alerts: SyncChange<Alert>;
    alert_preferences: SyncChange<AlertPreference>;
    bills: SyncChange<Bill>;
    financial_memories: SyncChange<FinancialMemory>;
  };
  timestamp: string;
}

export interface SyncPushResponse {
  [table: string]: {
    created: number;
    updated: number;
    deleted: number;
  };
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingCount: number;
  error: string | null;
}
