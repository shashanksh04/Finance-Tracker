import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { queryAll } from '../database';

const CHANNEL_ID = 'finance-tracker';

export async function setupNotifications(): Promise<boolean> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Finance Tracker',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 100, 50, 100],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Promise.all([
    scheduleBillReminders(),
    scheduleBudgetAlerts(),
    scheduleGoalMilestones(),
    scheduleLowBalanceAlerts(),
  ]);
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

async function scheduleBillReminders(): Promise<void> {
  try {
    const bills = await queryAll(
      `SELECT * FROM bills WHERE is_paid = 0 AND deleted_at IS NULL`
    );
    const now = new Date();

    for (const bill of bills) {
      const dueDate = new Date(bill.due_date);
      const remindAt = new Date(dueDate);
      remindAt.setDate(remindAt.getDate() - bill.reminder_days_before);
      remindAt.setHours(9, 0, 0, 0);

      if (remindAt > now) {
        const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
        await Notifications.scheduleNotificationAsync({
          identifier: `bill-${bill.id}`,
          content: {
            title: 'Bill Due Soon',
            body: `${bill.name} — ₹${Number(bill.amount).toLocaleString('en-IN')} due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
            data: { type: 'bill', billId: bill.id },
          },
          trigger: { date: remindAt },
        });
      }
    }
  } catch {}
}

async function scheduleBudgetAlerts(): Promise<void> {
  try {
    const budgets = await queryAll(
      `SELECT * FROM budgets WHERE is_active = 1 AND deleted_at IS NULL`
    );

    for (const budget of budgets) {
      const pct = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;
      if (pct >= 90 && pct < 100) {
        await Notifications.scheduleNotificationAsync({
          identifier: `budget-${budget.id}`,
          content: {
            title: 'Budget Nearly Exhausted',
            body: `${Math.round(pct)}% of ₹${Number(budget.amount).toLocaleString('en-IN')} used`,
            data: { type: 'budget', budgetId: budget.id, percentage: pct },
          },
          trigger: { seconds: 3 },
        });
      } else if (pct >= 100) {
        await Notifications.scheduleNotificationAsync({
          identifier: `budget-${budget.id}-exceeded`,
          content: {
            title: 'Budget Exceeded',
            body: `Budget of ₹${Number(budget.amount).toLocaleString('en-IN')} has been exceeded`,
            data: { type: 'budget_exceeded', budgetId: budget.id },
          },
          trigger: { seconds: 3 },
        });
      }
    }
  } catch {}
}

async function scheduleGoalMilestones(): Promise<void> {
  try {
    const goals = await queryAll(
      `SELECT * FROM goals WHERE status = 'active' AND deleted_at IS NULL`
    );

    for (const goal of goals) {
      const pct = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
      if (pct >= 75 && pct < 100) {
        await Notifications.scheduleNotificationAsync({
          identifier: `goal-${goal.id}`,
          content: {
            title: 'Goal Progress',
            body: `${Math.round(pct)}% of "${goal.name}" — ₹${Number(goal.current_amount).toLocaleString('en-IN')} of ₹${Number(goal.target_amount).toLocaleString('en-IN')}`,
            data: { type: 'goal', goalId: goal.id, percentage: pct },
          },
          trigger: { seconds: 3 },
        });
      } else if (pct >= 100) {
        await Notifications.scheduleNotificationAsync({
          identifier: `goal-${goal.id}-complete`,
          content: {
            title: 'Goal Achieved!',
            body: `Congratulations! You reached your "${goal.name}" goal of ₹${Number(goal.target_amount).toLocaleString('en-IN')}`,
            data: { type: 'goal_complete', goalId: goal.id },
          },
          trigger: { seconds: 3 },
        });
      }
    }
  } catch {}
}

async function scheduleLowBalanceAlerts(): Promise<void> {
  try {
    const accounts = await queryAll(
      `SELECT * FROM accounts WHERE deleted_at IS NULL`
    );

    for (const account of accounts) {
      if (account.balance < 0) {
        await Notifications.scheduleNotificationAsync({
          identifier: `balance-${account.id}`,
          content: {
            title: 'Negative Balance',
            body: `${account.name} is at ₹${Number(account.balance).toLocaleString('en-IN')}`,
            data: { type: 'low_balance', accountId: account.id, balance: account.balance },
          },
          trigger: { seconds: 3 },
        });
      } else if (account.balance < 1000) {
        await Notifications.scheduleNotificationAsync({
          identifier: `balance-${account.id}-low`,
          content: {
            title: 'Low Balance',
            body: `${account.name} is running low: ₹${Number(account.balance).toLocaleString('en-IN')}`,
            data: { type: 'low_balance', accountId: account.id, balance: account.balance },
          },
          trigger: { seconds: 3 },
        });
      }
    }
  } catch {}
}
