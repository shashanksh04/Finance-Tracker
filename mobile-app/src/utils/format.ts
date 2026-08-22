import { usePreferencesStore } from '../stores/preferencesStore';

const CURRENCY_LOCALE: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  CAD: 'en-CA',
  AUD: 'en-AU',
  SGD: 'en-SG',
  CHF: 'de-CH',
  CNY: 'zh-CN',
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  SGD: 'S$',
  CHF: 'Fr',
  CNY: '¥',
};

function getPrefsCurrency(): string {
  try {
    return usePreferencesStore.getState().prefs.currency || 'INR';
  } catch {
    return 'INR';
  }
}

export function formatCurrency(amount: number, currency?: string): string {
  const cur = currency || getPrefsCurrency();
  const locale = CURRENCY_LOCALE[cur] || 'en-US';
  const frac = cur === 'JPY' ? 0 : 2;
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  });
  return formatter.format(amount);
}

export function getCurrencySymbol(currency?: string): string {
  const cur = currency || getPrefsCurrency();
  return CURRENCY_SYMBOLS[cur] || '$';
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatProgress(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

export function daysUntil(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  return Math.ceil(diffMs / 86400000);
}

export function isIncome(t: { type?: string; amount: number }): boolean {
  if (t.type === 'income') return true;
  if (t.type === 'expense') return false;
  return t.amount >= 0;
}

export function formatTransactionAmount(t: { type?: string; amount: number }): string {
  const sign = isIncome(t) ? '+' : '-';
  return `${sign}${formatCurrency(Math.abs(t.amount))}`;
}

export function isOverdue(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() < Date.now();
}

export function getStreakLabel(days: number): string {
  if (days >= 365) return '🔥 Year Streak!';
  if (days >= 100) return '💪 Century Club!';
  if (days >= 30) return '⭐ Monthly Master!';
  if (days >= 7) return '📅 Week Warrior!';
  if (days > 0) return `✨ ${days} day streak`;
  return 'Start your streak today!';
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
