import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Target, Trash2, Edit3, Trophy, Clock, Calendar } from 'lucide-react';
import { goalsApi } from '../services/api';
import { Goal } from '../types';
import { goalSchema, GoalForm } from '../utils/validation';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, formatDate, cn } from '../utils/format';
import toast from 'react-hot-toast';

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { register, handleSubmit: formSubmit, reset, formState: { errors } } = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: { name: '', target_amount: 0, current_amount: 0, deadline: '', icon: '', color: '#0ea5e9', monthly_contribution: 0, notes: '' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await goalsApi.getAll(undefined, page, 12);
      if (data.items) { setGoals(data.items); setTotalPages(data.total_pages); }
      else { setGoals(data); setTotalPages(1); }
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to load goals'); } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); reset({ name: '', target_amount: 0, current_amount: 0, deadline: '', icon: '', color: '#0ea5e9', monthly_contribution: 0, notes: '' }); setShowModal(true); };
  const openEdit = (g: Goal) => { setEditing(g); reset({ name: g.name, target_amount: g.target_amount, current_amount: g.current_amount, deadline: g.deadline || '', icon: g.icon || '', color: g.color || '#0ea5e9', monthly_contribution: g.monthly_contribution || 0, notes: g.notes || '' }); setShowModal(true); };

  const onSubmit = async (data: GoalForm) => {
    try {
      const payload = { ...data, deadline: data.deadline || null, monthly_contribution: data.monthly_contribution || null };
      if (editing) { await goalsApi.update(editing.id, payload); toast.success('Goal updated'); }
      else { await goalsApi.create(payload); toast.success('Goal created'); }
      setShowModal(false); load();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to save goal'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this goal?')) return;
    try { await goalsApi.delete(id); toast.success('Goal deleted'); load(); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to delete goal'); }
  };

  const colors = ['#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

  if (loading) return <section className="page-container"><LoadingSpinner size="lg" /></section>;

  return (
    <section className="page-container">
      <PageHeader title="Goals" subtitle="Track your financial goals"
        action={<button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> New Goal</button>} />

      {goals.length === 0 ? (
        <EmptyState title="No goals yet" description="Set financial goals and track your progress" action={{ label: 'Create Goal', onClick: openCreate }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal, idx) => {
            const isComplete = goal.status === 'completed';
            return (
              <div key={goal.id} className={cn('card p-5 animate-fade-in', isComplete && 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/20')}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${goal.color || colors[idx % colors.length]}20`, color: goal.color || colors[idx % colors.length] }}>
                      {isComplete ? <Trophy className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-surface-900 dark:text-surface-100">{goal.name}</h3>
                      {goal.days_remaining !== null && goal.days_remaining !== undefined && (
                        <span className="text-xs text-surface-500 dark:text-surface-400">{goal.days_remaining} days remaining</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(goal)} className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"><Edit3 className="w-3.5 h-3.5 text-surface-400 dark:text-surface-500" /></button>
                    <button onClick={() => handleDelete(goal.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                </div>

                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{formatCurrency(goal.current_amount)}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">of {formatCurrency(goal.target_amount)}</p>
                  </div>
                  <span className={cn('text-sm font-semibold', isComplete ? 'text-emerald-600 dark:text-emerald-400' : goal.progress_percentage > 50 ? 'text-primary-600 dark:text-primary-400' : 'text-surface-500 dark:text-surface-400')}>
                    {goal.progress_percentage}%
                  </span>
                </div>

                <div className="progress-bar">
                  <div className={cn('progress-fill', isComplete ? 'bg-emerald-500' : 'bg-primary-500')}
                    style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }} />
                </div>

                <div className="flex items-center justify-between mt-3 text-xs text-surface-500 dark:text-surface-400">
                  {goal.suggested_monthly && <span>Suggested: {formatCurrency(goal.suggested_monthly)}/mo</span>}
                  {goal.deadline && <span><Calendar className="w-3 h-3 inline mr-1" />{formatDate(goal.deadline)}</span>}
                </div>

                {isComplete && (
                  <div className="flex items-center gap-1.5 mt-3 p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                    <Trophy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Goal achieved!</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Previous</button>
          <span className="text-sm text-surface-500 dark:text-surface-400">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Goal' : 'New Goal'}>
        <form onSubmit={formSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="input-label">Goal Name</label>
            <input type="text" {...register('name')}
              className="input-field" placeholder="Emergency Fund" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Target Amount</label>
              <input type="number" step="0.01" {...register('target_amount')}
                className="input-field" />
              {errors.target_amount && <p className="text-xs text-red-500 mt-1">{errors.target_amount.message}</p>}
            </div>
            <div>
              <label className="input-label">Current Amount</label>
              <input type="number" step="0.01" {...register('current_amount')}
                className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Deadline</label>
              <input type="date" {...register('deadline')} className="input-field" />
            </div>
            <div>
              <label className="input-label">Monthly Contribution</label>
              <input type="number" step="0.01" {...register('monthly_contribution')}
                className="input-field" />
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
