import 'server-only';
import { headers } from 'next/headers';
import AuditLog from '@/models/AuditLog';
import type { AuditAction, AuditEntity } from '@/lib/constants';

export function clientIp(): string | undefined {
  const forwarded = headers().get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim();
}

export function userAgent(): string | undefined {
  return headers().get('user-agent') ?? undefined;
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
