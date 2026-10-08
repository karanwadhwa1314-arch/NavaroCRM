import { describe, it, expect, beforeEach } from 'vitest';
import * as svc from '@/services/broadcasts';
import Broadcast from '@/models/Broadcast';
import BroadcastDelivery from '@/models/BroadcastDelivery';
import Lead from '@/models/Lead';
import { createBroadcastSchema, updateBroadcastSchema } from '@/lib/validation/broadcast';
import { classifyResendError, type BatchSender, type BatchEmail, type BatchResult } from '@/lib/resend-batch';
import { createTestUser, toActor } from './helpers';

const HOUR = 3600_000;

async function superActor() {
  return toActor(await createTestUser({ role: 'superadmin' }));
}

async function makeLeads(n: number, extra: Partial<{ isActive: boolean; email: string; firstName: string }> = {}) {
  const base = await Lead.countDocuments();
  await Lead.insertMany(
    Array.from({ length: n }, (_, i) => ({
      firstName: extra.firstName ?? `Lead${base + i}`,
      lastName: 'Test',
      email: extra.email ?? `lead${base + i}@example.com`,
      company: 'Co',
      isActive: extra.isActive ?? true,
    }))
  );
}

function recorder(respond?: (call: number, emails: BatchEmail[], key: string) => BatchResult) {
  const calls: { emails: BatchEmail[]; key: string }[] = [];
  const sender: BatchSender = async (emails, key) => {
    calls.push({ emails, key });
    return respond ? respond(calls.length, emails, key) : { kind: 'ok', ids: emails.map((_, i) => `id-${calls.length}-${i}`), rejected: [] };
  };
  const recipients = () => calls.flatMap((c) => c.emails.map((e) => e.to[0]));
  return { sender, calls, recipients };
}

const fast = { pauseMs: 0 };

async function schedule(actor: ReturnType<typeof toActor>, overrides: Record<string, unknown> = {}, whenMs = HOUR) {
  const input = createBroadcastSchema.parse({
    subject: 'Hello {{first_name}}',
    preview: 'Preview text',
    content: '<p>Hi {{first_name}}, welcome.</p>',
    scheduledAt: new Date(Date.now() + whenMs).toISOString(),
    ...overrides,
  });
  return svc.create(actor, input);
}

const later = (ms = 2 * HOUR) => () => new Date(Date.now() + ms);

describe('broadcast validation & sanitising', () => {
  it('requires subject, preview and non-empty content (whitespace-only rejected)', () => {
    expect(createBroadcastSchema.safeParse({ subject: '  ', preview: 'p', content: '<p>x</p>' }).success).toBe(false);
    expect(createBroadcastSchema.safeParse({ subject: 's', preview: ' ', content: '<p>x</p>' }).success).toBe(false);
    expect(createBroadcastSchema.safeParse({ subject: 's', preview: 'p', content: '<p> <br></p>' }).success).toBe(false);
    expect(createBroadcastSchema.safeParse({ subject: 's', preview: 'p', content: '<p>real</p>' }).success).toBe(true);
  });

  it('strips scripts, event handlers and javascript: links from stored HTML', () => {
    const r = createBroadcastSchema.parse({
      subject: 's',
      preview: 'p',
      content: '<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">bad</a><a href="https://navaro.co.in">ok</a><img src=x onerror=alert(1)>',
    });
    expect(r.content).not.toMatch(/script|onclick|onerror|javascript:|<img/i);
    expect(r.content).toContain('href="https://navaro.co.in"');
  });

  it('rejects a scheduled time in the past', async () => {
    const actor = await superActor();
    const input = createBroadcastSchema.parse({ subject: 's', preview: 'p', content: '<p>x</p>', scheduledAt: new Date(Date.now() - HOUR).toISOString() });
    await expect(svc.create(actor, input)).rejects.toMatchObject({ status: 400 });
  });

  it('a user without broadcasts.send can save drafts but cannot schedule', async () => {
    const author = toActor(await createTestUser({ role: 'member', permissions: ['broadcasts.create', 'broadcasts.edit'] }));
    const draft = await svc.create(author, createBroadcastSchema.parse({ subject: 's', preview: 'p', content: '<p>x</p>' }));
    expect(draft.status).toBe('draft');
    await expect(schedule(author)).rejects.toMatchObject({ status: 403 });
    await expect(svc.update(author, draft.id, updateBroadcastSchema.parse({ scheduledAt: new Date(Date.now() + HOUR).toISOString() }))).rejects.toMatchObject({ status: 403 });
  });
});

describe('audience', () => {
  it('uses active leads only, skips invalid emails, collapses case-insensitive duplicates', async () => {
    await makeLeads(3);
    await makeLeads(1, { isActive: false, email: 'archived@example.com' });
    await makeLeads(1, { email: 'Dup@Example.com' });
    await makeLeads(1, { email: 'dup@example.com' });
    await Lead.updateOne({ email: 'lead0@example.com' }, { $set: { email: 'not-an-email' } });
    const { recipients, skippedInvalid, duplicates } = await svc.resolveAudience();
    const emails = recipients.map((r) => r.email);
    expect(emails).not.toContain('archived@example.com');
    expect(emails).not.toContain('not-an-email');
    expect(emails.filter((e) => e === 'dup@example.com')).toHaveLength(1);
    expect(skippedInvalid).toBe(1);
    expect(duplicates).toBe(1);
  });
});

describe('scheduled sending', () => {
  it('sends only when due, to each recipient exactly once, in batches of 100, then marks sent', async () => {
    const actor = await superActor();
    await makeLeads(250);
    const b = await schedule(actor);
    const r = recorder();

    await svc.processDue({ sender: r.sender, ...fast }); // not due yet
    expect(r.calls).toHaveLength(0);
    expect((await Broadcast.findById(b.id))!.status).toBe('scheduled');

    await svc.processDue({ sender: r.sender, now: later(), ...fast });
    expect(r.calls.map((c) => c.emails.length)).toEqual([100, 100, 50]);
    expect(new Set(r.recipients()).size).toBe(250);
    const done = (await Broadcast.findById(b.id))!;
    expect(done.status).toBe('sent');
    expect(done.sentAt).toBeInstanceOf(Date);
    expect(done.sentCount).toBe(250);
    expect(done.fromEmail).toBe('karan@navaro.co.in');
    expect(r.calls[0].emails[0].from).toBe('Karan from Navaro <karan@navaro.co.in>');
  });

  it('a later tick or a second concurrent worker never re-sends', async () => {
    const actor = await superActor();
    await makeLeads(120);
    await schedule(actor);
    const r = recorder();
    await Promise.all([svc.processDue({ sender: r.sender, now: later(), ...fast }), svc.processDue({ sender: r.sender, now: later(), ...fast })]);
    await svc.processDue({ sender: r.sender, now: later(), ...fast });
    expect(r.recipients()).toHaveLength(120);
    expect(new Set(r.recipients()).size).toBe(120);
  });

  it('personalises {{first_name}} (escaped), falling back to "there"', async () => {
    const actor = await superActor();
    await makeLeads(1, { email: 'a@example.com', firstName: '<b>Ann</b>' });
    await Lead.create({ firstName: ' ', lastName: 'x', email: 'b@example.com', company: 'c' }).catch(() => null);
    await Lead.updateOne({ email: 'b@example.com' }, { $set: { firstName: '' } }).catch(() => null);
    await schedule(actor);
    const r = recorder();
    await svc.processDue({ sender: r.sender, now: later(), ...fast });
    const a = r.calls[0].emails.find((e) => e.to[0] === 'a@example.com')!;
    expect(a.html).toContain('Hi &lt;b&gt;Ann&lt;/b&gt;, welcome.');
    expect(a.subject).toBe('Hello <b>Ann</b>'); // subject is plain text, not HTML
    expect(a.text).toContain('Hi <b>Ann</b>, welcome.');
    expect(a.html).toContain('Preview text'); // preheader
  });

  it('a deleted scheduled broadcast is never sent; a sent one cannot be deleted', async () => {
    const actor = await superActor();
    await makeLeads(3);
    const b = await schedule(actor);
    await svc.remove(actor, b.id);
    const r = recorder();
    await svc.processDue({ sender: r.sender, now: later(), ...fast });
    expect(r.calls).toHaveLength(0);

    const b2 = await schedule(actor);
    await svc.processDue({ sender: r.sender, now: later(), ...fast });
    expect((await Broadcast.findById(b2.id))!.status).toBe('sent');
    await expect(svc.remove(actor, b2.id)).rejects.toMatchObject({ status: 409 });
  });

  it('sent and sending broadcasts are immutable; scheduled ones can still be edited', async () => {
    const actor = await superActor();
    await makeLeads(2);
    const b = await schedule(actor);
    const edited = await svc.update(actor, b.id, updateBroadcastSchema.parse({ subject: 'New subject' }));
    expect(edited.subject).toBe('New subject');

    await Broadcast.updateOne({ _id: b.id }, { $set: { status: 'sending' } });
    await expect(svc.update(actor, b.id, updateBroadcastSchema.parse({ subject: 'x' }))).rejects.toMatchObject({ status: 409 });
    await Broadcast.updateOne({ _id: b.id }, { $set: { status: 'sent' } });
    await expect(svc.update(actor, b.id, updateBroadcastSchema.parse({ subject: 'x' }))).rejects.toMatchObject({ status: 409 });
  });

  it('the audience is frozen when sending starts: leads added mid-send are not included', async () => {
    const actor = await superActor();
    await makeLeads(3);
    await schedule(actor);
    const r = recorder(() => ({ kind: 'ok', ids: ['a', 'b', 'c'], rejected: [] }));
    const sender: BatchSender = async (e, k) => {
      await makeLeads(2, { email: `late${Math.random()}@example.com` });
      return r.sender(e, k);
    };
    await svc.processDue({ sender, now: later(), ...fast });
    expect(r.recipients()).toHaveLength(3);
  });

  it('with no eligible leads the broadcast fails with a clear message (not silently "sent")', async () => {
    const actor = await superActor();
    const b = await schedule(actor);
    await svc.processDue({ sender: recorder().sender, now: later(), ...fast });
    const done = (await Broadcast.findById(b.id))!;
    expect(done.status).toBe('failed');
    expect(done.lastError).toMatch(/no leads/i);
  });
});

describe('broadcast now', () => {
  it('sends immediately, bypassing the schedule, and records the actual send time', async () => {
    const actor = await superActor();
    await makeLeads(5);
    const b = await schedule(actor, {}, 24 * HOUR);
    const r = recorder();
    const out = await svc.sendNow(actor, b.id, { sender: r.sender, ...fast });
    expect(out.status).toBe('sent');
    expect(out.sentAt).not.toBeNull();
    expect(new Date(out.sentAt!).getTime()).toBeLessThan(new Date(out.scheduledAt!).getTime());
    expect(r.recipients()).toHaveLength(5);
    // The scheduler must not send it again at the original time.
    await svc.processDue({ sender: r.sender, now: later(48 * HOUR), ...fast });
    expect(r.recipients()).toHaveLength(5);
  });

  it('cannot be triggered twice for the same broadcast', async () => {
    const actor = await superActor();
    await makeLeads(5);
    const b = await schedule(actor);
    const r = recorder();
    const results = await Promise.allSettled([svc.sendNow(actor, b.id, { sender: r.sender, ...fast }), svc.sendNow(actor, b.id, { sender: r.sender, ...fast })]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(r.recipients()).toHaveLength(5);
  });
});

describe('failures, retries and recovery', () => {
  it('a configuration error marks the broadcast failed (not "scheduled"), keeps recipients pending, and Retry resumes after the fix', async () => {
    const actor = await superActor();
    await makeLeads(4);
    const b = await schedule(actor);
    await svc.processDue({ sender: async () => ({ kind: 'fatal', message: 'The domain is not verified' }), now: later(), ...fast });
    const failed = (await Broadcast.findById(b.id))!;
    expect(failed.status).toBe('failed');
    expect(failed.lastError).toContain('not verified');
    expect(failed.sentAt).toBeNull();
    expect(await BroadcastDelivery.countDocuments({ broadcast: b.id, status: 'pending' })).toBe(4);

    const r = recorder();
    const out = await svc.retry(actor, b.id, { sender: r.sender, ...fast });
    expect(out.status).toBe('sent');
    expect(r.recipients()).toHaveLength(4);
  });

  it('a transient provider error pauses the send; the next tick resumes it without re-sending delivered recipients', async () => {
    const actor = await superActor();
    await makeLeads(150);
    const b = await schedule(actor);
    const r = recorder((call, emails) => (call === 2 ? { kind: 'transient', message: 'Resend is unavailable' } : { kind: 'ok', ids: emails.map(() => 'i'), rejected: [] }));
    await svc.processDue({ sender: r.sender, now: later(), ...fast });
    expect((await Broadcast.findById(b.id))!.status).toBe('sending');
    expect((await Broadcast.findById(b.id))!.sentCount).toBe(100);

    await svc.processDue({ sender: r.sender, now: later(), ...fast });
    expect((await Broadcast.findById(b.id))!.status).toBe('sent');
    // 100 delivered, 50 attempted-and-failed, then the same 50 retried: 200 attempts, 150 distinct recipients.
    expect(new Set(r.recipients()).size).toBe(150);
    expect((await Broadcast.findById(b.id))!.sentCount).toBe(150);
    expect(await BroadcastDelivery.countDocuments({ broadcast: b.id, status: 'sent' })).toBe(150);
    expect(r.calls[2].key).toBe(r.calls[1].key); // the retried chunk is de-duplicated by Resend via the same key
  });

  it('gives up after repeated transient errors and surfaces failure', async () => {
    const actor = await superActor();
    await makeLeads(3);
    const b = await schedule(actor);
    const sender: BatchSender = async () => ({ kind: 'transient', message: 'down' });
    for (let i = 0; i < 6; i++) await svc.processDue({ sender, now: later(), ...fast });
    const done = (await Broadcast.findById(b.id))!;
    expect(done.status).toBe('failed');
    expect(done.failedCount).toBe(3);
  });

  it('a plan quota error pauses (does not fail) and explains itself', async () => {
    const actor = await superActor();
    await makeLeads(3);
    const b = await schedule(actor);
    await svc.processDue({ sender: async () => ({ kind: 'quota', message: 'Daily quota exceeded.' }), now: later(), ...fast });
    const paused = (await Broadcast.findById(b.id))!;
    expect(paused.status).toBe('sending');
    expect(paused.lastError).toMatch(/resume automatically/i);
  });

  it('per-address rejections finish as "sent" with a failure count; Retry re-sends only the rejected ones', async () => {
    const actor = await superActor();
    await makeLeads(5);
    const b = await schedule(actor);
    const r1 = recorder((_c, emails) => ({ kind: 'ok', ids: emails.map((_, i) => (i === 1 ? null : `id${i}`)), rejected: [{ index: 1, message: 'Invalid `to` field' }] }));
    await svc.processDue({ sender: r1.sender, now: later(), ...fast });
    const partial = (await Broadcast.findById(b.id))!;
    expect(partial.status).toBe('sent');
    expect(partial.sentCount).toBe(4);
    expect(partial.failedCount).toBe(1);

    const r2 = recorder();
    const out = await svc.retry(actor, b.id, { sender: r2.sender, ...fast });
    expect(r2.recipients()).toHaveLength(1);
    expect(out.failedCount).toBe(0);
    expect(out.sentCount).toBe(5);
  });

  it('survives a worker crash: a live lease blocks other workers; once it expires the send resumes with the same idempotency key', async () => {
    const actor = await superActor();
    await makeLeads(120);
    const b = await schedule(actor);
    // Worker 1 sends one chunk and then "crashes" (its lease is left held).
    let crashed = false;
    const r1 = recorder();
    const crashing: BatchSender = async (e, k) => {
      if (r1.calls.length === 1) {
        crashed = true;
        throw new Error('process killed');
      }
      return r1.sender(e, k);
    };
    await expect(svc.processDue({ sender: crashing, now: later(), ...fast })).rejects.toThrow();
    expect(crashed).toBe(true);

    const r2 = recorder();
    await svc.processDue({ sender: r2.sender, now: later(), ...fast });
    expect(r2.calls).toHaveLength(0); // lease still held: other workers keep out

    await Broadcast.updateOne({ _id: b.id }, { $set: { lockedUntil: new Date(Date.now() - 1000) } }); // time passes
    await svc.processDue({ sender: r2.sender, now: later(), ...fast });
    expect((await Broadcast.findById(b.id))!.status).toBe('sent');
    expect(r1.recipients().length + r2.recipients().length).toBe(120); // nobody twice
  });

  it('uses a deterministic idempotency key per unsent chunk', async () => {
    const actor = await superActor();
    await makeLeads(3);
    await schedule(actor);
    const keys: string[] = [];
    const flaky: BatchSender = async (e, k) => {
      keys.push(k);
      if (keys.length === 1) return { kind: 'transient', message: 'timeout' };
      return { kind: 'ok', ids: e.map(() => 'i'), rejected: [] };
    };
    await svc.processDue({ sender: flaky, now: later(), ...fast });
    await svc.processDue({ sender: flaky, now: later(), ...fast });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });
});

describe('Resend error classification', () => {
  it.each([
    [{ name: 'daily_quota_exceeded', statusCode: 429, message: 'q' }, 'quota'],
    [{ name: 'rate_limit_exceeded', statusCode: 429, message: 'r' }, 'rate'],
    [{ name: 'invalid_api_key', statusCode: 403, message: 'k' }, 'fatal'],
    [{ name: 'validation_error', statusCode: 403, message: 'The navaro.co.in domain is not verified' }, 'fatal'],
    [{ name: 'internal_server_error', statusCode: 500, message: 's' }, 'transient'],
    [{ name: 'application_error', statusCode: null, message: 'network' }, 'transient'],
  ] as const)('%j -> %s', (err, kind) => {
    expect(classifyResendError(err as never).kind).toBe(kind);
  });
});

beforeEach(() => {
  delete process.env.RESEND_FROM_EMAIL;
  delete process.env.RESEND_FROM_NAME;
});

describe('email rendering', () => {
  it('uses the Utendo font stack and only declares @font-face when a font URL is known', async () => {
    const { renderBroadcastHtml } = await import('@/lib/broadcast-email');
    const plain = renderBroadcastHtml({ content: '<p>Hi</p>', preview: 'p' });
    expect(plain).toContain('font-family:Utendo,Poppins');
    expect(plain).not.toContain('@font-face');
    const withFonts = renderBroadcastHtml({ content: '<p>Hi</p>', preview: 'p', fontBaseUrl: 'https://crm.example.com/fonts' });
    expect(withFonts).toContain("src:url('https://crm.example.com/fonts/Utendo-Regular.woff2')");
  });

  it('keeps {{first_name}} visible in the CRM preview but merges the real name when sending', async () => {
    const { renderBroadcastHtml } = await import('@/lib/broadcast-email');
    const input = { content: '<p>Hi {{first_name}},</p>', preview: 'Hey {{first_name}}' };
    const preview = renderBroadcastHtml({ ...input, keepTokens: true });
    expect(preview).toContain('Hi {{first_name}},');
    expect(preview).not.toContain('Alex');
    expect(renderBroadcastHtml({ ...input, firstName: 'Priya' })).toContain('Hi Priya,');
  });
});
