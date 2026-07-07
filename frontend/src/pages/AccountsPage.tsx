import { useState, useEffect, useCallback } from 'react';
import { Plus, Wallet, CreditCard, PiggyBank, TrendingUp, Building2, Trash2, Edit3, MoreHorizontal } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { accountsApi } from '../services/api';
import { Account } from '../types';
import { accountSchema, AccountForm } from '../utils/validation';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, getAccountTypeColor, cn } from '../utils/format';
import toast from 'react-hot-toast';

const accountIcons: Record<string, any> = { checking: Wallet, savings: PiggyBank, credit: CreditCard, investment: TrendingUp, cash: Building2 };

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { register, handleSubmit: formSubmit, reset, formState: { errors } } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: '', type: 'checking', balance: 0, currency: 'USD', icon: '', color: '' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await accountsApi.getAll(false, page, 12);
      if (data.items) { setAccounts(data.items); setTotalPages(data.total_pages); }
      else { setAccounts(data); setTotalPages(1); }
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to load accounts'); } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); reset({ name: '', type: 'checking', balance: 0, currency: 'USD', icon: '', color: '' }); setShowModal(true); };
  const openEdit = (a: Account) => { setEditing(a); reset({ name: a.name, type: a.type, balance: a.balance, currency: a.currency, icon: a.icon || '', color: a.color || '' }); setShowModal(true); };

  const onSubmit = async (data: AccountForm) => {
    try {
      if (editing) { await accountsApi.update(editing.id, data); toast.success('Account updated'); }
      else { await accountsApi.create(data); toast.success('Account created'); }
      setShowModal(false); load();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to save account'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this account? All transactions will be removed.')) return;
    try { await accountsApi.delete(id); toast.success('Account deleted'); load(); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to delete account'); }
  };

  const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

  if (loading) return <section className="page-container"><LoadingSpinner size="lg" /></section>;

  return (
    <section className="page-container">
      <PageHeader title="Accounts" subtitle="Manage your financial accounts"
        action={<button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Add Account</button>} />

      {accounts.length === 0 ? (
        <EmptyState title="No accounts yet" description="Add your first account to start tracking your finances" action={{ label: 'Add Account', onClick: openCreate }} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account, idx) => {
              const Icon = accountIcons[account.type] || Wallet;
              return (
                <div key={account.id} className="card-hover p-5 animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${account.color || colors[idx % colors.length]}15`, color: account.color || colors[idx % colors.length] }}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-surface-900 dark:text-surface-100">{account.name}</h3>
                        <span className="text-xs text-surface-500 dark:text-surface-400 capitalize">{account.type}</span>
                      </div>
                    </div>
                    <div className="relative group">
                      <button className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4 text-surface-400 dark:text-surface-500" />
                      </button>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-4">{formatCurrency(account.balance, account.currency)}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-surface-100 dark:border-surface-700">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(account)} className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">Edit</button>
                      <button onClick={() => handleDelete(account.id)} className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:text-red-400 font-medium">Delete</button>
                    </div>
                    <span className="text-xs text-surface-400 dark:text-surface-500">{account.is_archived ? 'Archived' : 'Active'}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Previous</button>
              <span className="text-sm text-surface-500 dark:text-surface-400">Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
            </div>
          )}
        </>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Account' : 'New Account'}>
        <form onSubmit={formSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="input-label">Account Name</label>
            <input type="text" {...register('name')}
              className="input-field" placeholder="My Checking Account" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Type</label>
              <select {...register('type')} className="select-field">
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit</option>
                <option value="investment">Investment</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="input-label">Balance</label>
              <input type="number" step="0.01" {...register('balance')}
                className="input-field" />
              {errors.balance && <p className="text-xs text-red-500 mt-1">{errors.balance.message}</p>}
            </div>
          </div>
          <div>
            <label className="input-label">Currency</label>
            <select {...register('currency')} className="select-field">
              {['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
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
