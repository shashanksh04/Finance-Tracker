export interface ParsedTransaction {
  amount: number;
  description: string;
  type: 'income' | 'expense';
  merchant?: string;
}

const BANK_PATTERNS = [
  { pattern: /(?:debited|spent|paid|withdrew)\s*(?:Rs\.?|₹|INR)?\s*([\d,]+\.?\d*)/i, type: 'expense' as const },
  { pattern: /(?:credited|received|deposited|added)\s*(?:Rs\.?|₹|INR)?\s*([\d,]+\.?\d*)/i, type: 'income' as const },
  { pattern: /(?:spent|payment)\s*of\s*(?:Rs\.?|₹|INR)?\s*([\d,]+\.?\d*)/i, type: 'expense' as const },
  { pattern: /(?:at|to|from)\s+([A-Z][A-Z\s.-]+?)(?:\s+(?:on|via|ref|at|\.|$))/i, type: 'merchant' as const },
];

export function parseSmsTransaction(message: string): ParsedTransaction | null {
  for (const { pattern, type } of BANK_PATTERNS) {
    const match = message.match(pattern);
    if (!match) continue;

    if (type === 'expense') {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (isNaN(amount)) continue;
      const merchantMatch = message.match(BANK_PATTERNS[3].pattern);
      return {
        amount,
        description: merchantMatch ? merchantMatch[1].trim() : 'SMS Transaction',
        type: 'expense',
        merchant: merchantMatch?.[1]?.trim(),
      };
    }

    if (type === 'income') {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (isNaN(amount)) continue;
      return {
        amount,
        description: 'SMS Credit',
        type: 'income',
      };
    }
  }

  return null;
}

export function batchParseSms(messages: string[]): ParsedTransaction[] {
  return messages.map(parseSmsTransaction).filter((t): t is ParsedTransaction => t !== null);
}
