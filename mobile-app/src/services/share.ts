import { Share } from 'react-native';

export async function shareText(message: string, title?: string): Promise<boolean> {
  try {
    const result = await Share.share({ message, title: title || 'Finance Tracker' });
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}

export function formatTransactionShare(description: string, amount: number, date: string): string {
  const sign = amount >= 0 ? '+' : '';
  return `${description}: ${sign}₹${Math.abs(amount).toLocaleString('en-IN')} on ${new Date(date).toLocaleDateString('en-IN')}`;
}

export function formatSummaryShare(totalBalance: number, income: number, expenses: number): string {
  return [
    '📊 Finance Tracker Summary',
    `Total Balance: ₹${totalBalance.toLocaleString('en-IN')}`,
    `Income: ₹${income.toLocaleString('en-IN')}`,
    `Expenses: ₹${expenses.toLocaleString('en-IN')}`,
    `Net: ₹${(income - expenses).toLocaleString('en-IN')}`,
  ].join('\n');
}
