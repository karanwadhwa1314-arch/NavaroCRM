import { headers } from 'next/headers';
import AuditLog from '@/models/AuditLog';
import type { AuditAction, AuditEntity } from '@/lib/constants';

// headers() only works inside an active Next.js request; scripts and tests call
// services directly with no request scope, so this stays best-effort like AuditLog.log.
export function clientIp(): string | undefined {
  try {
    const forwarded = headers().get('x-forwarded-for');
    return forwarded?.split(',')[0]?.trim();
  } catch {
    return undefined;
  }
}

export function userAgent(): string | undefined {
  try {
    return headers().get('user-agent') ?? undefined;
  } catch {
    return undefined;
  }
}

export async function recordAudit(entry: {
  user?: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  description?: string;
  changes?: { before?: unknown; after?: unknown };
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await AuditLog.log({
    ...entry,
    ipAddress: clientIp(),
    userAgent: userAgent(),
  });
}
