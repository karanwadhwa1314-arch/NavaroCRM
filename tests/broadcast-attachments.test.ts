import { describe, it, expect } from 'vitest';
import http from 'node:http';
import * as svc from '@/services/broadcasts';
import Broadcast from '@/models/Broadcast';
import BroadcastAttachment from '@/models/BroadcastAttachment';
import Lead from '@/models/Lead';
import { decodeUpload } from '@/lib/broadcast-attachments';
import { createBroadcastSchema, updateBroadcastSchema } from '@/lib/validation/broadcast';
import { resendBatchSender, type BatchSender, type BatchEmail } from '@/lib/resend-batch';
import { createTestUser, toActor } from './helpers';

const HOUR = 3600_000;
const later = (ms = 2 * HOUR) => () => new Date(Date.now() + ms);

async function superActor() {
  return toActor(await createTestUser({ role: 'superadmin' }));
}

async function makeLeads(n: number) {
  const base = await Lead.countDocuments();
  await Lead.insertMany(
    Array.from({ length: n }, (_, i) => ({ firstName: `Lead${base + i}`, lastName: 'Test', email: `att${base + i}@example.com`, company: 'Co', isActive: true }))
  );
}

function recorder() {
  const calls: { emails: BatchEmail[]; key: string }[] = [];
  const sender: BatchSender = async (emails, key) => {
    calls.push({ emails, key });
    return { kind: 'ok', ids: emails.map((_, i) => `id-${calls.length}-${i}`), rejected: [] };
  };
  return { sender, calls };
}

const pdf = (bytes = 2000) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(bytes, 1)]);
const upload = (filename: string, data: Buffer) => ({ filename, data: data.toString('base64') });

async function schedule(actor: ReturnType<typeof toActor>, overrides: Record<string, unknown> = {}) {
  const input = createBroadcastSchema.parse({
    subject: 'Hello {{first_name}}',
    preview: 'Preview text',
    content: '<p>Hi {{first_name}}, welcome.</p>',
    scheduledAt: new Date(Date.now() + HOUR).toISOString(),
    ...overrides,
  });
  return svc.create(actor, input);
}

describe('attachment validation', () => {
  it('accepts a real PDF and takes the content type from the extension, not the client', () => {
    const f = decodeUpload(upload('../../Brochure.PDF', pdf()));
    expect(f.filename).toBe('Brochure.PDF');
    expect(f.contentType).toBe('application/pdf');
  });

  it('rejects files over 400 KB, disallowed types, empty files and content that does not match the extension', () => {
    expect(() => decodeUpload(upload('big.pdf', pdf(400 * 1024)))).toThrow(/400 KB or smaller/);
    expect(() => decodeUpload(upload('edge.pdf', pdf(400 * 1024 - 9)))).not.toThrow(); // exactly 400 KB is fine
    expect(() => decodeUpload(upload('run.exe', Buffer.from('MZ....')))).toThrow(/allowed file type/);
    expect(() => decodeUpload(upload('page.html', Buffer.from('<script>')))).toThrow(/allowed file type/);
    expect(() => decodeUpload(upload('fake.pdf', Buffer.from('MZ this is an exe')))).toThrow(/real \.pdf/);
    expect(() => decodeUpload(upload('empty.txt', Buffer.alloc(0)))).toThrow();
    expect(() => decodeUpload({ filename: 'x.pdf', data: '***not base64***' })).toThrow(/could not be read/);
  });

  it('allows at most 5 attachments per broadcast', () => {
    const items = Array.from({ length: 6 }, (_, i) => upload(`f${i}.pdf`, pdf()));
    const base = { subject: 's', preview: 'p', content: '<p>x</p>' };
    expect(createBroadcastSchema.safeParse({ ...base, attachments: items }).success).toBe(false);
    expect(createBroadcastSchema.safeParse({ ...base, attachments: items.slice(0, 5) }).success).toBe(true);
  });
});

describe('attachments on broadcasts', () => {
  it('stores files with the broadcast and sends them with every email, in small chunks', async () => {
    const actor = await superActor();
    await makeLeads(9);
    const b = await schedule(actor, { attachments: [upload('a.pdf', pdf(10)), upload('b.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]))] });
    expect(b.attachments.map((a) => a.filename)).toEqual(['a.pdf', 'b.png']);

    const r = recorder();
    const out = await svc.processDue({ sender: r.sender, now: later(), pauseMs: 0 });
    expect(out.handled).toEqual([b.id]);
    expect(r.calls.map((c) => c.emails.length)).toEqual([4, 4, 1]); // one request per recipient, so chunks stay small
    for (const e of r.calls.flatMap((c) => c.emails)) {
      expect(e.attachments?.map((a) => a.filename)).toEqual(['a.pdf', 'b.png']);
      expect(e.attachments?.[0].content.subarray(0, 5).toString()).toBe('%PDF-');
      expect(e.attachments?.[0].contentType).toBe('application/pdf');
    }
    expect((await Broadcast.findById(b.id))!.status).toBe('sent');
  });

  it('broadcasts without attachments still use full batches of 100', async () => {
    const actor = await superActor();
    await makeLeads(120);
    const b = await schedule(actor);
    const r = recorder();
    await svc.processDue({ sender: r.sender, now: later(), pauseMs: 0 });
    expect(r.calls.map((c) => c.emails.length)).toEqual([100, 20]);
    expect(r.calls[0].emails[0].attachments).toBeUndefined();
    expect(b.attachments).toEqual([]);
  });

  it('edit keeps, removes and adds files; removed files are deleted from storage', async () => {
    const actor = await superActor();
    const b = await schedule(actor, { attachments: [upload('keep.pdf', pdf(10)), upload('drop.pdf', pdf(11))] });
    const keepId = b.attachments[0].id;
    const updated = await svc.update(actor, b.id, updateBroadcastSchema.parse({ attachments: [{ id: keepId }, upload('new.pdf', pdf(12))] }));
    expect(updated.attachments.map((a) => a.filename)).toEqual(['keep.pdf', 'new.pdf']);
    expect(await BroadcastAttachment.countDocuments({ broadcast: b.id })).toBe(2);
    expect(await BroadcastAttachment.countDocuments({ broadcast: b.id, filename: 'drop.pdf' })).toBe(0);
    // Leaving `attachments` out of an edit leaves them alone.
    const again = await svc.update(actor, b.id, updateBroadcastSchema.parse({ subject: 'New subject' }));
    expect(again.attachments).toHaveLength(2);
    // An id that does not belong to this broadcast is refused.
    await expect(svc.update(actor, b.id, updateBroadcastSchema.parse({ attachments: [{ id: 'a'.repeat(24) }] }))).rejects.toThrow(/no longer exists/);
  });

  it('a sent broadcast cannot have its files changed, and a refused edit leaves no orphaned files', async () => {
    const actor = await superActor();
    await makeLeads(2);
    const b = await schedule(actor, { attachments: [upload('a.pdf', pdf(10))] });
    const r = recorder();
    await svc.sendNow(actor, b.id, { sender: r.sender, pauseMs: 0 });
    await expect(svc.update(actor, b.id, updateBroadcastSchema.parse({ attachments: [upload('late.pdf', pdf(10))] }))).rejects.toThrow(/can't be edited/);
    expect(await BroadcastAttachment.countDocuments({ broadcast: b.id })).toBe(1);
    expect((await svc.get(b.id)).attachments.map((a) => a.filename)).toEqual(['a.pdf']);
  });

  it('deleting a broadcast deletes its files; downloads are scoped to their broadcast', async () => {
    const actor = await superActor();
    const b = await schedule(actor, { attachments: [upload('a.pdf', pdf(10))] });
    const other = await schedule(actor);
    const file = await svc.getAttachment(b.id, b.attachments[0].id);
    expect(file.filename).toBe('a.pdf');
    await expect(svc.getAttachment(other.id, b.attachments[0].id)).rejects.toThrow(/not found/i);
    await svc.remove(actor, b.id);
    expect(await BroadcastAttachment.countDocuments({ broadcast: b.id })).toBe(0);
  });

  it('refuses to send (and sends nothing) if a stored file has gone missing', async () => {
    const actor = await superActor();
    await makeLeads(3);
    const b = await schedule(actor, { attachments: [upload('a.pdf', pdf(10))] });
    await BroadcastAttachment.deleteMany({ broadcast: b.id });
    const r = recorder();
    const out = await svc.sendNow(actor, b.id, { sender: r.sender, pauseMs: 0 });
    expect(out.status).toBe('failed');
    expect(out.lastError).toMatch(/missing/);
    expect(r.calls).toHaveLength(0);
  });
});

describe('sending attachments through Resend', () => {
  it('sends one request per recipient with the file attached and a per-email idempotency key; bad addresses are rejected individually', async () => {
    const seen: { key?: string; body: any }[] = [];
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = JSON.parse(raw);
        seen.push({ key: req.headers['idempotency-key'] as string, body });
        res.setHeader('content-type', 'application/json');
        if (/bad/.test(body.to[0])) {
          res.statusCode = 422;
          return res.end(JSON.stringify({ name: 'validation_error', message: 'Invalid `to` field.', statusCode: 422 }));
        }
        res.end(JSON.stringify({ id: `id-${seen.length}` }));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    const prev = { key: process.env.RESEND_API_KEY, url: process.env.RESEND_BASE_URL };
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_BASE_URL = `http://127.0.0.1:${port}`;
    try {
      const att = { filename: 'a.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF-1.4 hello') };
      const mk = (to: string) => ({ from: 'K <k@navaro.co.in>', to: [to], subject: 's', html: '<p>h</p>', text: 'h', attachments: [att] });
      const res = await resendBatchSender([mk('a@example.com'), mk('bad@example.com'), mk('c@example.com')], 'bc-1-x-3');
      expect(res.kind).toBe('ok');
      if (res.kind !== 'ok') return;
      expect(res.rejected.map((r) => r.index)).toEqual([1]);
      expect(res.ids[1]).toBeNull();
      expect(res.ids[0]).toBeTruthy();
      expect(seen.map((s) => s.key).sort()).toEqual(['bc-1-x-3-0', 'bc-1-x-3-1', 'bc-1-x-3-2']);
      const sent = seen.find((s) => s.body.to[0] === 'a@example.com')!.body;
      expect(sent.attachments[0].filename).toBe('a.pdf');
      expect(Buffer.from(sent.attachments[0].content, 'base64').toString()).toBe('%PDF-1.4 hello');
    } finally {
      if (prev.key === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = prev.key;
      if (prev.url === undefined) delete process.env.RESEND_BASE_URL;
      else process.env.RESEND_BASE_URL = prev.url;
      await new Promise((r) => server.close(r));
    }
  });
});
