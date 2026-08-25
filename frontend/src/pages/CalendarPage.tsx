import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { analysisApi, transactionsApi } from '../services/api';
import { CalendarData, CalendarBill, Transaction } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, formatDate, cn } from '../utils/format';
import toast from 'react-hot-toast';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [cal, setCal] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const [{ data: calData }, { data: txnData }] = await Promise.all([
        analysisApi.getCalendar(year, month),
        transactionsApi.getAll({ start_date: start, end_date: next, page_size: 500 }),
      ]);
      setCal(calData);
      setTransactions(txnData.items || []);
    } catch {
      toast.error('Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  };

  if (loading) return <section className="page-container"><LoadingSpinner size="lg" /></section>;
  if (!cal) return <section className="page-container"><p className="text-surface-500 dark:text-surface-400">No data available</p></section>;

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const billsByDay: Record<number, CalendarBill[]> = {};
  cal.bills.forEach((b) => {
    const d = parseInt(b.due_date.slice(8, 10), 10);
    (billsByDay[d] = billsByDay[d] || []).push(b);
  });

  const selectedDateStr = selected ? `${year}-${String(month).padStart(2, '0')}-${String(selected).padStart(2, '0')}` : '';
  const dayTxns = selected ? transactions.filter((t) => (t.date || '').slice(0, 10) === selectedDateStr) : [];
  const dayBills = selected ? (billsByDay[selected] || []) : [];

  return (
    <section className="page-container">
      <PageHeader title="Calendar" subtitle="Your transactions and bills by day"
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="btn-secondary px-3 py-1.5"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300 min-w-[120px] text-center">
              {new Date(year, month - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => changeMonth(1)} className="btn-secondary px-3 py-1.5"><ChevronRight className="w-4 h-4" /></button>
          </div>
        }
      />

      <div className="card p-4">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-xs font-semibold text-surface-400 dark:text-surface-500 py-1">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const dayInfo = cal.days[d - 1];
            const dayBills = billsByDay[d] || [];
            const isToday = d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
            return (
              <button key={i} onClick={() => setSelected(d)}
                className={cn(
                  'min-h-[78px] rounded-xl border p-2 text-left transition-colors',
                  isToday ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700 bg-white dark:bg-surface-900',
                )}>
                <div className={cn('text-xs font-medium', isToday ? 'text-primary-700 dark:text-primary-300' : 'text-surface-500 dark:text-surface-400')}>{d}</div>
                {dayInfo && (dayInfo.income > 0 || dayInfo.expense > 0) && (
                  <div className="mt-1 space-y-0.5">
                    {dayInfo.income > 0 && <p className="text-[10px] text-emerald-600 dark:text-emerald-400">+{formatCurrency(dayInfo.income)}</p>}
                    {dayInfo.expense > 0 && <p className="text-[10px] text-red-600 dark:text-red-400">-{formatCurrency(dayInfo.expense)}</p>}
                  </div>
                )}
                {dayBills.length > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                    <FileText className="w-3 h-3" /> {dayBills.length}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Modal isOpen={selected !== null} onClose={() => setSelected(null)} title={selected ? `Day — ${formatDate(selectedDateStr)}` : ''}>
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-2">Transactions</h4>
            {dayTxns.length === 0 ? (
              <p className="text-sm text-surface-500 dark:text-surface-400">No transactions this day.</p>
            ) : (
              <div className="space-y-2">
                {dayTxns.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-700 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{t.description || 'Transaction'}</p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">{t.category_name || t.account_name}</p>
                    </div>
                    <span className={cn('text-sm font-semibold', t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {dayBills.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-2">Bills Due</h4>
              <div className="space-y-2">
                {dayBills.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-700 last:border-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium text-surface-900 dark:text-surface-100">{b.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(b.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={() => setSelected(null)} className="btn-secondary">Close</button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
