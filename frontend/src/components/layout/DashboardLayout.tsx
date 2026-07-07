import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { OnboardingOverlay } from '../onboarding/OnboardingOverlay';

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const { user, isAuthenticated } = useAuthStore();
  const showOnboarding = isAuthenticated && user && !user.onboarding_completed && !onboardingDismissed;

  return (
    <div className="flex h-screen bg-surface-50 dark:bg-surface-950">
      {showOnboarding && <OnboardingOverlay onClose={() => setOnboardingDismissed(true)} />}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
