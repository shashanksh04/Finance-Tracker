import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, PiggyBank, Trash2, Edit3, AlertTriangle } from 'lucide-react';
import { budgetsApi, categoriesApi } from '../services/api';
import { Budget, Category } from '../types';
import { budgetSchema, BudgetForm } from '../utils/validation';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, cn } from '../utils/format';
import toast from 'react-hot-toast';

export function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { register, handleSubmit: formSubmit, reset, formState: { errors } } = useForm<BudgetForm>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { category_id: '', amount: 0, period: 'monthly', start_date: new Date().toISOString().split('T')[0], end_date: '', rollover: false },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: bData } = await budgetsApi.getAll(false, page, 12);
      const { data: cData } = await categoriesApi.getAll('expense');
      if (bData.items) { setBudgets(bData.items); setTotalPages(bData.total_pages); }
      else { setBudgets(bData); setTotalPages(1); }
      setCategories(cData);
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to load budgets'); } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); reset({ category_id: '', amount: 0, period: 'monthly', start_date: new Date().toISOString().split('T')[0], end_date: '', rollover: false }); setShowModal(true); };
  const openEdit = (b: Budget) => { setEditing(b); reset({ category_id: b.category_id || '', amount: b.amount, period: b.period, start_date: b.start_date, end_date: b.end_date || '', rollover: b.rollover }); setShowModal(true); };

  const onSubmit = async (data: BudgetForm) => {
    try {
      const payload = { ...data, end_date: data.end_date || null, category_id: data.category_id || null };
      if (editing) { await budgetsApi.update(editing.id, payload); toast.success('Budget updated'); }
      else { await budgetsApi.create(payload); toast.success('Budget created'); }
      setShowModal(false); load();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to save budget'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget?')) return;
    try { await budgetsApi.delete(id); toast.success('Budget deleted'); load(); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to delete budget'); }
  };

  if (loading) return <section className="page-container"><LoadingSpinner size="lg" /></section>;

  return (
    <section className="page-container">
      <PageHeader title="Budgets" subtitle="Set and track your spending limits"
        action={<button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> New Budget</button>} />

      {budgets.length === 0 ? (
        <EmptyState title="No budgets yet" description="Create budgets to control your spending" action={{ label: 'Create Budget', onClick: openCreate }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((budget) => (
            <div key={budget.id} className="card p-5 animate-fade-in">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', budget.percentage > 90 ? 'bg-red-50 dark:bg-red-900/30' : budget.percentage > 70 ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-primary-50 dark:bg-primary-900/30')}>
                    <PiggyBank className={cn('w-5 h-5', budget.percentage > 90 ? 'text-red-500 dark:text-red-400' : budget.percentage > 70 ? 'text-amber-500 dark:text-amber-400' : 'text-primary-500 dark:text-primary-400')} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-900 dark:text-surface-100">{budget.category_name || 'Overall'}</h3>
                    <span className="text-xs text-surface-500 dark:text-surface-400 capitalize">{budget.period}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(budget)} className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"><Edit3 className="w-3.5 h-3.5 text-surface-400 dark:text-surface-500" /></button>
                  <button onClick={() => handleDelete(budget.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              </div>

              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{formatCurrency(budget.spent)}</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">of {formatCurrency(budget.amount)}</p>
                </div>
                <span className={cn('text-sm font-semibold', budget.remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                  {budget.remaining >= 0 ? formatCurrency(budget.remaining) : `-${formatCurrency(Math.abs(budget.remaining))}`}
                  <span className="text-xs text-surface-500 dark:text-surface-400 ml-1">left</span>
                </span>
              </div>

              <div className="progress-bar">
                <div className={cn('progress-fill', budget.percentage > 90 ? 'bg-red-500' : budget.percentage > 70 ? 'bg-amber-500' : 'bg-primary-500')}
                  style={{ width: `${Math.min(budget.percentage, 100)}%` }} />
              </div>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-2">{budget.percentage}% used</p>

              {budget.percentage > 90 && (
                <div className="flex items-center gap-1.5 mt-3 p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium">Budget nearly exceeded!</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Previous</button>
          <span className="text-sm text-surface-500 dark:text-surface-400">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Budget' : 'New Budget'}>
        <form onSubmit={formSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="input-label">Category (optional)</label>
            <select {...register('category_id')} className="select-field">
              <option value="">Overall Budget</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Budget Amount</label>
              <input type="number" step="0.01" {...register('amount')}
                className="input-field" />
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="input-label">Period</label>
              <select {...register('period')} className="select-field">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Start Date</label>
              <input type="date" {...register('start_date')} className="input-field" />
              {errors.start_date && <p className="text-xs text-red-500 mt-1">{errors.start_date.message}</p>}
            </div>
            <div>
              <label className="input-label">End Date (optional)</label>
              <input type="date" {...register('end_date')} className="input-field" />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('rollover')} className="rounded border-surface-300 dark:border-surface-600 text-primary-600 dark:text-primary-400" />
            <span className="text-sm text-surface-700 dark:text-surface-300">Rollover unused budget to next period</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
