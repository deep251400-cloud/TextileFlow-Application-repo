import { Bell, Menu, Sun, Moon } from 'lucide-react';
import { useDarkMode } from '../../lib/darkMode';
import type { Page } from '../../types';

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
  customers: 'Customer Management',
  invoices: 'Invoice Management',
  orders: 'Order Tracking',
  debtors: 'Debtor Management',
  creditors: 'Creditor Management',
  cashflow: 'Cash Flow Forecast',
  reminders: 'Payment Reminders',
  reports: 'Reports & Analytics',
  notifications: 'Notifications',
  settings: 'Settings',
};

interface HeaderProps {
  currentPage: Page;
  unreadCount: number;
  onNavigate: (page: Page) => void;
  onMenuToggle: () => void;
}

export default function Header({ currentPage, unreadCount, onNavigate, onMenuToggle }: HeaderProps) {
  const { isDark, toggle } = useDarkMode();

  return (
    <header className="sticky top-0 z-20 backdrop-blur-md bg-white/80 dark:bg-slate-800/80 border-b border-slate-200/50 dark:border-slate-700/50 shadow-sm flex items-center justify-between px-4 sm:px-6 h-16">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <Menu size={20} />
        </button>
        <div className="relative">
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-50">{pageTitles[currentPage]}</h1>
          <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-teal-500 to-transparent w-16" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button onClick={() => onNavigate('notifications')} className="relative p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
