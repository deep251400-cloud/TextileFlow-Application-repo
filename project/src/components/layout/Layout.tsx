import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import type { Page } from '../../types';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  unreadCount: number;
}

export default function Layout({ children, currentPage, onNavigate, unreadCount }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOverlay, setMobileOverlay] = useState(false);

  // Close overlay on page change
  useEffect(() => {
    setMobileOverlay(false);
  }, [currentPage]);

  // Close overlay on resize to desktop
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 1024) setMobileOverlay(false);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function handleToggle() {
    const isDesktop = window.innerWidth >= 1024;
    if (isDesktop) {
      setSidebarCollapsed(prev => !prev);
    } else {
      // On mobile, toggle the overlay open/closed
      setMobileOverlay(prev => !prev);
    }
  }

  function handleNavigate(page: Page) {
    onNavigate(page);
    setMobileOverlay(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Mobile backdrop overlay */}
      {mobileOverlay && !sidebarCollapsed && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOverlay(false)}
        />
      )}

      {/* Single sidebar - always rendered */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggle={handleToggle}
        mobileVisible={mobileOverlay}
      />

      {/* Main content - shifts on desktop, full width on mobile */}
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60'
        }`}
      >
        <Header
          currentPage={currentPage}
          unreadCount={unreadCount}
          onNavigate={onNavigate}
          onMenuToggle={() => setMobileOverlay(true)}
        />
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
