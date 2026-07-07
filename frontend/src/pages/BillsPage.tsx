import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, FileText, Upload, Trash2, Edit3, CheckCircle, AlertTriangle, Receipt, ArrowRight } from 'lucide-react';
import { billsApi, accountsApi, categoriesApi, transactionsApi } from '../services/api';
import { Bill, Account, Category } from '../types';
import { billSchema, BillForm } from '../utils/validation';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, formatDate, cn } from '../utils/format';
import toast from 'react-hot-toast';

export function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const { register, handleSubmit: formSubmit, reset, formState: { errors } } = useForm<BillForm>({
    resolver: zodResolver(billSchema),
    defaultValues: { name: '', amount: 0, due_date: new Date().toISOString().split('T')[0], category_id: '', notes: '' },
  });
  const [verifyBill, setVerifyBill] = useState<Bill | null>(null);
  const [verifyForm, setVerifyForm] = useState({ amount: 0, description: '', merchant: '', date: '', account_id: '', category_id: '' });
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, aRes, cRes] = await Promise.all([billsApi.getAll(), accountsApi.getAll(), categoriesApi.getAll()]);
      setBills(bRes.data); setAccounts(aRes.data); setCategories(cRes.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); reset({ name: '', amount: 0, due_date: new Date().toISOString().split('T')[0], category_id: '', notes: '' }); setShowModal(true); };
  const openEdit = (b: Bill) => { setEditing(b); reset({ name: b.name, amount: b.amount, due_date: b.due_date, category_id: b.category_id || '', notes: b.notes || '' }); setShowModal(true); };

  const onSubmit = async (data: BillForm) => {
    try {
      const payload = { ...data, category_id: data.category_id || null, notes: data.notes || null };
      if (editing) { await billsApi.update(editing.id, payload); toast.success('Bill updated'); }
      else { await billsApi.create(payload); toast.success('Bill created'); }
      setShowModal(false); load();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to save bill'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bill?')) return;
    try { await billsApi.delete(id); toast.success('Bill deleted'); load(); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to delete bill'); }
  };

  const markPaid = async (bill: Bill) => {
    try { await billsApi.update(bill.id, { is_paid: true, paid_date: new Date().toISOString().split('T')[0] }); toast.success('Bill marked as paid'); load(); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to mark bill as paid'); }
  };

  const handleUpload = async (billId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data } = await billsApi.upload(billId, file);
      e.target.value = '';
      if (data.confidence && data.confidence > 0) {
        setVerifyBill(data);
        setVerifyForm({
          amount: data.extracted_amount || 0,
          description: data.extracted_merchant || data.name || '',
          merchant: data.extracted_merchant || '',
          date: data.extracted_due_date || new Date().toISOString().split('T')[0],
          account_id: accounts[0]?.id || '',
          category_id: data.category_id || '',
        });
      } else {
        toast.success('File uploaded (no text detected)');
        load();
      }
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to upload file'); }
  };

  const createTransactionFromBill = async () => {
    if (!verifyBill) return;
    if (!verifyForm.account_id) { toast.error('Please select an account'); return; }
    setVerifying(true);
    try {
      await transactionsApi.create({
        account_id: verifyForm.account_id,
        category_id: verifyForm.category_id || null,
        amount: verifyForm.amount,
        type: 'expense',
        description: verifyForm.description || verifyBill.name,
        merchant: verifyForm.merchant || null,
        date: verifyForm.date,
      });
      await billsApi.update(verifyBill.id, { is_paid: true, paid_date: verifyForm.date });
      toast.success('Transaction created from bill');
      setVerifyBill(null);
      load();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to create transaction'); } finally { setVerifying(false); }
  };

  const today = new Date();

  if (loading) return <section className="page-container"><LoadingSpinner size="lg" /></section>;

  return (
    <section className="page-container">
      <PageHeader title="Bills" subtitle="Manage and track your bills"
        action={<button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Add Bill</button>} />

      {bills.length === 0 ? (
        <EmptyState title="No bills yet" description="Add bills to keep track of your payments" action={{ label: 'Add Bill', onClick: openCreate }} />
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => {
            const dueDate = new Date(bill.due_date);
            const isOverdue = !bill.is_paid && dueDate < today;
            const isDueSoon = !bill.is_paid && !isOverdue && (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 7;
            return (
              <div key={bill.id} className={cn('card-hover p-4 flex items-center justify-between animate-fade-in', bill.is_paid && 'opacity-60')}>
                <div className="flex items-center gap-4 flex-1">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', bill.is_paid ? 'bg-emerald-50 dark:bg-emerald-900/30' : isOverdue ? 'bg-red-50 dark:bg-red-900/30' : isDueSoon ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-primary-50 dark:bg-primary-900/30')}>
                    <FileText className={cn('w-5 h-5', bill.is_paid ? 'text-emerald-500 dark:text-emerald-400' : isOverdue ? 'text-red-500 dark:text-red-400' : isDueSoon ? 'text-amber-500 dark:text-amber-400' : 'text-primary-500 dark:text-primary-400')} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-surface-900 dark:text-surface-100">{bill.name}</h3>
                      {bill.is_paid && <span className="badge-success">Paid</span>}
                      {isOverdue && <span className="badge-danger">Overdue</span>}
                      {isDueSoon && <span className="badge-warning">Due soon</span>}
                    </div>
                    <p className="text-sm text-surface-500 dark:text-surface-400">Due {formatDate(bill.due_date)}</p>
                    {bill.ocr_text && <p className="text-xs text-primary-500 dark:text-primary-400 mt-0.5">OCR scanned{bill.confidence && bill.confidence > 0 ? ` (${Math.round(bill.confidence * 100)}% confidence)` : ''}</p>}
                  </div>
                  <p className="text-lg font-bold text-surface-900 dark:text-surface-100">{formatCurrency(bill.amount)}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {!bill.is_paid && (
                    <button onClick={() => markPaid(bill)} className="btn-ghost p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30" title="Mark as paid">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  {bill.file_path && !bill.is_paid && (
                    <button onClick={() => {
                      setVerifyBill(bill);
                      setVerifyForm({
                        amount: bill.extracted_amount || bill.amount,
                        description: bill.extracted_merchant || bill.name,
                        merchant: bill.extracted_merchant || '',
                        date: bill.extracted_due_date || bill.due_date,
                        account_id: accounts[0]?.id || '',
                        category_id: bill.category_id || '',
                      });
                    }} className="btn-ghost p-2 text-primary-600 dark:text-primary-400" title="Create transaction from bill">
                      <Receipt className="w-4 h-4" />
                    </button>
                  )}
                  <label className="btn-ghost p-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => handleUpload(bill.id, e)} className="hidden" />
                  </label>
                  <button onClick={() => openEdit(bill)} className="btn-ghost p-2"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(bill.id)} className="btn-ghost p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Bill' : 'New Bill'}>
        <form onSubmit={formSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="input-label">Bill Name</label>
            <input type="text" {...register('name')}
              className="input-field" placeholder="Electric Bill" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Amount</label>
              <input type="number" step="0.01" {...register('amount')}
                className="input-field" />
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="input-label">Due Date</label>
              <input type="date" {...register('due_date')}
                className="input-field" />
              {errors.due_date && <p className="text-xs text-red-500 mt-1">{errors.due_date.message}</p>}
            </div>
          </div>
          <div>
            <label className="input-label">Notes</label>
            <textarea {...register('notes')}
              className="input-field" rows={2} placeholder="Additional notes..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!verifyBill} onClose={() => setVerifyBill(null)} title="Verify & Create Transaction">
        {verifyBill && (
          <div className="space-y-4">
            <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-xl text-sm text-surface-700 dark:text-surface-300 flex items-start gap-2">
              <Receipt className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
              <span>OCR extracted the details below from the uploaded bill. Review and adjust before creating the transaction.</span>
            </div>
            <div>
              <label className="input-label">Amount</label>
              <input type="number" step="0.01" min="0" value={verifyForm.amount}
                onChange={(e) => setVerifyForm({ ...verifyForm, amount: parseFloat(e.target.value) || 0 })} className="input-field" />
            </div>
            <div>
              <label className="input-label">Description</label>
              <input type="text" value={verifyForm.description}
                onChange={(e) => setVerifyForm({ ...verifyForm, description: e.target.value })} className="input-field" placeholder="Bill description" />
            </div>
            <div>
              <label className="input-label">Merchant</label>
              <input type="text" value={verifyForm.merchant}
                onChange={(e) => setVerifyForm({ ...verifyForm, merchant: e.target.value })} className="input-field" placeholder="Store or company name" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Date</label>
                <input type="date" value={verifyForm.date}
                  onChange={(e) => setVerifyForm({ ...verifyForm, date: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="input-label">Account</label>
                <select value={verifyForm.account_id} onChange={(e) => setVerifyForm({ ...verifyForm, account_id: e.target.value })}
                  className="select-field" required>
                  <option value="">Select account</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="input-label">Category</label>
              <select value={verifyForm.category_id} onChange={(e) => setVerifyForm({ ...verifyForm, category_id: e.target.value })}
                className="select-field">
                <option value="">No category</option>
                {categories.filter((c) => c.type === 'expense').map((c) => (
                  <option key={c.id} value={c.id}>{c.icon || ''} {c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setVerifyBill(null)} className="btn-secondary">Cancel</button>
              <button onClick={createTransactionFromBill} disabled={verifying || !verifyForm.account_id}
                className="btn-primary">
                {verifying ? 'Creating...' : <><ArrowRight className="w-4 h-4" /> Create Transaction</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
