import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Tags, Trash2, Edit3, Palette } from 'lucide-react';
import { categoriesApi } from '../services/api';
import { Category } from '../types';
import { categorySchema, CategoryForm } from '../utils/validation';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../utils/format';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

const presetColors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1'];

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { register, handleSubmit: formSubmit, reset, setValue, watch, formState: { errors } } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', type: 'expense', icon: '', color: presetColors[0], parent_id: '' },
  });
  const formColor = watch('color');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await categoriesApi.getAll(undefined, page, 20);
      if (data.items) { setCategories(data.items); setTotalPages(data.total_pages); }
      else { setCategories(data); setTotalPages(1); }
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to load categories'); } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const openCreate = (type?: 'expense' | 'income') => { setEditing(null); reset({ name: '', type: type || 'expense', icon: '', color: presetColors[0], parent_id: '' }); setShowModal(true); };
  const openEdit = (c: Category) => { setEditing(c); reset({ name: c.name, type: c.type, icon: c.icon || '', color: c.color || presetColors[0], parent_id: c.parent_id || '' }); setShowModal(true); };

  const onSubmit = async (data: CategoryForm) => {
    try {
      const payload = { ...data, parent_id: data.parent_id || null, icon: data.icon || null };
      if (editing) { await categoriesApi.update(editing.id, payload); toast.success('Category updated'); }
      else { await categoriesApi.create(payload); toast.success('Category created'); }
      setShowModal(false); load();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to save category'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try { await categoriesApi.delete(id); toast.success('Category deleted'); load(); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to delete category'); }
  };

  if (loading) return <section className="page-container"><LoadingSpinner size="lg" /></section>;

  const expenseCats = categories.filter((c) => c.type === 'expense');
  const incomeCats = categories.filter((c) => c.type === 'income');

  return (
    <section className="page-container">
      <PageHeader title="Categories" subtitle="Organize your transactions"
        action={<div className="flex gap-2"><button onClick={() => openCreate('expense')} className="btn-secondary"><Plus className="w-4 h-4" /> Expense</button><button onClick={() => openCreate('income')} className="btn-primary"><Plus className="w-4 h-4" /> Income</button></div>} />

      {categories.length === 0 ? (
        <div>
          <EmptyState title="No categories yet" description="Create categories or load defaults"
            action={{ label: 'Load Default Categories', onClick: async () => { try { await categoriesApi.seed(); toast.success('Default categories loaded!'); load(); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to load defaults'); } } }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500" /> Expense Categories</h3>
            <div className="space-y-2">
              {expenseCats.map((cat) => (
                <div key={cat.id} className="card-hover p-3 flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: `${cat.color || presetColors[0]}20`, color: cat.color || presetColors[0] }}>
                      {cat.icon || <Tags className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{cat.name}</p>
                      {cat.parent_id && <p className="text-xs text-surface-500 dark:text-surface-400">Subcategory</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(cat)} className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"><Edit3 className="w-3.5 h-3.5 text-surface-400 dark:text-surface-500" /></button>
                    <button onClick={() => handleDelete(cat.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                </div>
              ))}
              {expenseCats.length === 0 && <p className="text-sm text-surface-500 dark:text-surface-400 text-center py-4">No expense categories</p>}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Income Categories</h3>
            <div className="space-y-2">
              {incomeCats.map((cat) => (
                <div key={cat.id} className="card-hover p-3 flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: `${cat.color || presetColors[0]}20`, color: cat.color || presetColors[0] }}>
                      {cat.icon || <Tags className="w-4 h-4" />}
                    </div>
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{cat.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(cat)} className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"><Edit3 className="w-3.5 h-3.5 text-surface-400 dark:text-surface-500" /></button>
                    <button onClick={() => handleDelete(cat.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                </div>
              ))}
              {incomeCats.length === 0 && <p className="text-sm text-surface-500 dark:text-surface-400 text-center py-4">No income categories</p>}
            </div>
          </div>
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Previous</button>
          <span className="text-sm text-surface-500 dark:text-surface-400">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Category' : 'New Category'}>
        <form onSubmit={formSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="input-label">Name</label>
            <input type="text" {...register('name')}
              className="input-field" placeholder="Category name" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="input-label">Type</label>
            <select {...register('type')} className="select-field">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <label className="input-label">Color</label>
            <div className="flex gap-2 flex-wrap">
              {presetColors.map((c) => (
                <button key={c} type="button" onClick={() => setValue('color', c)}
                  className={cn('w-8 h-8 rounded-lg border-2 transition-all', formColor === c ? 'border-surface-900 scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }} />
              ))}
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
