export interface PersonalityDef {
  id: string;
  label: string;
  description: string;
  emoji: string;
  condition: (stats: Record<string, number>) => boolean;
}

export function calculatePersonality(stats: Record<string, number>): PersonalityDef {
  for (const p of PERSONALITIES) {
    if (p.condition(stats)) return p;
  }
  return PERSONALITIES[PERSONALITIES.length - 1];
}

export const PERSONALITIES: PersonalityDef[] = [
  {
    id: 'super_saver',
    label: 'Super Saver',
    description: 'You save more than 40% of your income. Your future self will thank you!',
    emoji: '🦉',
    condition: (s) => (s.income > 0) && (s.income - s.expenses) / s.income > 0.4,
  },
  {
    id: 'big_spender',
    label: 'Big Spender',
    description: 'You spend freely on what matters to you. Living your best life!',
    emoji: '🦄',
    condition: (s) => s.expenses > 0 && s.transactions > 50 && s.expenses / Math.max(s.income, 1) > 0.8,
  },
  {
    id: 'balanced',
    label: 'Balanced Budgeter',
    description: 'You maintain a healthy balance between income and expenses. Well done!',
    emoji: '🧘',
    condition: (s) => s.income > 0 && (s.income - s.expenses) / s.income > 0.15 && (s.income - s.expenses) / s.income < 0.4,
  },
  {
    id: 'tracker',
    label: 'Diligent Tracker',
    description: 'You track every transaction religiously. Nothing slips past you!',
    emoji: '📋',
    condition: (s) => (s.transactions || 0) > 100,
  },
  {
    id: 'goal_chaser',
    label: 'Goal Chaser',
    description: 'You love setting and crushing financial goals. Keep going!',
    emoji: '🏃',
    condition: (s) => (s.goals || 0) > 2,
  },
  {
    id: 'bill_whisperer',
    label: 'Bill Whisperer',
    description: 'You never miss a bill payment. Your credit score loves you!',
    emoji: '📑',
    condition: (s) => (s.bills_paid || 0) > 5,
  },
  {
    id: 'streak_king',
    label: 'Streak King',
    description: 'You track daily without fail. Consistency is your superpower!',
    emoji: '👑',
    condition: (s) => (s.streak || 0) > 30,
  },
  {
    id: 'beginner',
    label: 'Fresh Start',
    description: 'You have begun your financial journey. Every expert was once a beginner!',
    emoji: '🌱',
    condition: () => true,
  },
];
