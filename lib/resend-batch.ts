import { Resend } from 'resend';

export interface BatchEmail {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export type BatchResult =
  | { kind: 'ok'; ids: (string | null)[]; rejected: { index: number; message: string }[] }
  /** Slow down / try again shortly. */
  | { kind: 'rate'; message: string }
  /** Plan quota reached — will not clear until the quota window resets. */
  | { kind: 'quota'; message: string }
  /** Resend/network hiccup — safe to retry the same batch. */
  | { kind: 'transient'; message: string }
  /** Configuration problem (key, sender, domain) — retrying cannot help until it is fixed. */
  | { kind: 'fatal'; message: string };

export type BatchSender = (emails: BatchEmail[], idempotencyKey: string) => Promise<BatchResult>;

interface ResendLikeError {
  name?: string;
  message?: string;
  statusCode?: number | null;
}

export function classifyResendError(err: ResendLikeError): Exclude<BatchResult, { kind: 'ok' }> {
  const message = (err.message ?? 'Unknown email provider error').slice(0, 300);
  const name = err.name ?? '';
  const status = err.statusCode ?? null;

  if (name === 'daily_quota_exceeded' || name === 'monthly_quota_exceeded') return { kind: 'quota', message };
  if (name === 'rate_limit_exceeded' || status === 429) return { kind: 'rate', message };
  if (['missing_api_key', 'invalid_api_key', 'restricted_api_key', 'invalid_from_address', 'invalid_access', 'security_error'].includes(name)) {
    return { kind: 'fatal', message };
  }
  if (/not verified|domain/i.test(message) && (status === 403 || status === 422 || name === 'validation_error')) return { kind: 'fatal', message };
  // Same key still in flight, or provider-side problems: retrying the identical request is safe.
  if (name === 'concurrent_idempotent_requests' || name === 'application_error' || name === 'internal_server_error' || status === null || status >= 500) {
    return { kind: 'transient', message };
  }
  return { kind: 'fatal', message };
}

export function isConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Server-only. The API key is read from the environment here and nowhere else; it is never
 * returned to a client or logged. `permissive` validation makes Resend report bad addresses
 * per email instead of rejecting the whole batch of 100.
 */
export const resendBatchSender: BatchSender = async (emails, idempotencyKey) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { kind: 'fatal', message: 'The email provider is not configured (RESEND_API_KEY is missing).' };

  try {
    const resend = new Resend(apiKey);
    const res = await resend.batch.send(emails, { idempotencyKey, batchValidation: 'permissive' });
    if (res.error) return classifyResendError(res.error);

    const rejected = ((res.data as { errors?: { index: number; message: string }[] }).errors ?? []).map((e) => ({
      index: e.index,
      message: String(e.message).slice(0, 300),
    }));
    const rejectedIdx = new Set(rejected.map((r) => r.index));
    const successIds = ((res.data as { data?: { id: string }[] }).data ?? []).map((d) => d.id);
    let next = 0;
    const ids = emails.map((_, i) => (rejectedIdx.has(i) ? null : (successIds[next++] ?? null)));
    return { kind: 'ok', ids, rejected };
  } catch (err) {
    return { kind: 'transient', message: (err instanceof Error ? err.message : 'Network error').slice(0, 300) };
  }
};
