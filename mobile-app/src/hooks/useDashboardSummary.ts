import { useState, useEffect, useCallback } from 'react';
import { repository } from '../database/repository';
import { TABLES } from '../database/schema';

function currentMonthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function dayKey(d: string | null | undefined): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function computeStreaks(dates: string[]): { streak: number; longest: number } {
  const daySet = new Set(dates.map(dayKey).filter((x): x is string => !!x));
  if (daySet.size === 0) return { streak: 0, longest: 0 };

  const days = Array.from(daySet).sort();
  let longest = 1;
  let cur = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]).getTime();
    const curr = new Date(days[i]).getTime();
    const diff = Math.round((curr - prev) / 86400000);
    cur = diff === 1 ? cur + 1 : 1;
    longest = Math.max(longest, cur);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let streak = 0;
  if (daySet.has(todayStr) || daySet.has(yesterdayStr)) {
    streak = 1;
    let cursor = daySet.has(todayStr) ? new Date(todayStr) : new Date(yesterdayStr);
    while (true) {
      const prevStr = new Date(cursor.getTime() - 86400000).toISOString().slice(0, 10);
      if (daySet.has(prevStr)) {
        streak++;
        cursor = new Date(prevStr);
      } else break;
    }
  }
  return { streak, longest };
}

export function useDashboardSummary() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const compute = useCallback(async () => {
    try {
      const monthStart = currentMonthStart();
      const [monthlyIncome, monthlyExpenses, totalIncome, totalExpenses, totalTxns, goalsActive, goalsCompleted, budgets] = await Promise.all([
        repository.getSummary(TABLES.TRANSACTIONS, 'amount', 'SUM', [{ field: 'type', value: 'income' }, { field: 'date', op: '>=', value: monthStart }]),
        repository.getSummary(TABLES.TRANSACTIONS, 'amount', 'SUM', [{ field: 'type', value: 'expense' }, { field: 'date', op: '>=', value: monthStart }]),
        repository.getSummary(TABLES.TRANSACTIONS, 'amount', 'SUM', [{ field: 'type', value: 'income' }]),
        repository.getSummary(TABLES.TRANSACTIONS, 'amount', 'SUM', [{ field: 'type', value: 'expense' }]),
        repository.getSummary(TABLES.TRANSACTIONS, 'id', 'COUNT', []),
        repository.getSummary(TABLES.GOALS, 'id', 'COUNT', [{ field: 'status', value: 'active' }]),
        repository.getSummary(TABLES.GOALS, 'id', 'COUNT', [{ field: 'status', value: 'completed' }]),
        repository.getSummary(TABLES.BUDGETS, 'id', 'COUNT', []),
      ]);
      const txns = await repository.list(TABLES.TRANSACTIONS, [], 'date DESC');
      const { streak, longest } = computeStreaks(txns.map((t: any) => t.date));

      setSummary({
        monthly_income: Number(monthlyIncome) || 0,
        monthly_expenses: Number(monthlyExpenses) || 0,
        total_income: Number(totalIncome) || 0,
        total_expenses: Number(totalExpenses) || 0,
        total_transactions: Number(totalTxns) || 0,
        streak_days: streak,
        longest_streak: longest,
        savings_goals_count: Number(goalsActive) || 0,
        goals_completed: Number(goalsCompleted) || 0,
        budgets_count: Number(budgets) || 0,
      });
    } catch (e) {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    compute();
  }, [compute]);

  return { summary, loading, refresh: compute };
}
