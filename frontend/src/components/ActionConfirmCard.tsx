import { useState } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import type { ProposedAction } from '../types';

export function ActionConfirmCard({ action, onApprove, onReject, onDone }: {
  action: ProposedAction;
  onApprove: (action: ProposedAction) => Promise<void>;
  onReject: (action: ProposedAction) => void;
  onDone: (action: ProposedAction) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const approve = async () => {
    setBusy(true);
    setError('');
    try {
      await onApprove(action);
      onDone(action);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Action failed');
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-[10px] font-semibold uppercase tracking-wide">
          <AlertCircle className="w-3 h-3" />
          Awaiting your approval
        </span>
      </div>
      <p className="text-sm font-medium text-surface-800 dark:text-surface-100">{action.summary}</p>
      <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
        Nothing has been changed yet. Confirm to execute, or reject to discard.
      </p>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>
      )}
      <div className="flex gap-2 mt-3">
        <button
          onClick={approve}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold transition-colors disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {busy ? 'Executing...' : 'Approve'}
        </button>
        <button
          onClick={() => onReject(action)}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 text-xs font-semibold text-surface-700 dark:text-surface-200 transition-colors disabled:opacity-60"
        >
          Reject
        </button>
      </div>
    </div>
  );
}