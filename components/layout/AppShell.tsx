'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar, MobileSidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { UrlNavigationProvider } from '@/components/layout/UrlNavigation';
import { PageHeaderProvider } from '@/components/layout/PageHeaderContext';

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <PageHeaderProvider>
      <div className="min-h-screen">
        <Sidebar />
        <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="lg:pl-[264px]">
          <Header onMenuClick={() => setMobileOpen(true)} />
          <main className="px-4 py-6 lg:px-6">
            <UrlNavigationProvider>{children}</UrlNavigationProvider>
          </main>
        </div>
      </div>
    </PageHeaderProvider>
  );
}
