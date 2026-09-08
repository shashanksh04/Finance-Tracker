import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one digit')
    .regex(/[!@#$%^&*(),.?":{}|<>~`_\-=+\[\];'\\|]/, 'Password must contain at least one special character'),
});
export type RegisterForm = z.infer<typeof registerSchema>;

export const accountSchema = z.object({
  name: z.string().trim().min(1, 'Account name is required').max(100, 'Name too long'),
  type: z.enum(['checking', 'savings', 'credit', 'investment', 'cash', 'loan', 'other']),
  balance: z.coerce.number().min(0, 'Balance cannot be negative').max(1e12, 'Balance too large'),
  currency: z.string().trim().min(1, 'Currency is required').max(8),
  icon: z.string().trim().max(32).optional(),
  color: z.string().trim().max(16).optional(),
});
export type AccountForm = z.infer<typeof accountSchema>;

export const transactionSchema = z.object({
  account_id: z.string().min(1, 'Account is required'),
  category_id: z.string().optional(),
  amount: z.coerce.number().positive('Amount must be positive').max(1e12),
  type: z.enum(['income', 'expense']),
  description: z.string().trim().max(500).optional().refine((v) => !v || v.trim().length > 0, { message: 'Description cannot be blank' }),
  merchant: z.string().trim().max(120).optional(),
  date: z.string().min(1, 'Date is required').refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }),
});
export type TransactionForm = z.infer<typeof transactionSchema>;

export const budgetSchema = z.object({
  category_id: z.string().optional(),
  amount: z.coerce.number().positive('Budget amount must be positive').max(1e12),
  period: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  start_date: z.string().min(1, 'Start date is required').refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }),
  end_date: z.string().optional().refine((v) => !v || !isNaN(Date.parse(v)), { message: 'Invalid date' }),
  rollover: z.boolean(),
});
export type BudgetForm = z.infer<typeof budgetSchema>;

export const goalSchema = z.object({
  name: z.string().trim().min(1, 'Goal name is required').max(200),
  target_amount: z.coerce.number().positive('Target amount must be positive').max(1e12),
  current_amount: z.coerce.number().min(0, 'Current amount cannot be negative').max(1e12).optional(),
  deadline: z.string().optional().refine((v) => !v || !isNaN(Date.parse(v)), { message: 'Invalid date' }),
  icon: z.string().trim().max(32).optional(),
  color: z.string().trim().max(16).optional(),
  monthly_contribution: z.coerce.number().min(0).max(1e12).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type GoalForm = z.infer<typeof goalSchema>;

export const billSchema = z.object({
  name: z.string().trim().min(1, 'Bill name is required').max(200),
  amount: z.coerce.number().positive('Amount must be positive').max(1e12),
  due_date: z.string().min(1, 'Due date is required').refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }),
  category_id: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type BillForm = z.infer<typeof billSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(80),
  type: z.enum(['expense', 'income']),
  icon: z.string().trim().max(16).optional(),
  color: z.string().trim().max(16).optional(),
  parent_id: z.string().optional(),
});
export type CategoryForm = z.infer<typeof categorySchema>;

export const recurringSchema = z.object({
  account_id: z.string().min(1, 'Account is required'),
  category_id: z.string().optional(),
  amount: z.coerce.number().positive('Amount must be positive'),
  type: z.enum(['income', 'expense']),
  description: z.string().min(1, 'Description is required'),
  merchant: z.string().optional(),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
  interval_value: z.coerce.number().int().positive('Interval must be at least 1'),
  next_date: z.string().min(1, 'Next date is required'),
  end_date: z.string().optional(),
});
export type RecurringForm = z.infer<typeof recurringSchema>;

export const profileSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(120),
});
export type ProfileForm = z.infer<typeof profileSchema>;

export const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one digit')
    .regex(/[!@#$%^&*(),.?":{}|<>~`_\-=+\[\];'\\|]/, 'Password must contain at least one special character'),
  confirm_password: z.string().min(1, 'Please confirm your password'),
}).refine((d) => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});
export type PasswordForm = z.infer<typeof passwordSchema>;
