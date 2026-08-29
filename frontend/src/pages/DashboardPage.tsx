import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Target, ArrowUpRight, DollarSign, Bell, Plus } from 'lucide-react';
import { analysisApi, transactionsApi, accountsApi, categoriesApi } from '../services/api';
import { DashboardSummary, Account, Category } from '../types';
import { transactionSchema, TransactionForm } from '../utils/validation';
import { StatCard } from '../components/ui/StatCard';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { PageHeader } from '../components/ui/PageHeader';
import { formatCurrency, formatDate, cn } from '../utils/format';
import { useThemeStore } from '../store/themeStore';
import { useWebSocket } from '../hooks/useWebSocket';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { register, handleSubmit: formSubmit, reset, setValue, watch: watchForm, formState: { errors } } = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { account_id: '', category_id: '', amount: 0, type: 'expense', description: '', merchant: '', date: new Date().toISOString().split('T')[0] },
  });
  const txnType = watchForm('type');
  const navigate = useNavigate();
  const darkMode = useThemeStore((s) => s.darkMode);

  const load = useCallback(async () => {
    try { const { data } = await analysisApi.getDashboard(); setData(data); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    accountsApi.getAll().then(({ data }) => setAccounts(data)).catch(() => {});
    categoriesApi.getAll().then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  const onSubmit = async (data: TransactionForm) => {
    try {
      await transactionsApi.create(data);
      toast.success('Transaction created');
      setShowModal(false);
      load();
      loadAccountsAndCategories();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to create transaction'); }
  };

  const loadAccountsAndCategories = useCallback(() => {
    accountsApi.getAll().then(({ data }) => setAccounts(data)).catch(() => {});
    categoriesApi.getAll().then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  useWebSocket({
    dashboard_updated: () => { load(); loadAccountsAndCategories(); },
    alerts_updated: () => load(),
  });

  if (loading) return <section className="page-container"><LoadingSpinner size="lg" /></section>;
  if (!data) return <section className="page-container"><p className="text-surface-500 dark:text-surface-400">Unable to load dashboard</p></section>;

  const pieData = data.spending_by_category.map((c) => ({ name: c.category_name, value: c.amount }));
  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];

  return (
    <section className="page-container">
      <PageHeader title="Dashboard" subtitle="Your financial overview at a glance"
        action={<button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Transaction</button>} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Balance" value={formatCurrency(data.total_balance)} icon={<DollarSign className="w-5 h-5" />} color="primary" />
        <StatCard label="Monthly Income" value={formatCurrency(data.monthly_income)} icon={<TrendingUp className="w-5 h-5" />} color="emerald" />
        <StatCard label="Monthly Expenses" value={formatCurrency(data.monthly_expenses)} icon={<TrendingDown className="w-5 h-5" />} color="rose" />
        <StatCard label="Net Savings" value={formatCurrency(data.net_worth_change)} change={data.monthly_income > 0 ? Math.round((data.net_worth_change / data.monthly_income) * 100) : 0} icon={<PiggyBank className="w-5 h-5" />} color="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">Income vs Expenses</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Income', amount: data.monthly_income },
                { name: 'Expenses', amount: data.monthly_expenses },
                { name: 'Net', amount: data.net_worth_change },
              ]}>
                <defs>
                  <linearGradient id="incomeBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.85} />
                  </linearGradient>
                  <linearGradient id="expenseBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0.85} />
                  </linearGradient>
                  <linearGradient id="netBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity={0.85} />
                  </linearGradient>
                  <filter id="barShadow">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} />
                <XAxis dataKey="name" tick={{ fontSize: 13, fill: darkMode ? '#94a3b8' : '#64748b' }} axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }} />
                <YAxis tick={{ fontSize: 12, fill: darkMode ? '#94a3b8' : '#64748b' }} tickFormatter={(v) => formatCurrency(v)} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: darkMode ? '#1e293b' : '#f1f5f9' }}
                  contentStyle={{
                    borderRadius: '12px',
                    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                    background: darkMode ? '#0f172a' : 'white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    color: darkMode ? '#f1f5f9' : '#0f172a',
                  }}
                  formatter={(v: number, name: string) => {
                    const colors: Record<string, string> = { Income: '#10b981', Expenses: '#ef4444', Net: '#0ea5e9' };
                    return [<span style={{ color: colors[name] || '#64748b', fontWeight: 600 }}>{formatCurrency(v)}</span>, undefined];
                  }}
                  labelStyle={{ fontWeight: 600, fontSize: 13, color: darkMode ? '#f1f5f9' : '#0f172a', marginBottom: 4 }}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={80} animationBegin={100} animationDuration={800} filter="url(#barShadow)">
                  <Cell fill="url(#incomeBar)" />
                  <Cell fill="url(#expenseBar)" />
                  <Cell fill="url(#netBar)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">Spending by Category</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1.5">
            {data.spending_by_category.slice(0, 5).map((c, i) => (
              <div key={c.category_name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-surface-600 dark:text-surface-400">{c.category_name}</span>
                </div>
                <span className="font-medium text-surface-900 dark:text-surface-100">{formatCurrency(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Recent Transactions</h2>
            <button onClick={() => navigate('/transactions')} className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:text-primary-700 dark:hover:text-primary-300">View all</button>
          </div>
          <div className="space-y-3">
            {data.recent_transactions.slice(0, 5).map((txn) => (
              <div key={txn.id} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-700 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', txn.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-red-50 dark:bg-red-900/30')}>
                    {txn.type === 'income' ? <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{txn.description || 'Transaction'}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">{formatDate(txn.date)}</p>
                  </div>
                </div>
                <span className={cn('text-sm font-semibold', txn.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                  {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Upcoming Bills</h2>
            <button onClick={() => navigate('/bills')} className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:text-primary-700 dark:hover:text-primary-300">View all</button>
          </div>
          {data.upcoming_bills.length > 0 ? (
            <div className="space-y-3">
              {data.upcoming_bills.map((bill) => (
                <div key={bill.id} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-700 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{bill.name}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">Due {formatDate(bill.due_date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(bill.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-surface-500 dark:text-surface-400 text-center py-8">No upcoming bills</p>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Goal Progress</h2>
            <button onClick={() => navigate('/goals')} className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:text-primary-700 dark:hover:text-primary-300">View all</button>
          </div>
          {data.goal_progress.length > 0 ? (
            <div className="space-y-4">
              {data.goal_progress.map((goal) => (
                <div key={goal.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-surface-900 dark:text-surface-100">{goal.name}</span>
                    <span className="text-xs font-medium text-surface-500 dark:text-surface-400">{goal.progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill bg-primary-500" style={{ width: `${Math.min(goal.progress, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-surface-500 dark:text-surface-400 text-center py-8">No goals set yet</p>
          )}
        </div>
      </div>

      {data.alerts.length > 0 && (
        <div className="mt-6 card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Recent Alerts</h2>
            <button onClick={() => navigate('/alerts')} className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:text-primary-700 dark:hover:text-primary-300">View all</button>
          </div>
          <div className="space-y-2">
            {data.alerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="flex items-center gap-3 p-3 bg-surface-50 dark:bg-surface-950 rounded-xl">
                <Bell className={cn('w-4 h-4', alert.severity === 'critical' ? 'text-red-500 dark:text-red-400' : alert.severity === 'warning' ? 'text-amber-500 dark:text-amber-400' : 'text-primary-500 dark:text-primary-400')} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{alert.title}</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Transaction">
        <form onSubmit={formSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Type</label>
              <div className="flex rounded-xl border border-surface-300 dark:border-surface-600 overflow-hidden">
                <button type="button" onClick={() => { setValue('type', 'income'); setValue('category_id', ''); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${txnType === 'income' ? 'bg-emerald-500 text-white' : 'bg-transparent text-surface-600 dark:text-surface-400'}`}>Income</button>
                <button type="button" onClick={() => { setValue('type', 'expense'); setValue('category_id', ''); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${txnType === 'expense' ? 'bg-red-500 text-white' : 'bg-transparent text-surface-600 dark:text-surface-400'}`}>Expense</button>
              </div>
            </div>
            <div>
              <label className="input-label">Amount</label>
              <input type="number" step="0.01" {...register('amount')}
                className="input-field" />
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
            </div>
          </div>
          <div>
            <label className="input-label">Account</label>
            <select {...register('account_id')} className="select-field">
              <option value="">Select account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {errors.account_id && <p className="text-xs text-red-500 mt-1">{errors.account_id.message}</p>}
          </div>
          <div>
            <label className="input-label">Category</label>
            <select {...register('category_id')} className="select-field">
              <option value="">No category</option>
              {categories.filter((c) => c.type === txnType).map((c) => (
                <option key={c.id} value={c.id}>{c.icon || ''} {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Description</label>
            <input type="text" {...register('description')}
              className="input-field" placeholder="Groceries, Salary, etc." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Merchant</label>
              <input type="text" {...register('merchant')}
                className="input-field" placeholder="Store name" />
            </div>
            <div>
              <label className="input-label">Date</label>
              <input type="date" {...register('date')}
                className="input-field" />
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date.message}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
