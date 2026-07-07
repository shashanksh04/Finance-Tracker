import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { useThemeStore } from './store/themeStore';

const raw = localStorage.getItem('theme-storage');
if (raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.state?.darkMode) {
      document.documentElement.classList.add('dark');
    }
  } catch {}
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <Toaster position="top-right" toastOptions={{
        duration: 4000,
        style: { borderRadius: '12px' },
        success: { style: { background: '#065f46', color: '#d1fae5' } },
        error: { style: { background: '#991b1b', color: '#fee2e2' } },
      }} />
    </BrowserRouter>
  </React.StrictMode>,
);
