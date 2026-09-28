import { useState, useEffect } from 'react';
import { Wallet, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Landmark } from 'lucide-react';
import { analysisApi, accountsApi, toList } from '../services/api';
import { CashflowProjection, Account } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { formatCurrency, cn } from '../utils/format';
import { useThemeStore } from '../store/themeStore';
import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';

const RANGES = [14, 30, 60, 90, 180, 365];

export function CashflowPage() {
  const [data, setData] = useState<CashflowProjection | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const darkMode = useThemeStore((s) => s.darkMode);

  useEffect(() => {
    accountsApi
      .getAll()
      .then((r) => setAccounts(toList<Account>(r.data)))
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    analysisApi
      .getCashflow(days, accountId || undefined)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days, accountId]);

  if (loading) return <LoadingSpinner />;
  if (!data) {
    return (
      <div>
        <PageHeader title="Cashflow" subtitle="Projected balance over time" />
        <div className="card p-12 text-center text-sm text-surface-500">No projection available.</div>
      </div>
    );
  }

  const net = data.total_inflow - data.total_outflow;
  const axis = darkMode ? '#94a3b8' : '#64748b';
  const grid = darkMode ? '#334155' : '#e2e8f0';

  return (
    <div>
      <PageHeader title="Cashflow" subtitle={`${data.granularity === 'daily' ? 'Daily' : 'Weekly'} projection to ${data.end_date}`} />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 p-1 bg-surface-100 dark:bg-surface-800 rounded-lg">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                days === r
                  ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm'
                  : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300',
              )}
            >
              {r}d
            </button>
          ))}
        </div>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="select-field w-48"
        >
          <option value="">All liquid accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.type})
            </option>
          ))}
        </select>
      </div>

      {data.is_overdrawn && (
        <div className="flex items-start gap-3 p-4 mb-6 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-rose-800 dark:text-rose-200">Projected to go negative.</span>{' '}
            <span className="text-rose-700 dark:text-rose-300">
              Balance is projected to reach {formatCurrency(data.lowest_point.balance, data.currency)}
              {data.lowest_point.label ? ` in ${data.lowest_point.label}` : ''} (day {data.lowest_point.in_days}).
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Available Now"
          value={formatCurrency(data.opening_balance, data.currency)}
          icon={<Wallet className="w-5 h-5" />}
          color="primary"
        />
        <StatCard
          label="Money In"
          value={formatCurrency(data.total_inflow, data.currency)}
          icon={<ArrowUpCircle className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          label="Money Out"
          value={formatCurrency(data.total_outflow, data.currency)}
          icon={<ArrowDownCircle className="w-5 h-5" />}
          color="rose"
        />
        <StatCard
          label={net >= 0 ? 'Net Change' : 'Net Shortfall'}
          value={formatCurrency(Math.abs(net), data.currency)}
          icon={<Landmark className="w-5 h-5" />}
          color={net >= 0 ? 'cyan' : 'amber'}
        />
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">
          Projected Balance
        </h3>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={data.buckets} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="cashflowBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={{ fontSize: 11, fill: axis }} tickLine={false} axisLine={false} width={72} tickFormatter={(v: number) => formatCurrency(v, data.currency)} />
            <Tooltip
              contentStyle={{
                backgroundColor: darkMode ? '#1e293b' : '#ffffff',
                border: `1px solid ${grid}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: any, name: string) => [
                formatCurrency(Number(value), data.currency),
                name === 'inflow' ? 'In' : name === 'outflow' ? 'Out' : 'Balance',
              ]}
            />
            <Legend formatter={(v: string) => (v === 'inflow' ? 'Money in' : v === 'outflow' ? 'Money out' : 'Balance')} />
            <Bar dataKey="inflow" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={18} />
            <Bar dataKey="outflow" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={18} />
            <Area type="monotone" dataKey="closing_balance" stroke="#6366f1" strokeWidth={2} fill="url(#cashflowBalance)" />
            <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div className="card p-4">
          <p className="stat-label">Balance at {data.end_date}</p>
          <p className="text-lg font-semibold text-surface-900 dark:text-surface-100">
            {formatCurrency(data.projected_closing_balance, data.currency)}
          </p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Lowest Point</p>
          <p className="text-lg font-semibold text-surface-900 dark:text-surface-100">
            {formatCurrency(data.lowest_point.balance, data.currency)}
          </p>
          {data.lowest_point.label && (
            <p className="text-xs text-surface-500">{data.lowest_point.label}</p>
          )}
        </div>
        <div className="card p-4">
          <p className="stat-label">Liabilities (not netted)</p>
          <p className="text-lg font-semibold text-surface-900 dark:text-surface-100">
            {formatCurrency(data.liabilities, data.currency)}
          </p>
        </div>
      </div>

      <p className="mt-6 text-xs text-surface-400">
        Projection combines unpaid bills, active recurring transactions, and future-dated transactions within the
        window. Balances exclude already-scheduled future transactions so they are not double-counted. Credit and loan
        balances are shown separately and are not netted against available cash.
      </p>
    </div>
  );
}
