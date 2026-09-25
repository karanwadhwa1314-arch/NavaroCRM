'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { hasPermission, type Permission } from '@/lib/permissions';
import type { SessionUser } from '@/lib/auth/session';

interface SessionContextValue {
  user: SessionUser;
  can: (...perms: Permission[]) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  const value: SessionContextValue = {
    user,
    can: (...perms) => hasPermission(user, ...perms),
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
