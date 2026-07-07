import { useState, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Check, LayoutDashboard, Wallet, ArrowLeftRight, Tags, PiggyBank, Target, Receipt, Bot } from 'lucide-react';
import { onboardingApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils/format';

interface Step {
  title: string;
  subtitle: string;
  icon: ElementType;
  color: string;
  content: string[];
}

const steps: Step[] = [
  {
    title: 'Welcome to Finance Tracker',
    subtitle: 'Take control of your finances',
    icon: LayoutDashboard,
    color: 'from-primary-500 to-primary-700',
    content: [
      'This quick tour will show you around and help you get started.',
      'Use the sidebar on the left to navigate between features.',
      'You can always come back to settings if you need help later.',
    ],
  },
  {
    title: 'Dashboard',
    subtitle: 'Your financial overview',
    icon: LayoutDashboard,
    color: 'from-blue-500 to-blue-700',
    content: [
      'See your total balance, monthly income, and expenses at a glance.',
      'View budget health, recent transactions, and upcoming bills.',
      'Charts show your spending by category and trends over time.',
    ],
  },
  {
    title: 'Accounts',
    subtitle: 'Track your money',
    icon: Wallet,
    color: 'from-emerald-500 to-emerald-700',
    content: [
      'Add all your accounts — checking, savings, credit cards, investments, and cash.',
      'Set an opening balance and track transactions for each account.',
      'Balances update automatically as you add transactions.',
    ],
  },
  {
    title: 'Transactions',
    subtitle: 'Record income & expenses',
    icon: ArrowLeftRight,
    color: 'from-violet-500 to-violet-700',
    content: [
      'Log every transaction with amount, date, category, and merchant.',
      'Filter by date range, category, type, or search by description.',
      'Upload a bill photo and OCR will extract the details for you.',
    ],
  },
  {
    title: 'Categories',
    subtitle: 'Organize your spending',
    icon: Tags,
    color: 'from-pink-500 to-pink-700',
    content: [
      'Default expense and income categories are created for you.',
      'Categorize transactions to see where your money goes.',
      'Add custom categories or edit existing ones anytime.',
    ],
  },
  {
    title: 'Budgets',
    subtitle: 'Set spending limits',
    icon: PiggyBank,
    color: 'from-amber-500 to-amber-700',
    content: [
      'Create monthly, quarterly, or yearly budgets per category.',
      'Track your spending against budget in real time.',
      'Get alerts when you\'re close to exceeding a budget.',
    ],
  },
  {
    title: 'Goals',
    subtitle: 'Save for what matters',
    icon: Target,
    color: 'from-rose-500 to-rose-700',
    content: [
      'Set financial goals like an emergency fund, vacation, or debt payoff.',
      'Track progress with percentage completion and days remaining.',
      'Get monthly contribution suggestions to stay on track.',
    ],
  },
  {
    title: 'Bills & Recurring',
    subtitle: 'Never miss a payment',
    icon: Receipt,
    color: 'from-cyan-500 to-cyan-700',
    content: [
      'Add bills with due dates and amounts.',
      'Upload bill PDFs — OCR extracts the details automatically.',
      'Set up recurring transactions for subscriptions, rent, and salary.',
    ],
  },
  {
    title: 'Copilot & Alerts',
    subtitle: 'AI + smart notifications',
    icon: Bot,
    color: 'from-indigo-500 to-indigo-700',
    content: [
      'Ask the AI Copilot anything about your finances — it reads your data.',
      'Get alerts for unusual spending, bill due dates, and budget limits.',
      'Customize which alerts you want and set thresholds in Settings.',
    ],
  },
  {
    title: 'You\'re All Set!',
    subtitle: 'Start managing your money',
    icon: Check,
    color: 'from-green-500 to-green-700',
    content: [
      'Add your first account and log a transaction to get started.',
      'Explore budgets, goals, and the copilot at your own pace.',
      'Visit the Settings page anytime to update your profile or currency.',
    ],
  },
];

export function OnboardingOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const { loadUser } = useAuthStore();
  const navigate = useNavigate();
  const isLast = step === steps.length - 1;
  const current = steps[step];

  const dismiss = () => {
    onClose();
    onboardingApi.complete().catch(() => {});
    loadUser().catch(() => {});
  };

  const handleNext = () => {
    if (isLast) {
      dismiss();
    } else {
      setStep((s) => Math.min(s + 1, steps.length - 1));
    }
  };

  const handleNavClick = (path: string) => {
    dismiss();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-surface-900 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className={cn('h-2 bg-gradient-to-r', current.color)} />

        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br', current.color)}>
              <current.icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">{current.title}</h2>
              <p className="text-sm text-surface-500 dark:text-surface-400">{current.subtitle}</p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {current.content.map((text, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5 bg-gradient-to-br',
                  current.color,
                )}>
                  {i + 1}
                </span>
                <p className="text-surface-600 dark:text-surface-300 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="mb-6 p-4 bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700">
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-2">Quick links:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Go to Accounts', path: '/accounts', icon: Wallet },
                  { label: 'View Dashboard', path: '/', icon: LayoutDashboard },
                ].map((link) => (
                  <button
                    key={link.path}
                    onClick={() => handleNavClick(link.path)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-surface-700 rounded-lg text-xs font-medium text-surface-600 dark:text-surface-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300 border border-surface-200 dark:border-surface-600"
                  >
                    <link.icon className="w-3.5 h-3.5" />
                    {link.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all duration-300',
                    i === step
                      ? 'w-6 bg-primary-500'
                      : 'bg-surface-300 dark:bg-surface-600 hover:bg-surface-400 dark:hover:bg-surface-500',
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={dismiss}
                className="px-4 py-2 text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
              >
                Skip
              </button>

              {step > 0 && (
                <button
                  onClick={() => setStep((s) => Math.max(s - 1, 0))}
                  className="btn-secondary px-4 py-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={handleNext}
                className={cn('btn-primary px-6 py-2 flex items-center gap-2', isLast && 'bg-green-600 hover:bg-green-700')}
              >
                {isLast ? (
                  <>
                    <Check className="w-4 h-4" /> Finish
                  </>
                ) : (
                  <>
                    Next <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
