export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'milestone' | 'streak' | 'savings' | 'tracking' | 'social';
  requirement: { type: string; value: number };
}

export const BADGES: BadgeDef[] = [
  { id: 'first_txn', name: 'First Transaction', description: 'Add your first transaction', icon: '🎯', category: 'milestone', requirement: { type: 'transactions', value: 1 } },
  { id: 'txn_10', name: 'Getting Started', description: 'Track 10 transactions', icon: '📊', category: 'tracking', requirement: { type: 'transactions', value: 10 } },
  { id: 'txn_100', name: 'Power Tracker', description: 'Track 100 transactions', icon: '💪', category: 'tracking', requirement: { type: 'transactions', value: 100 } },
  { id: 'txn_500', name: 'Finance Guru', description: 'Track 500 transactions', icon: '🧠', category: 'tracking', requirement: { type: 'transactions', value: 500 } },
  { id: 'streak_7', name: 'Week Warrior', description: '7-day streak', icon: '📅', category: 'streak', requirement: { type: 'streak', value: 7 } },
  { id: 'streak_30', name: 'Monthly Master', description: '30-day streak', icon: '⭐', category: 'streak', requirement: { type: 'streak', value: 30 } },
  { id: 'streak_100', name: 'Century Club', description: '100-day streak', icon: '💎', category: 'streak', requirement: { type: 'streak', value: 100 } },
  { id: 'streak_365', name: 'Year Streak', description: '365-day streak', icon: '🔥', category: 'streak', requirement: { type: 'streak', value: 365 } },
  { id: 'first_goal', name: 'Goal Setter', description: 'Create your first goal', icon: '🎯', category: 'milestone', requirement: { type: 'goals', value: 1 } },
  { id: 'goal_reached', name: 'Goal Crusher', description: 'Complete your first goal', icon: '🏆', category: 'milestone', requirement: { type: 'goals_completed', value: 1 } },
  { id: 'first_budget', name: 'Budgeter', description: 'Create your first budget', icon: '📊', category: 'milestone', requirement: { type: 'budgets', value: 1 } },
  { id: 'saved_10k', name: 'Saver', description: 'Save ₹10,000', icon: '💰', category: 'savings', requirement: { type: 'savings', value: 10000 } },
  { id: 'saved_1l', name: 'Big Saver', description: 'Save ₹1,00,000', icon: '🏦', category: 'savings', requirement: { type: 'savings', value: 100000 } },
  { id: 'saved_10l', name: 'Wealth Builder', description: 'Save ₹10,00,000', icon: '🤑', category: 'savings', requirement: { type: 'savings', value: 1000000 } },
  { id: 'no_debt', name: 'Debt Free', description: 'All accounts have positive balance', icon: '✅', category: 'milestone', requirement: { type: 'no_debt', value: 1 } },
  { id: 'all_categories', name: 'Organizer', description: 'Use all category types', icon: '📂', category: 'tracking', requirement: { type: 'categories_used', value: 5 } },
  { id: 'bill_payments', name: 'Bill Master', description: 'Pay 10 bills', icon: '📄', category: 'tracking', requirement: { type: 'bills_paid', value: 10 } },
  { id: 'first_alert', name: 'Alert Receiver', description: 'Receive your first alert', icon: '🔔', category: 'milestone', requirement: { type: 'alerts', value: 1 } },
];

export function checkBadgeUnlock(badge: BadgeDef, stats: Record<string, number>): boolean {
  const current = stats[badge.requirement.type] || 0;
  return current >= badge.requirement.value;
}

export function getUnlockedBadges(stats: Record<string, number>): BadgeDef[] {
  return BADGES.filter((b) => checkBadgeUnlock(b, stats));
}

export function getProgress(badge: BadgeDef, stats: Record<string, number>): number {
  const current = stats[badge.requirement.type] || 0;
  return Math.min(current / badge.requirement.value, 1);
}
