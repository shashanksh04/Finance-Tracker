import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Repeat, Trash2, Edit3, Play, Pause } from 'lucide-react';
import { recurringApi, accountsApi, categoriesApi } from '../services/api';
import { RecurringTransaction, Account, Category } from '../types';
import { recurringSchema, RecurringForm } from '../utils/validation';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, formatDate, cn } from '../utils/format';
import toast from 'react-hot-toast';

export function RecurringPage() {
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const { register, handleSubmit: formSubmit, reset, formState: { errors } } = useForm<RecurringForm>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      account_id: '', category_id: '', amount: 0, type: 'expense', description: '',
      merchant: '', frequency: 'monthly', interval_value: 1, next_date: new Date().toISOString().split('T')[0], end_date: ''
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rData } = await recurringApi.getAll();
      const { data: aData } = await accountsApi.getAll();
      const { data: cData } = await categoriesApi.getAll();
      setItems(rData); setAccounts(aData); setCategories(cData);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    reset({
      account_id: accounts[0]?.id || '', category_id: '', amount: 0, type: 'expense',
      description: '', merchant: '', frequency: 'monthly', interval_value: 1,
      next_date: new Date().toISOString().split('T')[0], end_date: ''
    });
    setShowModal(true);
  };

  const openEdit = (item: RecurringTransaction) => {
    setEditing(item);
    reset({
      account_id: item.account_id, category_id: item.category_id || '', amount: item.amount,
      type: item.type, description: item.description, merchant: item.merchant || '',
      frequency: item.frequency, interval_value: item.interval_value,
      next_date: item.next_date, end_date: item.end_date || ''
    });
    setShowModal(true);
  };

  const onSubmit = async (data: RecurringForm) => {
    try {
      const payload = { ...data, end_date: data.end_date || null, category_id: data.category_id || null };
      if (editing) { await recurringApi.update(editing.id, payload); toast.success('Updated'); }
      else { await recurringApi.create(payload); toast.success('Created'); }
      setShowModal(false); load();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to save'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring transaction?')) return;
    try { await recurringApi.delete(id); toast.success('Deleted'); load(); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to delete'); }
  };

  const toggleActive = async (item: RecurringTransaction) => {
    try { await recurringApi.update(item.id, { is_active: !item.is_active }); toast.success(item.is_active ? 'Paused' : 'Resumed'); load(); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to toggle'); }
  };

  if (loading) return <section className="page-container"><LoadingSpinner size="lg" /></section>;

  return (
    <section className="page-container">
      <PageHeader title="Recurring" subtitle="Manage recurring transactions"
        action={<button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Add Recurring</button>} />

      {items.length === 0 ? (
        <EmptyState title="No recurring transactions" description="Set up recurring income or expenses" action={{ label: 'Add Recurring', onClick: openCreate }} />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className={cn('card-hover p-4 flex items-center justify-between', !item.is_active && 'opacity-50')}>
              <div className="flex items-center gap-4 flex-1">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', item.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-red-50 dark:bg-red-900/30')}>
                  <Repeat className={cn('w-5 h-5', item.type === 'income' ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-surface-900 dark:text-surface-100">{item.description}</h3>
                    <span className={item.is_active ? 'badge-success' : 'badge-neutral'}>{item.is_active ? 'Active' : 'Paused'}</span>
                  </div>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    {item.frequency} {item.interval_value > 1 ? `(every ${item.interval_value})` : ''} · Next: {formatDate(item.next_date)} · {item.account_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn('text-lg font-bold', item.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 capitalize">{item.frequency}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button onClick={() => toggleActive(item)} className="btn-ghost p-2">
                  {item.is_active ? <Pause className="w-4 h-4 text-amber-500 dark:text-amber-400" /> : <Play className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />}
                </button>
                <button onClick={() => openEdit(item)} className="btn-ghost p-2"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(item.id)} className="btn-ghost p-2 text-red-500 dark:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Recurring' : 'New Recurring Transaction'}>
        <form onSubmit={formSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Type</label>
              <select {...register('type')} className="select-field">
                <option value="expense">Expense</option><option value="income">Income</option>
              </select>
            </div>
            <div>
              <label className="input-label">Amount</label>
              <input type="number" step="0.01" {...register('amount')} className="input-field" />
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
            <label className="input-label">Description</label>
            <input type="text" {...register('description')} className="input-field" />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Frequency</label>
              <select {...register('frequency')} className="select-field">
                <option value="daily">Daily</option><option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option><option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="input-label">Interval</label>
              <input type="number" min="1" {...register('interval_value')} className="input-field" />
              {errors.interval_value && <p className="text-xs text-red-500 mt-1">{errors.interval_value.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Next Date</label>
              <input type="date" {...register('next_date')} className="input-field" />
              {errors.next_date && <p className="text-xs text-red-500 mt-1">{errors.next_date.message}</p>}
            </div>
            <div>
              <label className="input-label">End Date (optional)</label>
              <input type="date" {...register('end_date')} className="input-field" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
