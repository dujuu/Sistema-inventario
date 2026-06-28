'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
    setMounted(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  }

  // Avoid layout shift on SSR — render with default (expanded) until mounted
  const sidebarWidth = !mounted ? 240 : collapsed ? 64 : 240;

  return (
    <div className="flex h-screen bg-[#f8f9ff]">
      <Sidebar collapsed={!mounted ? false : collapsed} onToggle={toggle} />
      <div
        className="flex-1 overflow-auto transition-[margin] duration-200 ease-in-out"
        style={{ marginLeft: sidebarWidth }}
      >
        <main className="p-10 min-h-full max-w-[1280px]">{children}</main>
      </div>
    </div>
  );
}
