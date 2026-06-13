import React from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  TrendingUp,
  Bell,
  BarChart2,
  Wallet,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Layers,
  Landmark,
  Settings,
} from 'lucide-react';
import type { Page } from '../../types';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  onToggle: () => void;
  mobileVisible: boolean;
}

const navItems: { page: Page; label: string; icon: React.ElementType }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'invoices', label: 'Invoices', icon: FileText },
  { page: 'customers', label: 'Customers', icon: Users },
  { page: 'orders', label: 'Orders', icon: Package },
  { page: 'debtors', label: 'Debtors', icon: Wallet },
  { page: 'creditors', label: 'Creditors', icon: Landmark },
  { page: 'cashflow', label: 'Cash Flow', icon: TrendingUp },
  { page: 'reminders', label: 'Reminders', icon: MessageSquare },
  { page: 'reports', label: 'Reports', icon: BarChart2 },
  { page: 'notifications', label: 'Notifications', icon: Bell },
  { page: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ currentPage, onNavigate, collapsed, onToggle, mobileVisible }: SidebarProps) {
  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-slate-900 dark:bg-slate-950 text-white flex flex-col overflow-hidden z-50
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-60'}
        ${!mobileVisible && !collapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
      `}
    >
      {/* Logo area */}
      <div
        className={`flex items-center border-b border-slate-700 dark:border-slate-800 h-16 flex-shrink-0 ${
          collapsed ? 'justify-center px-2' : 'gap-3 px-4'
        }`}
      >
        <div className="flex-shrink-0 w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
          <Layers size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden whitespace-nowrap">
            <p className="text-sm font-bold text-white leading-tight">TextileFlow</p>
            <p className="text-xs text-slate-400 leading-tight">Billing & Capital</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {navItems.map(({ page, label, icon: Icon }) => {
          const active = currentPage === page;
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={`w-full flex items-center text-sm font-medium transition-all duration-150 border-l-4 ${
                collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3'
              } ${
                active
                  ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white border-l-teal-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white border-l-transparent hover:pl-5'
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon size={20} className="flex-shrink-0" />
              {!collapsed && (
                <span className="truncate">{label}</span>
              )}
              {active && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-300 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse/Expand toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex items-center justify-center h-12 flex-shrink-0 border-t border-slate-700 dark:border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 dark:hover:bg-slate-900 transition-colors duration-150 cursor-pointer"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>
    </aside>
  );
}
