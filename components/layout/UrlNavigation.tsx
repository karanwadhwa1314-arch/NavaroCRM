'use client';

import { createContext, useCallback, useContext, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface UrlNavigationValue {
  /** router.replace wrapped in a transition, so `isPending` is true until the server has responded. */
  navigate: (url: string) => void;
  isPending: boolean;
}

const UrlNavigationContext = createContext<UrlNavigationValue | null>(null);

export function UrlNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const navigate = useCallback((url: string) => startTransition(() => router.replace(url)), [router]);

  return (
    <UrlNavigationContext.Provider value={{ navigate, isPending }}>
      <div
        className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden transition-opacity duration-150 ${isPending ? 'opacity-100' : 'opacity-0'}`}
        role="progressbar"
        aria-hidden={!isPending}
      >
        <div className="h-full w-1/3 animate-[navaro-slide_1s_ease-in-out_infinite] bg-navaro-turquoise motion-reduce:animate-none motion-reduce:w-full" />
      </div>
      <div
        aria-busy={isPending}
        className={`transition-opacity duration-150 motion-reduce:transition-none ${isPending ? 'opacity-60' : 'opacity-100'}`}
      >
        {children}
      </div>
    </UrlNavigationContext.Provider>
  );
}

export function useUrlNavigation(): UrlNavigationValue {
  const ctx = useContext(UrlNavigationContext);
  if (!ctx) throw new Error('useUrlNavigation must be used within a UrlNavigationProvider');
  return ctx;
}
