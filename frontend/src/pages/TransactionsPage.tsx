import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, ArrowUpDown, Trash2, Edit3, Upload, Receipt, Download } from 'lucide-react';
import { transactionsApi, accountsApi, categoriesApi, ocrApi } from '../services/api';
import { ImportModal } from '../components/import/ImportModal';
import { Transaction, PaginatedTransactions, Account, Category } from '../types';
import { transactionSchema, TransactionForm } from '../utils/validation';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { formatCurrency, formatDate, cn } from '../utils/format';
import toast from 'react-hot-toast';

export function TransactionsPage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<PaginatedTransactions | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: searchParams.get('search') || '', type: '', account_id: '' });
  const { register, handleSubmit: formSubmit, reset, setValue, watch: watchForm, formState: { errors } } = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { account_id: '', category_id: '', amount: 0, type: 'expense', description: '', merchant: '', date: new Date().toISOString().split('T')[0] },
  });
  const txnType = watchForm('type');
  const [ocrScan, setOcrScan] = useState<{ amount: number; description: string; merchant: string; date: string; account_id: string; category_id: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: 20 };
      if (filters.search) params.search = filters.search;
      if (filters.type) params.type = filters.type;
      if (filters.account_id) params.account_id = filters.account_id;
      const { data: txnData } = await transactionsApi.getAll(params);
      setData(txnData);
    } finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    accountsApi.getAll().then(({ data }) => setAccounts(data));
    categoriesApi.getAll().then(({ data }) => setCategories(data));
  }, []);

  const openCreate = () => { setEditing(null); reset({ account_id: accounts[0]?.id || '', category_id: '', amount: 0, type: 'expense', description: '', merchant: '', date: new Date().toISOString().split('T')[0] }); setShowModal(true); };
  const openEdit = (txn: Transaction) => { setEditing(txn); reset({ account_id: txn.account_id, category_id: txn.category_id || '', amount: txn.amount, type: txn.type as 'income' | 'expense', description: txn.description, merchant: txn.merchant || '', date: txn.date }); setShowModal(true); };

  const onSubmit = async (data: TransactionForm) => {
    try {
      if (editing) {
        await transactionsApi.update(editing.id, data);
        toast.success('Transaction updated');
      } else {
        await transactionsApi.create(data);
        toast.success('Transaction created');
      }
      setShowModal(false);
      load();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to save transaction'); } finally {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    try { await transactionsApi.delete(id); toast.success('Transaction deleted'); load(); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to delete transaction'); }
  };

  const handleBillScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const { data } = await ocrApi.scan(file);
      e.target.value = '';
      if (data.confidence && data.confidence > 0) {
        setOcrScan({
          amount: data.extracted_amount || 0,
          description: data.extracted_merchant || 'Bill payment',
          merchant: data.extracted_merchant || '',
          date: data.extracted_due_date || new Date().toISOString().split('T')[0],
          account_id: accounts[0]?.id || '',
          category_id: '',
        });
      } else {
        toast.error('No text could be read from the file');
      }
    } catch { toast.error('Failed to scan file'); }
    finally { setScanning(false); }
  };

  const confirmOcrTransaction = async () => {
    if (!ocrScan) return;
    if (!ocrScan.account_id) { toast.error('Select an account'); return; }
    try {
      await transactionsApi.create({
        account_id: ocrScan.account_id,
        category_id: ocrScan.category_id || null,
        amount: ocrScan.amount,
        type: 'expense',
        description: ocrScan.description,
        merchant: ocrScan.merchant || null,
        date: ocrScan.date,
      });
      toast.success('Transaction created from bill scan');
      setOcrScan(null);
      load();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to create transaction from scan'); }
  };

  const columns = [
    { key: 'date', header: 'Date', render: (t: Transaction) => <span className="text-surface-500 dark:text-surface-400 text-xs">{formatDate(t.date, 'MMM dd')}</span> },
    { key: 'description', header: 'Description', render: (t: Transaction) => (
      <div><p className="font-medium text-surface-900 dark:text-surface-100">{t.description || 'No description'}</p>{t.merchant && <p className="text-xs text-surface-500 dark:text-surface-400">{t.merchant}</p>}</div>
    )},
    { key: 'category', header: 'Category', render: (t: Transaction) => t.category_name ? <span className="badge-neutral">{t.category_name}</span> : <span className="text-surface-400 dark:text-surface-500 text-xs">Uncategorized</span> },
    { key: 'account', header: 'Account', render: (t: Transaction) => <span className="text-sm text-surface-600 dark:text-surface-400">{t.account_name}</span> },
    { key: 'amount', header: 'Amount', render: (t: Transaction) => (
      <span className={cn('text-sm font-semibold', t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
      </span>
    )},
    { key: 'actions', header: '', render: (t: Transaction) => (
      <div className="flex items-center gap-1">
        <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"><Edit3 className="w-4 h-4 text-surface-400 dark:text-surface-500" /></button>
        <button onClick={() => handleDelete(t.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
      </div>
    )},
  ];

  return (
    <section className="page-container">
      <PageHeader title="Transactions" subtitle="Manage your income and expenses"
        action={<div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary"><Download className="w-4 h-4" /> Import</button>
          <label className="btn-secondary cursor-pointer">
            <Upload className="w-4 h-4" /> Upload Bill
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleBillScan} className="hidden" disabled={scanning} />
          </label>
          <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Add Transaction</button>
        </div>} />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 dark:text-surface-500" />
          <input type="text" placeholder="Search transactions..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="input-field pl-10" />
        </div>
        <div className="flex gap-3">
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="select-field flex-1 sm:w-32">
            <option value="">All</option><option value="income">Income</option><option value="expense">Expense</option>
          </select>
          <select value={filters.account_id} onChange={(e) => setFilters({ ...filters, account_id: e.target.value })} className="select-field flex-1 sm:w-40">
            <option value="">All Accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : <DataTable columns={columns} data={data?.items || []} keyExtractor={(t) => t.id}
        page={data?.page} totalPages={data?.total_pages} onPageChange={setPage} />}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Transaction' : 'New Transaction'}>
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
              {(categories || []).filter((c) => c.type === txnType).map((c) => (
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
            <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={!!ocrScan} onClose={() => setOcrScan(null)} title="Verify Bill Scan">
        {ocrScan && (
          <div className="space-y-4">
            <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-xl text-sm text-surface-700 dark:text-surface-300 flex items-start gap-2">
              <Receipt className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
              <span>OCR extracted these details from your bill. Adjust if needed before creating the transaction.</span>
            </div>
            <div>
              <label className="input-label">Amount</label>
              <input type="number" step="0.01" min="0" value={ocrScan.amount}
                onChange={(e) => setOcrScan({ ...ocrScan, amount: parseFloat(e.target.value) || 0 })} className="input-field" />
            </div>
            <div>
              <label className="input-label">Description</label>
              <input type="text" value={ocrScan.description}
                onChange={(e) => setOcrScan({ ...ocrScan, description: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="input-label">Merchant</label>
              <input type="text" value={ocrScan.merchant}
                onChange={(e) => setOcrScan({ ...ocrScan, merchant: e.target.value })} className="input-field" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Date</label>
                <input type="date" value={ocrScan.date}
                  onChange={(e) => setOcrScan({ ...ocrScan, date: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="input-label">Account</label>
                <select value={ocrScan.account_id} onChange={(e) => setOcrScan({ ...ocrScan, account_id: e.target.value })}
                  className="select-field" required>
                  <option value="">Select account</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="input-label">Category</label>
              <select value={ocrScan.category_id} onChange={(e) => setOcrScan({ ...ocrScan, category_id: e.target.value })}
                className="select-field">
                <option value="">No category</option>
                {categories.filter((c) => c.type === 'expense').map((c) => (
                  <option key={c.id} value={c.id}>{c.icon || ''} {c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setOcrScan(null)} className="btn-secondary">Cancel</button>
              <button onClick={confirmOcrTransaction} className="btn-primary"><Receipt className="w-4 h-4" /> Create Transaction</button>
            </div>
          </div>
        )}
      </Modal>
      {showImport && <ImportModal onClose={() => { setShowImport(false); load(); }} />}
    </section>
  );
}
