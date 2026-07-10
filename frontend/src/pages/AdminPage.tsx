import { useEffect, useState } from 'react';
import { adminApi } from '../services/api';
import { AdminStats } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Users, LogIn, Calendar } from 'lucide-react';

export function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getStats()
      .then(({ data }) => setStats(data))
      .catch(() => setError('Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  const maxCount = stats?.daily_logins?.length
    ? Math.max(...stats.daily_logins.map((d) => d.count), 1)
    : 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Dashboard" subtitle="Platform overview" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-surface-500">Total Users</p>
            <p className="text-2xl font-bold">{stats?.total_users ?? 0}</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
            <LogIn className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-surface-500">Today Logins</p>
            <p className="text-2xl font-bold">{stats?.today_logins ?? 0}</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
            <Calendar className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-surface-500">7-Day Avg</p>
            <p className="text-2xl font-bold">
              {stats?.daily_logins?.length
                ? Math.round(stats.daily_logins.reduce((s, d) => s + d.count, 0) / stats.daily_logins.length)
                : 0}
            </p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-sm mb-4">Daily Logins (Last 7 Days)</h3>
        <div className="flex items-end gap-3 h-32">
          {stats?.daily_logins?.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-surface-500">{day.count}</span>
              <div
                className="w-full bg-primary-500 rounded-t-md transition-all"
                style={{ height: `${(day.count / maxCount) * 100}%`, minHeight: day.count > 0 ? '4px' : '2px' }}
              />
              <span className="text-[10px] text-surface-400 truncate w-full text-center">
                {new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
