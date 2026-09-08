import { format, formatDistanceToNow, parseISO } from 'date-fns';

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

const ZERO_DECIMAL = new Set(['JPY','KRW','VND']);
let cachedCurrency: string | null = null;
export function formatCurrency(amount: number, currency?: string): string {
  const cur = currency || cachedCurrency || getDefaultCurrency();
  if (!currency) cachedCurrency = cur;
  const locale = CURRENCY_LOCALE[cur] || 'en-US';
  const frac = ZERO_DECIMAL.has(cur) ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: frac,
      maximumFractionDigits: frac,
    }).format(amount);
  } catch {
    return `${cur} ${amount.toFixed(frac)}`;
  }
}

export function getDefaultCurrency(): string {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.state?.user?.settings?.currency || 'INR';
    }
  } catch {}
  return 'INR';
}

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
] as const;

export function formatDate(dateStr: string, fmt = 'MMM dd, yyyy'): string {
  try {
    return format(parseISO(dateStr), fmt);
  } catch {
    return dateStr;
  }
}

export function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export function getAccountTypeColor(type: string): string {
  const colors: Record<string, string> = {
    checking: '#0ea5e9',
    savings: '#10b981',
    credit: '#f59e0b',
    investment: '#8b5cf6',
    cash: '#06b6d4',
  };
  return colors[type] || '#64748b';
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    info: '#0ea5e9',
    warning: '#f59e0b',
    critical: '#ef4444',
  };
  return colors[severity] || '#64748b';
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getErrorMessage(err: any, fallback = 'Something went wrong'): string {
  if (!err) return fallback;
  const data = err?.response?.data ?? err?.data;
  if (data?.detail) {
    const detail = data.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d: any) => (typeof d === 'string' ? d : d?.msg || JSON.stringify(d)))
        .join('; ');
    }
    if (typeof detail === 'object') return detail.msg || JSON.stringify(detail);
  }
  if (typeof data === 'string') return data;
  if (err?.message) return err.message;
  return fallback;
}
