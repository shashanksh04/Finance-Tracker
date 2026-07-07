import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ArrowLeftRight, Wallet, Tags, PiggyBank,
  Target, FileText, Repeat, BarChart3, Bot, Bell, Settings, X
} from 'lucide-react';
import { cn } from '../../utils/format';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/accounts', icon: Wallet, label: 'Accounts' },
  { to: '/categories', icon: Tags, label: 'Categories' },
  { to: '/budgets', icon: PiggyBank, label: 'Budgets' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/bills', icon: FileText, label: 'Bills' },
  { to: '/recurring', icon: Repeat, label: 'Recurring' },
  { to: '/analysis', icon: BarChart3, label: 'Analysis' },
  { to: '/copilot', icon: Bot, label: 'AI Copilot' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      <aside className={cn(
        'w-64 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 flex flex-col fixed lg:sticky top-0 h-screen z-40 transition-transform duration-200',
        'lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-200 dark:border-surface-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">FT</span>
            </div>
            <div>
              <span className="text-sm font-bold text-surface-900 dark:text-surface-100">Finance</span>
              <p className="text-xs text-surface-500 dark:text-surface-400">Tracker</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg">
            <X className="w-5 h-5 text-surface-500 dark:text-surface-400" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-surface-200 dark:border-surface-700">
          <div className="card p-3 bg-gradient-to-br from-primary-500 to-primary-700 text-white border-0">
            <Bot className="w-5 h-5 mb-1" />
            <p className="text-xs font-medium">AI Financial Copilot</p>
            <p className="text-[10px] opacity-80 mt-0.5">Ask me anything about your finances</p>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-30 lg:hidden" onClick={onClose} />
      )}
    </>
  );
}
