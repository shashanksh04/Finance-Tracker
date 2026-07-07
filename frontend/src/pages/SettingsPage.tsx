import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, Lock, Bell, Palette, LogOut, Save, DollarSign, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { authApi } from '../services/api';
import { PageHeader } from '../components/ui/PageHeader';
import { CURRENCIES } from '../utils/format';
import { profileSchema, passwordSchema, ProfileForm, PasswordForm } from '../utils/validation';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils/format';

export function SettingsPage() {
  const { user, logout, loadUser } = useAuthStore();
  const { darkMode, setDarkMode } = useThemeStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [currencyCode, setCurrencyCode] = useState(user?.settings?.currency || 'INR');

  const profileMethods = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: { full_name: user?.full_name || '' },
  });

  const passwordMethods = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const [saving, setSaving] = useState(false);

  const onUpdateProfile = async (data: ProfileForm) => {
    setSaving(true);
    try {
      await authApi.updateProfile(data);
      await loadUser();
      toast.success('Profile updated');
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to update profile'); } finally { setSaving(false); }
  };

  const updateCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.updateProfile({ settings: { currency: currencyCode } });
      await loadUser();
      toast.success(`Currency changed to ${CURRENCIES.find(c => c.code === currencyCode)?.symbol} ${currencyCode}`);
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to update currency'); } finally { setSaving(false); }
  };

  const onChangePassword = async (data: PasswordForm) => {
    setSaving(true);
    try {
      await authApi.changePassword(data.current_password, data.new_password);
      toast.success('Password changed');
      passwordMethods.reset({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to change password'); } finally { setSaving(false); }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'currency', label: 'Currency', icon: DollarSign },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];

  return (
    <section className="page-container">
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-56 flex-shrink-0">
          <div className="card p-2 space-y-1">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={activeTab === tab.id ? 'sidebar-link-active w-full' : 'sidebar-link-inactive w-full'}>
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
            <hr className="my-2 border-surface-200 dark:border-surface-700" />
            <button onClick={() => { logout(); navigate('/login'); }}
              className="sidebar-link-inactive w-full text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>

        <div className="flex-1 max-w-lg">
          {activeTab === 'profile' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6">Profile Information</h3>
              <form onSubmit={profileMethods.handleSubmit(onUpdateProfile)} className="space-y-4">
                <div>
                  <label className="input-label">Email</label>
                  <input type="email" value={user?.email || ''} disabled className="input-field opacity-60" />
                </div>
                <div>
                  <label className="input-label">Full Name</label>
                  <input type="text" {...profileMethods.register('full_name')}
                    className="input-field" />
                  {profileMethods.formState.errors.full_name && <p className="text-xs text-red-500 mt-1">{profileMethods.formState.errors.full_name.message}</p>}
                </div>
                <button type="submit" disabled={saving} className="btn-primary">
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </form>
            </div>
          )}

          {activeTab === 'currency' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">Default Currency</h3>
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-6">Choose your preferred currency for displaying amounts across the app.</p>
              <form onSubmit={updateCurrency}>
                <div className="grid grid-cols-1 gap-3 mb-6">
                  {CURRENCIES.map((c) => (
                    <label key={c.code}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        currencyCode === c.code
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                          : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                      }`}>
                      <input type="radio" name="currency" value={c.code}
                        checked={currencyCode === c.code}
                        onChange={() => setCurrencyCode(c.code)}
                        className="sr-only" />
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                        currencyCode === c.code ? 'bg-primary-500 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                      }`}>
                        {c.symbol}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-surface-900 dark:text-surface-100">{c.code}</p>
                        <p className="text-sm text-surface-500 dark:text-surface-400">{c.name}</p>
                      </div>
                      {currencyCode === c.code && (
                        <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </label>
                  ))}
                </div>
                <button type="submit" disabled={saving} className="btn-primary">
                  <Save className="w-4 h-4" /> Save Currency
                </button>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6">Change Password</h3>
              <form onSubmit={passwordMethods.handleSubmit(onChangePassword)} className="space-y-4">
                <div>
                  <label className="input-label">Current Password</label>
                  <input type="password" {...passwordMethods.register('current_password')}
                    className="input-field" />
                  {passwordMethods.formState.errors.current_password && <p className="text-xs text-red-500 mt-1">{passwordMethods.formState.errors.current_password.message}</p>}
                </div>
                <div>
                  <label className="input-label">New Password</label>
                  <input type="password" {...passwordMethods.register('new_password')}
                    className="input-field" />
                  {passwordMethods.formState.errors.new_password && <p className="text-xs text-red-500 mt-1">{passwordMethods.formState.errors.new_password.message}</p>}
                </div>
                <div>
                  <label className="input-label">Confirm New Password</label>
                  <input type="password" {...passwordMethods.register('confirm_password')}
                    className="input-field" />
                  {passwordMethods.formState.errors.confirm_password && <p className="text-xs text-red-500 mt-1">{passwordMethods.formState.errors.confirm_password.message}</p>}
                </div>
                <button type="submit" disabled={saving} className="btn-primary">
                  <Lock className="w-4 h-4" /> Update Password
                </button>
              </form>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-6">Notification Preferences</h3>
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">Configure your alert preferences in the Alerts page.</p>
              <button onClick={() => navigate('/alerts')} className="btn-primary">
                <Bell className="w-4 h-4" /> Go to Alert Preferences
              </button>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">Appearance</h3>
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-6">Choose between light and dark mode.</p>
              <div className="flex gap-4">
                <button onClick={() => setDarkMode(false)}
                  className={cn('flex-1 flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all',
                    !darkMode ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                  )}>
                  <Sun className="w-8 h-8 text-amber-500" />
                  <span className={cn('text-sm font-semibold', !darkMode ? 'text-primary-700 dark:text-primary-300' : 'text-surface-700 dark:text-surface-300')}>Light</span>
                </button>
                <button onClick={() => setDarkMode(true)}
                  className={cn('flex-1 flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all',
                    darkMode ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                  )}>
                  <Moon className="w-8 h-8 text-indigo-500" />
                  <span className={cn('text-sm font-semibold', darkMode ? 'text-primary-700 dark:text-primary-300' : 'text-surface-700 dark:text-surface-300')}>Dark</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
