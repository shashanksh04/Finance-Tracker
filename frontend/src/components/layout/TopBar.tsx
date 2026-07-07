import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, LogOut, User, Settings } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { alertsApi } from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { cn, getInitials } from '../../utils/format';

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = () => {
    alertsApi.getAll(true, 1).then(({ data }) => setUnreadCount(data.length || data.total || 0)).catch(() => {});
  };

  useEffect(() => { fetchUnread(); }, []);

  useWebSocket({
    alerts_updated: fetchUnread,
    alert_read: fetchUnread,
    alert_dismissed: () => setUnreadCount((prev) => Math.max(0, prev - 1)),
  });

  return (
    <header className="h-16 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl">
          <Menu className="w-5 h-5 text-surface-600 dark:text-surface-400" />
        </button>
        <div className="relative hidden sm:block">
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && search.trim()) {
                navigate(`/transactions?search=${encodeURIComponent(search.trim())}`);
              }
            }}
            className="input-field w-48 md:w-64 lg:w-80 pl-10"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 dark:text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/alerts')} className="relative p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl">
          <Bell className="w-5 h-5 text-surface-600 dark:text-surface-400" />
          {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors"
          >
            <div className="w-8 h-8 bg-primary-100 text-primary-700 dark:text-primary-300 rounded-lg flex items-center justify-center text-sm font-semibold">
              {user ? getInitials(user.full_name) : '?'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{user?.full_name}</p>
              <p className="text-xs text-surface-500 dark:text-surface-400">{user?.email}</p>
            </div>
          </button>

          {showDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-surface-900 rounded-xl shadow-lg border border-surface-200 dark:border-surface-700 py-1 z-20 animate-scale-in">
                <button onClick={() => { navigate('/settings'); setShowDropdown(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800">
                  <User className="w-4 h-4" /> Profile
                </button>
                <button onClick={() => { navigate('/settings'); setShowDropdown(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800">
                  <Settings className="w-4 h-4" /> Settings
                </button>
                <hr className="my-1 border-surface-200 dark:border-surface-700" />
                <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
