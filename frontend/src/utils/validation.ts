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
  name: z.string().min(1, 'Account name is required'),
  type: z.enum(['checking', 'savings', 'credit', 'investment', 'cash']),
  balance: z.coerce.number().min(0, 'Balance cannot be negative'),
  currency: z.string().min(1, 'Currency is required'),
  icon: z.string().optional(),
  color: z.string().optional(),
});
export type AccountForm = z.infer<typeof accountSchema>;

export const transactionSchema = z.object({
  account_id: z.string().min(1, 'Account is required'),
  category_id: z.string().optional(),
  amount: z.coerce.number().positive('Amount must be positive'),
  type: z.enum(['income', 'expense']),
  description: z.string().optional(),
  merchant: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
});
export type TransactionForm = z.infer<typeof transactionSchema>;

export const budgetSchema = z.object({
  category_id: z.string().optional(),
  amount: z.coerce.number().positive('Budget amount must be positive'),
  period: z.enum(['monthly', 'quarterly', 'yearly']),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  rollover: z.boolean(),
});
export type BudgetForm = z.infer<typeof budgetSchema>;

export const goalSchema = z.object({
  name: z.string().min(1, 'Goal name is required'),
  target_amount: z.coerce.number().positive('Target amount must be positive'),
  current_amount: z.coerce.number().min(0, 'Current amount cannot be negative').optional(),
  deadline: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  monthly_contribution: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});
export type GoalForm = z.infer<typeof goalSchema>;

export const billSchema = z.object({
  name: z.string().min(1, 'Bill name is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  due_date: z.string().min(1, 'Due date is required'),
  category_id: z.string().optional(),
  notes: z.string().optional(),
});
export type BillForm = z.infer<typeof billSchema>;

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  type: z.enum(['expense', 'income']),
  icon: z.string().optional(),
  color: z.string().optional(),
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
  full_name: z.string().min(1, 'Name is required'),
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
