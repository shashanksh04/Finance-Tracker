export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_verified: boolean;
  onboarding_completed: boolean;
  created_at: string;
  settings?: Record<string, unknown>;
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash';
  balance: number;
  currency: string;
  icon?: string;
  color?: string;
  is_archived: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AccountSummary extends Account {
  transaction_count: number;
  total_income: number;
  total_expenses: number;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  type: 'income' | 'expense';
  parent_id?: string;
  sort_order: number;
  created_at: string;
}

export interface CategoryRule {
  id: string;
  category_id: string;
  category_name: string;
  contains_keyword?: string;
  merchant_name?: string;
  min_amount?: number;
  max_amount?: number;
  priority: number;
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  account_name: string;
  category_id?: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  merchant?: string;
  date: string;
  is_recurring: boolean;
  notes?: string;
  tags?: string[];
  created_at: string;
  updated_at?: string;
}

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Budget {
  id: string;
  category_id?: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date?: string;
  is_active: boolean;
  rollover: boolean;
  created_at: string;
  updated_at?: string;
  spent: number;
  remaining: number;
  percentage: number;
}

export interface RecurringTransaction {
  id: string;
  account_id: string;
  account_name: string;
  category_id?: string;
  category_name?: string;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  merchant?: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  interval_value: number;
  next_date: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  category_id?: string;
  category_name?: string;
  icon?: string;
  color?: string;
  status: 'active' | 'completed' | 'cancelled';
  monthly_contribution?: number;
  notes?: string;
  progress_percentage: number;
  days_remaining?: number;
  suggested_monthly?: number;
  created_at: string;
  updated_at?: string;
}

export interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  category_id?: string;
  related_amount?: number;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface AlertPreference {
  id: string;
  alert_type: string;
  enabled: boolean;
  threshold?: number;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  file_path?: string;
  ocr_text?: string;
  is_paid: boolean;
  paid_date?: string;
  category_id?: string;
  category_name?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  extracted_amount?: number;
  extracted_due_date?: string;
  extracted_merchant?: string;
  confidence?: number;
}

export interface FinancialMemory {
  id: string;
  key: string;
  value: string;
  context?: string;
  memory_type: string;
  importance: number;
  created_at: string;
  updated_at?: string;
}

export interface DashboardSummary {
  total_balance: number;
  monthly_income: number;
  monthly_expenses: number;
  net_worth_change: number;
  budget_health: { category: string; budgeted: number; spent: number; percentage: number }[];
  recent_transactions: { id: string; description: string; amount: number; type: string; date: string }[];
  upcoming_bills: { id: string; name: string; amount: number; due_date: string }[];
  alerts: { id: string; type: string; title: string; severity: string; message: string; created_at: string }[];
  goal_progress: { id: string; name: string; progress: number }[];
  spending_by_category: { category_name: string; amount: number; percentage: number; category_color?: string }[];
}

export interface PeriodAnalysis {
  period: string;
  label: string;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  transaction_count: number;
  category_breakdown: { category_name: string; amount: number; percentage: number; category_color?: string }[];
  trends: { period_label: string; income: number; expenses: number; net: number }[];
  top_merchants: { merchant: string; total: number; count: number }[];
  insights: string[];
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
