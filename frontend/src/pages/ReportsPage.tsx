import { useState, useEffect } from 'react';
import { TrendingUp, LineChart as LineChartIcon } from 'lucide-react';
import { analysisApi } from '../services/api';
import { NetWorthTrend, NetWorthPoint } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { formatCurrency, cn } from '../utils/format';
import { useThemeStore } from '../store/themeStore';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const RANGES = [6, 12, 24, 36];

export function ReportsPage() {
  const [data, setData] = useState<NetWorthTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);
  const darkMode = useThemeStore((s) => s.darkMode);

  useEffect(() => {
    setLoading(true);
    analysisApi.getNetWorthTrend(months)
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, [months]);

  if (loading) return <section className="page-container"><LoadingSpinner size="lg" /></section>;
  if (!data || data.series.length === 0) return <section className="page-container"><p className="text-surface-500 dark:text-surface-400">No data available</p></section>;

  const series: NetWorthPoint[] = data.series;
  const latest = series[series.length - 1];
  const first = series[0];
  const change = latest.net_worth - first.net_worth;
  const changePct = first.net_worth !== 0 ? Math.round((change / Math.abs(first.net_worth)) * 100) : 0;

  return (
    <section className="page-container">
      <PageHeader title="Reports" subtitle="Track your net worth over time"
        action={
          <div className="flex items-center gap-3">
            <select value={months} onChange={(e) => setMonths(parseInt(e.target.value))} className="select-field w-32">
              {RANGES.map((r) => <option key={r} value={r}>{r} months</option>)}
            </select>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Current Net Worth" value={formatCurrency(latest.net_worth)} icon={<TrendingUp className="w-5 h-5" />} color="primary" />
        <StatCard label="Assets" value={formatCurrency(latest.assets)} icon={<TrendingUp className="w-5 h-5" />} color="emerald" />
        <StatCard label="Liabilities" value={formatCurrency(latest.liabilities)} icon={<LineChartIcon className="w-5 h-5" />} color="rose" />
      </div>

      <div className="card p-6 mb-8">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">
          Net Worth Trend {change >= 0 ? `(+${formatCurrency(change)})` : `(${formatCurrency(change)})`} · {changePct}% over period
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <defs>
                <linearGradient id="assetsArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="liabilitiesArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }} />
              <YAxis tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} tickFormatter={(v) => formatCurrency(v)} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, background: darkMode ? '#0f172a' : 'white' }}
                formatter={(v: number, name: string) => {
                  const colors: Record<string, string> = { assets: '#10b981', liabilities: '#ef4444', net_worth: '#0ea5e9' };
                  const labels: Record<string, string> = { assets: 'Assets', liabilities: 'Liabilities', net_worth: 'Net Worth' };
                  return [<span style={{ color: colors[name] || '#64748b', fontWeight: 600 }}>{formatCurrency(v)}</span>, labels[name] || name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="assets" stroke="#10b981" strokeWidth={2} fill="url(#assetsArea)" />
              <Area type="monotone" dataKey="liabilities" stroke="#ef4444" strokeWidth={2} fill="url(#liabilitiesArea)" />
              <Line type="monotone" dataKey="net_worth" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">Monthly Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-surface-500 dark:text-surface-400 border-b border-surface-100 dark:border-surface-700">
                <th className="py-2 pr-4 font-medium">Month</th>
                <th className="py-2 pr-4 font-medium text-right">Assets</th>
                <th className="py-2 pr-4 font-medium text-right">Liabilities</th>
                <th className="py-2 font-medium text-right">Net Worth</th>
              </tr>
            </thead>
            <tbody>
              {series.map((p) => (
                <tr key={p.month} className="border-b border-surface-100 dark:border-surface-700 last:border-0">
                  <td className="py-2 pr-4">{p.label}</td>
                  <td className="py-2 pr-4 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(p.assets)}</td>
                  <td className="py-2 pr-4 text-right text-red-600 dark:text-red-400">{formatCurrency(p.liabilities)}</td>
                  <td className={cn('py-2 text-right font-semibold', p.net_worth >= 0 ? 'text-surface-900 dark:text-surface-100' : 'text-red-600 dark:text-red-400')}>{formatCurrency(p.net_worth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
