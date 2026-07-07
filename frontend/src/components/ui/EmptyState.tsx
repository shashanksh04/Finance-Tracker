import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-surface-100 dark:bg-surface-800 rounded-2xl flex items-center justify-center mb-4">
        <Inbox className="w-8 h-8 text-surface-400 dark:text-surface-500" />
      </div>
      <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-1">{title}</h3>
      {description && <p className="text-sm text-surface-500 dark:text-surface-400 max-w-sm">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-4">
          {action.label}
        </button>
      )}
    </div>
  );
}
