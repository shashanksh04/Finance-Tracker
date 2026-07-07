import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { UserPlus } from 'lucide-react';
import { registerSchema, RegisterForm } from '../utils/validation';
import toast from 'react-hot-toast';

export function RegisterPage() {
  const { register: registerUser } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    try { await registerUser(data.email, data.password, data.full_name); } catch (err: any) { toast.error(err?.response?.data?.detail || 'Registration failed'); }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-600 via-primary-700 to-surface-900 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <h2 className="text-3xl font-bold mb-4">Start Your Journey</h2>
          <p className="text-primary-100 text-lg leading-relaxed">
            Create an account and start managing your finances with powerful tools and AI assistance.
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-xl">FT</span>
            </div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Create Account</h1>
            <p className="text-surface-500 dark:text-surface-400 mt-1">Start tracking your finances</p>
            {window.location.hostname === 'neha.shashankakumar.com' && <p className="text-xs text-surface-400 dark:text-surface-500 mt-2">Made with love specially for Neha Balachandran</p>}
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="input-label">Full Name</label>
              <input type="text" {...register('full_name')}
                className="input-field" placeholder="John Doe" />
              {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>}
            </div>
            <div>
              <label className="input-label">Email</label>
              <input type="email" {...register('email')}
                className="input-field" placeholder="you@example.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="input-label">Password</label>
              <input type="password" {...register('password')}
                className="input-field" placeholder="Min. 8 characters" />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
              {isSubmitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <><UserPlus className="w-4 h-4" /> Create Account</>}
            </button>
          </form>
          <p className="text-center text-sm text-surface-500 dark:text-surface-400 mt-6">
            Already have an account? <Link to="/login" className="text-primary-600 dark:text-primary-400 font-medium hover:text-primary-700 dark:hover:text-primary-300">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
