import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  icon: ReactNode;
  color?: string;
}

export function StatCard({ label, value, change, icon, color = 'primary' }: StatCardProps) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    violet: 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    rose: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
    cyan: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
  };

  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        <div className={`p-2 rounded-xl ${colorMap[color] || colorMap.primary}`}>
          {icon}
        </div>
      </div>
      <span className="stat-value">{value}</span>
      {change !== undefined && (
        <div className="flex items-center gap-1">
          {change >= 0 ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
          )}
          <span className={change >= 0 ? 'stat-change stat-change-positive' : 'stat-change stat-change-negative'}>
            {Math.abs(change)}% vs last month
          </span>
        </div>
      )}
    </div>
  );
}
