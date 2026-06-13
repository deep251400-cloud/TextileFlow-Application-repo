import React, { useState, useCallback } from 'react';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Invoices from './pages/Invoices';
import Orders from './pages/Orders';
import Debtors from './pages/Debtors';
import Creditors from './pages/Creditors';
import CashFlow from './pages/CashFlow';
import Reminders from './pages/Reminders';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import ToastContainer, { Toast } from './components/ui/ToastContainer';
import { DarkModeProvider } from './lib/darkMode';
import { CompanySettingsProvider } from './lib/companySettings';
import type { Page } from './types';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...t, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  function renderPage() {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} onToast={addToast} />;
      case 'customers': return <Customers onToast={addToast} />;
      case 'invoices': return <Invoices onToast={addToast} />;
      case 'orders': return <Orders onToast={addToast} />;
      case 'debtors': return <Debtors />;
      case 'creditors': return <Creditors onToast={addToast} />;
      case 'cashflow': return <CashFlow onToast={addToast} />;
      case 'reminders': return <Reminders onToast={addToast} />;
      case 'reports': return <Reports />;
      case 'notifications': return <Notifications onUnreadChange={setUnreadCount} />;
      case 'settings': return <Settings />;
      default: return <Dashboard onNavigate={setCurrentPage} onToast={addToast} />;
    }
  }

  return (
    <DarkModeProvider>
      <CompanySettingsProvider>
        <Layout currentPage={currentPage} onNavigate={setCurrentPage} unreadCount={unreadCount}>
          {renderPage()}
        </Layout>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </CompanySettingsProvider>
    </DarkModeProvider>
  );
}
