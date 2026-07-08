export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  settings: UserSettings;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  currency: string;
  dark_mode?: boolean;
  dark_mode_auto_schedule?: boolean;
  biometric_enabled?: boolean;
  notifications_enabled?: boolean;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  icon?: string;
  color?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id?: string;
  amount: number;
  type: TransactionType;
  description: string;
  merchant?: string;
  date: string;
  is_recurring: boolean;
  receipt_url?: string;
  location?: TransactionLocation;
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  account?: Account;
  category?: Category;
}

export interface TransactionLocation {
  latitude: number;
  longitude: number;
  address?: string;
  name?: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  period: BudgetPeriod;
  spent: number;
  remaining: number;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  category?: Category;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  status: GoalStatus;
  category?: string;
  icon?: string;
  color?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Bill {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  is_paid: boolean;
  category?: string;
  recurrence?: RecurrenceType;
  document_url?: string;
  reminder_days_before: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id?: string;
  amount: number;
  type: TransactionType;
  description: string;
  merchant?: string;
  frequency: RecurrenceType;
  interval: number;
  next_date: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  account?: Account;
  category?: Category;
}

export interface Alert {
  id: string;
  user_id: string;
  type: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  is_read: boolean;
  is_dismissed: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface AlertPreferences {
  budget_exceeded: AlertPreference;
  low_balance: AlertPreference;
  unusual_spending: AlertPreference;
  bill_upcoming: AlertPreference;
  goal_milestone: AlertPreference;
}

export interface AlertPreference {
  enabled: boolean;
  threshold?: number;
}

export interface CategoryRule {
  id: string;
  user_id: string;
  category_id: string;
  pattern: string;
  match_type: 'merchant' | 'description' | 'amount_above' | 'amount_below';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Memory {
  id: string;
  user_id: string;
  key: string;
  value: string;
  type: 'insight' | 'preference' | 'context' | 'fact';
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SyncChange {
  table_name: string;
  record_id: string;
  action: 'create' | 'update' | 'delete';
  data: Record<string, any>;
  changed_at: string;
}

export interface SyncPullResponse {
  changes: SyncChange[];
  last_pulled_at: string;
  has_more: boolean;
}

export interface SyncPushRequest {
  changes: SyncChange[];
  last_pulled_at: string;
}

export interface SyncPushResponse {
  success: boolean;
  conflicts: SyncConflict[];
}

export interface SyncConflict {
  table_name: string;
  record_id: string;
  server_version: Record<string, any>;
  client_version: Record<string, any>;
  resolved: 'server_wins' | 'client_wins';
}

export interface DashboardSummary {
  total_balance: number;
  monthly_income: number;
  monthly_expenses: number;
  net_savings: number;
  recent_transactions: Transaction[];
  spending_by_category: CategorySpending[];
  budget_status: BudgetStatus[];
  streak_days: number;
  alerts_count: number;
}

export interface CategorySpending {
  category_id: string;
  category_name: string;
  category_color?: string;
  amount: number;
  percentage: number;
  transaction_count: number;
}

export interface BudgetStatus {
  budget_id: string;
  category_name: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
}

export interface PeriodAnalysis {
  period: string;
  income: number;
  expenses: number;
  net: number;
  top_categories: CategorySpending[];
  top_merchants: MerchantSpending[];
  insights: string[];
}

export interface MerchantSpending {
  merchant: string;
  amount: number;
  transaction_count: number;
}

export interface CopilotRequest {
  message: string;
  session_id?: string;
}

export interface CopilotResponse {
  response: string;
  session_id: string;
  context?: Record<string, any>;
}

export interface CopilotSimulateRequest {
  scenario: string;
  amount?: number;
  category?: string;
  period?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_tracked_date: string;
  milestones: StreakMilestone[];
}

export interface StreakMilestone {
  days: number;
  label: string;
  unlocked: boolean;
  unlocked_at?: string;
}

export interface MilestoneBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlocked_at?: string;
  progress: number;
}

export interface SpendingPersonality {
  label: string;
  description: string;
  emoji: string;
  top_category: string;
  trait_percentages: Record<string, number>;
}

export interface MonthlyStorySlide {
  title: string;
  subtitle: string;
  emoji: string;
  data?: Record<string, any>;
}

export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'loan' | 'other';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type CategoryType = 'expense' | 'income';
export type BudgetPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type GoalStatus = 'active' | 'completed' | 'cancelled' | 'paused';
export type RecurrenceType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
export type AlertType = 'budget_exceeded' | 'low_balance' | 'unusual_spending' | 'bill_upcoming' | 'goal_milestone' | 'streak_milestone' | 'badge_unlocked';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
