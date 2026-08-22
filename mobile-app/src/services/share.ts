import { Share } from 'react-native';
import { formatCurrency } from '../utils/format';

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
  return `${description}: ${sign}${formatCurrency(Math.abs(amount))} on ${new Date(date).toLocaleDateString('en-IN')}`;
}

export function formatSummaryShare(totalBalance: number, income: number, expenses: number): string {
  return [
    '📊 Finance Tracker Summary',
    `Total Balance: ${formatCurrency(totalBalance)}`,
    `Income: ${formatCurrency(income)}`,
    `Expenses: ${formatCurrency(expenses)}`,
    `Net: ${formatCurrency(income - expenses)}`,
  ].join('\n');
}
