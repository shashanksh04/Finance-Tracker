import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, X, AlertTriangle, Info, AlertCircle, RefreshCw, Settings } from 'lucide-react';
import { alertsApi } from '../services/api';
import { Alert, AlertPreference } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatRelativeTime, cn, getSeverityColor } from '../utils/format';
import toast from 'react-hot-toast';

const severityIcons = { info: Info, warning: AlertTriangle, critical: AlertCircle };

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [preferences, setPreferences] = useState<AlertPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrefs, setShowPrefs] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: aData } = await alertsApi.getAll();
      const { data: pData } = await alertsApi.getPreferences();
      setAlerts(aData); setPreferences(pData);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useWebSocket({
    alerts_updated: () => load(),
    alert_read: () => load(),
    alert_dismissed: () => load(),
  });

  const markRead = async (id: string) => {
    try { await alertsApi.markRead(id); setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_read: true } : a)); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to mark as read'); }
  };

  const dismiss = async (id: string) => {
    try { await alertsApi.dismiss(id); setAlerts((prev) => prev.filter((a) => a.id !== id)); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to dismiss'); }
  };

  const generateAlerts = async () => {
    try { const { data } = await alertsApi.generate(); toast.success(data.message); load(); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to generate alerts'); }
  };

  const togglePreference = async (pref: AlertPreference) => {
    try {
      await alertsApi.updatePreference(pref.alert_type, { enabled: !pref.enabled, threshold: pref.threshold });
      load();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to update preference'); }
  };

  if (loading) return <section className="page-container"><LoadingSpinner size="lg" /></section>;

  const alertTypeLabels: Record<string, string> = {
    spending_limit: 'Spending Limit',
    budget_exceeded: 'Budget Exceeded',
    goal_milestone: 'Goal Milestone',
    unusual_spending: 'Unusual Spending',
    bill_due: 'Bill Due Reminder',
    account_low: 'Low Account Balance',
    recurring_failed: 'Recurring Failed',
    monthly_summary: 'Monthly Summary',
  };

  return (
    <section className="page-container">
      <PageHeader title="Alerts" subtitle="Stay informed about your finances"
        action={
          <div className="flex gap-2">
            <button onClick={generateAlerts} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Generate</button>
            <button onClick={() => setShowPrefs(true)} className="btn-secondary"><Settings className="w-4 h-4" /> Preferences</button>
          </div>
        } />

      {alerts.length === 0 ? (
        <EmptyState title="No alerts" description="You're all caught up! No alerts to show." />
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const Icon = severityIcons[alert.severity] || Info;
            return (
              <div key={alert.id} className={cn('card-hover p-4 flex items-start gap-4', !alert.is_read && 'ring-2 ring-primary-500/10')}>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  alert.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/30' : alert.severity === 'warning' ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-primary-50 dark:bg-primary-900/30')}>
                  <Icon className={cn('w-5 h-5', alert.severity === 'critical' ? 'text-red-500 dark:text-red-400' : alert.severity === 'warning' ? 'text-amber-500 dark:text-amber-400' : 'text-primary-500 dark:text-primary-400')} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-100">{alert.title}</h4>
                    {!alert.is_read && <span className="w-2 h-2 bg-primary-500 rounded-full" />}
                  </div>
                  <p className="text-sm text-surface-600 dark:text-surface-400">{alert.message}</p>
                  <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">{formatRelativeTime(alert.created_at)}</p>
                </div>
                <div className="flex items-center gap-1">
                  {!alert.is_read && (
                    <button onClick={() => markRead(alert.id)} className="p-2 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg" title="Mark as read">
                      <CheckCheck className="w-4 h-4 text-primary-500" />
                    </button>
                  )}
                  <button onClick={() => dismiss(alert.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg" title="Dismiss">
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showPrefs} onClose={() => setShowPrefs(false)} title="Alert Preferences" size="lg">
        <div className="space-y-4">
          {preferences.map((pref) => (
            <div key={pref.id} className="flex items-center justify-between py-3 border-b border-surface-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{alertTypeLabels[pref.alert_type] || pref.alert_type}</p>
                {pref.alert_type === 'spending_limit' && (
                  <p className="text-xs text-surface-500 dark:text-surface-400">Threshold: {pref.threshold ? `$${pref.threshold}` : 'Not set'}</p>
                )}
              </div>
              <button
                onClick={() => togglePreference(pref)}
                className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', pref.enabled ? 'bg-primary-600' : 'bg-surface-300 dark:bg-surface-600')}
              >
                <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white dark:bg-surface-100 transition-transform', pref.enabled ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>
          ))}
        </div>
      </Modal>
    </section>
  );
}
