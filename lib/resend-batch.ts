import { Resend } from 'resend';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface BatchEmail {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  /** Resend's batch endpoint can't carry attachments, so emails that have any are sent one request each (see sendIndividually). */
  attachments?: EmailAttachment[];
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
    if (emails.some((e) => e.attachments?.length)) return await sendIndividually(resend, emails, idempotencyKey);
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

const SEVERITY: Record<Exclude<BatchResult['kind'], 'ok'>, number> = { fatal: 4, quota: 3, rate: 2, transient: 1 };

/**
 * Attachment path: one request per email, in parallel (the caller keeps chunks small to respect the
 * rate limit). Every email gets its own idempotency key derived from the chunk's key, so if any one
 * request fails and the whole chunk is retried, the ones Resend already accepted are not sent again.
 */
async function sendIndividually(resend: Resend, emails: BatchEmail[], key: string): Promise<BatchResult> {
  type One = { id: string } | { rejected: string } | { problem: Exclude<BatchResult, { kind: 'ok' }> };
  const results: One[] = await Promise.all(
    emails.map(async (e, i): Promise<One> => {
      try {
        const res = await resend.emails.send(
          {
            from: e.from,
            to: e.to,
            subject: e.subject,
            html: e.html,
            text: e.text,
            attachments: e.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
          },
          { idempotencyKey: `${key}-${i}` }
        );
        if (!res.error) return { id: res.data?.id ?? '' };
        const problem = classifyResendError(res.error);
        // A bad recipient address is that recipient's problem, not a broken setup.
        if (problem.kind === 'fatal' && res.error.name === 'validation_error' && !/domain|verified|attachment/i.test(problem.message)) {
          return { rejected: problem.message.slice(0, 300) };
        }
        return { problem };
      } catch (err) {
        return { problem: { kind: 'transient', message: (err instanceof Error ? err.message : 'Network error').slice(0, 300) } };
      }
    })
  );

  const problems = results.flatMap((r) => ('problem' in r ? [r.problem] : []));
  if (problems.length > 0) return problems.reduce((a, b) => (SEVERITY[b.kind] > SEVERITY[a.kind] ? b : a));

  const rejected: { index: number; message: string }[] = [];
  const ids = results.map((r, index) => {
    if ('rejected' in r) {
      rejected.push({ index, message: r.rejected });
      return null;
    }
    return 'id' in r ? r.id || null : null;
  });
  return { kind: 'ok', ids, rejected };
}
