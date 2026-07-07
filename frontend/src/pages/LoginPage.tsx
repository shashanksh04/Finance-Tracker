import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../store/authStore';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { loginSchema, LoginForm } from '../utils/validation';
import toast from 'react-hot-toast';

export function LoginPage() {
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try { await login(data.email, data.password); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Login failed'); }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-xl">FT</span>
            </div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Welcome back</h1>
            <p className="text-surface-500 dark:text-surface-400 mt-1">Sign in to your finance tracker</p>
            {window.location.hostname === 'neha.shashankakumar.com' && <p className="text-xs text-surface-400 dark:text-surface-500 mt-2">Made with love specially for Neha Balachandran</p>}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="input-label">Email</label>
              <input type="email" {...register('email')}
                className="input-field" placeholder="you@example.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="input-label">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} {...register('password')}
                  className="input-field pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
              {isSubmitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <><LogIn className="w-4 h-4" /> Sign In</>}
            </button>
          </form>

          <p className="text-center text-sm text-surface-500 dark:text-surface-400 mt-6">
            Don't have an account? <Link to="/register" className="text-primary-600 dark:text-primary-400 font-medium hover:text-primary-700 dark:hover:text-primary-300">Sign up</Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-600 via-primary-700 to-surface-900 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="w-16 h-16 bg-white/10 dark:bg-surface-700/10 backdrop-blur rounded-2xl flex items-center justify-center mb-6">
            <span className="text-3xl font-bold">FT</span>
          </div>
          <h2 className="text-3xl font-bold mb-4">Take Control of Your Finances</h2>
          <p className="text-primary-100 text-lg leading-relaxed">
            Track spending, set budgets, achieve goals, and get AI-powered insights to make smarter financial decisions.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {['Smart Budgeting', 'AI Insights', 'Goal Tracking', 'Bill Management'].map((f) => (
              <div key={f} className="bg-white/5 dark:bg-surface-700/5 backdrop-blur rounded-xl px-4 py-3 text-sm font-medium">{f}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
