import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, PieChart, Download } from 'lucide-react';
import { analysisApi } from '../services/api';
import { PeriodAnalysis } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { formatCurrency, cn } from '../utils/format';
import { useThemeStore } from '../store/themeStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart as RePie, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];

export function AnalysisPage() {
  const [data, setData] = useState<PeriodAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const darkMode = useThemeStore((s) => s.darkMode);

  useEffect(() => {
    setLoading(true);
    const params: any = { period, year };
    if (period === 'monthly') params.month = month;
    analysisApi.getPeriod(params).then(({ data }) => setData(data)).finally(() => setLoading(false));
  }, [period, year, month]);

  if (loading) return <section className="page-container"><LoadingSpinner size="lg" /></section>;
  if (!data) return <section className="page-container"><p className="text-surface-500 dark:text-surface-400">No data available</p></section>;

  return (
    <section className="page-container">
      <PageHeader title="Analysis" subtitle="Deep dive into your financial data"
        action={
          <div className="flex items-center gap-3">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="select-field w-32">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
            {period === 'monthly' && (
              <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="select-field w-32">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('en', { month: 'long' })}</option>
                ))}
              </select>
            )}
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="select-field w-24">
              {Array.from({ length: 5 }, (_, i) => (
                <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>
              ))}
            </select>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Income" value={formatCurrency(data.total_income)} icon={<TrendingUp className="w-5 h-5" />} color="emerald" />
        <StatCard label="Total Expenses" value={formatCurrency(data.total_expenses)} icon={<TrendingDown className="w-5 h-5" />} color="rose" />
        <StatCard label="Net Savings" value={formatCurrency(data.net_savings)} icon={<DollarSign className="w-5 h-5" />} color="primary" />
        <StatCard label="Savings Rate" value={`${data.savings_rate}%`} icon={<PieChart className="w-5 h-5" />} color="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">Income vs Expenses Trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trends}>
                <defs>
                  <linearGradient id="incomeArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="expenseArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} />
                <XAxis dataKey="period_label" tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }} />
                <YAxis tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} tickFormatter={(v) => formatCurrency(v)} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                    background: darkMode ? '#0f172a' : 'white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  formatter={(v: number, name: string) => {
                    const colors: Record<string, string> = { income: '#10b981', expenses: '#ef4444' };
                    const labels: Record<string, string> = { income: 'Income', expenses: 'Expenses' };
                    return [<span style={{ color: colors[name] || '#64748b', fontWeight: 600 }}>{formatCurrency(v)}</span>, labels[name] || name];
                  }}
                  labelStyle={{ fontWeight: 600, fontSize: 13, color: darkMode ? '#f1f5f9' : '#0f172a', marginBottom: 4 }}
                />
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ color: darkMode ? '#cbd5e1' : '#475569', fontSize: 12 }}>{value === 'income' ? 'Income' : 'Expenses'}</span>}
                />
                <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2.5} fill="url(#incomeArea)" dot={{ fill: '#10b981', stroke: darkMode ? '#0f172a' : 'white', strokeWidth: 2, r: 4 }} activeDot={{ fill: '#10b981', stroke: 'white', strokeWidth: 3, r: 6 }} />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} fill="url(#expenseArea)" dot={{ fill: '#ef4444', stroke: darkMode ? '#0f172a' : 'white', strokeWidth: 2, r: 4 }} activeDot={{ fill: '#ef4444', stroke: 'white', strokeWidth: 3, r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">Spending by Category</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RePie>
                <Pie data={data.category_breakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="amount" nameKey="category_name">
                  {data.category_breakdown.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, background: darkMode ? '#0f172a' : 'white' }} formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </RePie>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">Category Breakdown</h3>
          <div className="space-y-3">
            {data.category_breakdown.map((cat, idx) => (
              <div key={cat.category_name} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-surface-700 dark:text-surface-300">{cat.category_name}</span>
                    <span className="font-medium text-surface-900 dark:text-surface-100">{formatCurrency(cat.amount)} ({cat.percentage}%)</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${cat.percentage}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                  </div>
                </div>
              </div>
            ))}
            {data.category_breakdown.length === 0 && <p className="text-sm text-surface-500 dark:text-surface-400 text-center py-4">No expense data</p>}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">Top Merchants</h3>
          <div className="space-y-3">
            {data.top_merchants.map((m, idx) => (
              <div key={m.merchant} className="flex items-center justify-between py-2 border-b border-surface-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-xs font-medium text-surface-600 dark:text-surface-400">{idx + 1}</span>
                  <span className="text-sm font-medium text-surface-900 dark:text-surface-100">{m.merchant}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">{formatCurrency(m.total)}</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">{m.count} transactions</p>
                </div>
              </div>
            ))}
            {data.top_merchants.length === 0 && <p className="text-sm text-surface-500 dark:text-surface-400 text-center py-4">No merchant data</p>}
          </div>
        </div>
      </div>

      {data.insights.length > 0 && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary-500 dark:text-primary-400" /> Insights
          </h3>
          <div className="space-y-2">
            {data.insights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-primary-50 dark:bg-primary-900/30 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-xs font-semibold text-primary-700 dark:text-primary-300 mt-0.5">{idx + 1}</div>
                <p className="text-sm text-surface-700 dark:text-surface-300">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
