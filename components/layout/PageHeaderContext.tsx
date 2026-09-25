'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface PageHeaderContextValue {
  title: string;
  setTitle: (title: string) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('Navaro CRM');
  return <PageHeaderContext.Provider value={{ title, setTitle }}>{children}</PageHeaderContext.Provider>;
}

export function usePageHeader(): PageHeaderContextValue {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error('usePageHeader must be used within a PageHeaderProvider');
  return ctx;
}

/** Renders nothing — drop this into a server-component page to set the header title/breadcrumb. */
export function SetPageTitle({ title }: { title: string }) {
  const { setTitle } = usePageHeader();
  useEffect(() => {
    setTitle(title);
  }, [title, setTitle]);
  return null;
}
