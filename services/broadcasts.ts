import mongoose from 'mongoose';
import Broadcast, { type BroadcastDocument } from '@/models/Broadcast';
import BroadcastDelivery from '@/models/BroadcastDelivery';
import Lead from '@/models/Lead';
import { AppError, conflict, forbidden } from '@/lib/api/errors';
import { hasPermission } from '@/lib/permissions';
import { recordAudit } from '@/services/audit';
import { isValidEmail, renderBroadcastHtml, renderBroadcastText, mergeText } from '@/lib/broadcast-email';
import { resendBatchSender, isConfigured, type BatchSender, type BatchEmail } from '@/lib/resend-batch';
import type { SessionUser } from '@/lib/auth/session';
import type { CreateBroadcastInput, UpdateBroadcastInput } from '@/lib/validation/broadcast';

// ---------------------------------------------------------------------------------------------
// Tunables. Resend: 100 emails per batch call, 10 requests/second per team (default).
// ---------------------------------------------------------------------------------------------
export const CHUNK_SIZE = 100;
const LEASE_MS = 90_000; // a worker owns a broadcast this long; it is re-extended every chunk
const PAUSE_BETWEEN_CHUNKS_MS = 250; // ~4 req/s, comfortably under the 10 req/s limit
const MAX_TRANSIENT_FAILURES = 5;
const DEFAULT_BUDGET_MS = 40_000; // keep well inside the 60s function limit

export interface ProcessOptions {
  sender?: BatchSender;
  now?: () => Date;
  budgetMs?: number;
  pauseMs?: number;
  chunkSize?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function getSenderConfig() {
  const email = (process.env.RESEND_FROM_EMAIL || 'karan@navaro.co.in').trim();
  const name = (process.env.RESEND_FROM_NAME ?? 'Karan from Navaro').trim();
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  return {
    email,
    from: name ? `${name} <${email}>` : email,
    logoUrl: appUrl ? `${appUrl}/brand/logo-horizontal-trim.png` : undefined,
    fontBaseUrl: appUrl ? `${appUrl}/fonts` : undefined,
  };
}

export function emailConfigured(): boolean {
  return isConfigured();
}

/** Cheap estimate shown in the "Broadcast now" confirmation (the exact audience is frozen at send time). */
export async function audienceEstimate(): Promise<number> {
  return Lead.countDocuments({ isActive: true });
}

// ---------------------------------------------------------------------------------------------
// Audience. The ONE place that decides who receives a broadcast — segmentation can change this
// function later without touching sending, scheduling or the UI.
//
// Rule (from the existing Lead model, nothing invented): every *active* lead (isActive: true;
// archived leads are excluded) in any stage, using Lead.email. Invalid addresses are skipped and
// duplicate addresses (case-insensitive) are collapsed to one recipient.
// ---------------------------------------------------------------------------------------------
export interface AudienceRecipient {
  lead: mongoose.Types.ObjectId;
  email: string;
  firstName?: string;
}

export async function resolveAudience(): Promise<{ recipients: AudienceRecipient[]; skippedInvalid: number; duplicates: number }> {
  const leads = await Lead.find({ isActive: true }).select('email firstName').sort({ _id: 1 }).lean();
  const seen = new Set<string>();
  const recipients: AudienceRecipient[] = [];
  let skippedInvalid = 0;
  let duplicates = 0;
  for (const l of leads) {
    const email = (l.email ?? '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      skippedInvalid++;
      continue;
    }
    if (seen.has(email)) {
      duplicates++;
      continue;
    }
    seen.add(email);
    recipients.push({ lead: l._id as mongoose.Types.ObjectId, email, firstName: l.firstName });
  }
  return { recipients, skippedInvalid, duplicates };
}

// ---------------------------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------------------------
export function serializeBroadcast(b: BroadcastDocument | (Record<string, any> & { _id: unknown }), withContent = false) {
  const o = b as Record<string, any>;
  return {
    id: String(o._id),
    subject: o.subject as string,
    preview: o.preview as string,
    ...(withContent
      ? {
          content: o.content as string,
          // Exactly what a recipient sees (brand shell, preheader), with a sample first name — for the read-only preview.
          previewHtml: renderBroadcastHtml({ content: o.content, preview: o.preview, keepTokens: true, logoUrl: getSenderConfig().logoUrl, fontBaseUrl: getSenderConfig().fontBaseUrl }),
        }
      : {}),
    status: o.status as string,
    scheduledAt: o.scheduledAt ? new Date(o.scheduledAt).toISOString() : null,
    startedAt: o.startedAt ? new Date(o.startedAt).toISOString() : null,
    sentAt: o.sentAt ? new Date(o.sentAt).toISOString() : null,
    createdAt: new Date(o.createdAt).toISOString(),
    updatedAt: new Date(o.updatedAt).toISOString(),
    fromEmail: (o.fromEmail ?? null) as string | null,
    recipientCount: (o.recipientCount ?? 0) as number,
    sentCount: (o.sentCount ?? 0) as number,
    failedCount: (o.failedCount ?? 0) as number,
    lastError: (o.lastError ?? null) as string | null,
  };
}

// ---------------------------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------------------------
export async function list() {
  // Content is excluded: the list only needs metadata, and bodies are fetched when one is opened.
  const items = await Broadcast.find().select('-content').sort({ createdAt: -1 }).lean();
  return items.map((b) => serializeBroadcast(b));
}

export async function get(id: string) {
  const b = await Broadcast.findById(id).lean();
  if (!b) throw new AppError(404, 'Broadcast not found');
  return serializeBroadcast(b, true);
}

function assertFuture(date: Date, now: Date) {
  if (date.getTime() <= now.getTime()) {
    throw new AppError(400, 'Choose a date and time in the future', { errors: [{ field: 'scheduledAt', message: 'Choose a date and time in the future' }] });
  }
}

/** Scheduling is authorising a future send to every lead, so it needs the send permission, not just create/edit. */
function assertMaySchedule(actor: SessionUser) {
  if (!hasPermission(actor, 'broadcasts.send')) throw forbidden("You don't have permission to schedule or send broadcasts");
}

export async function create(actor: SessionUser, input: CreateBroadcastInput, now = new Date()) {
  if (input.scheduledAt) {
    assertMaySchedule(actor);
    assertFuture(input.scheduledAt, now);
  }
  const b = await Broadcast.create({
    subject: input.subject,
    preview: input.preview,
    content: input.content,
    status: input.scheduledAt ? 'scheduled' : 'draft',
    scheduledAt: input.scheduledAt ?? null,
    createdBy: actor.id,
    fromEmail: getSenderConfig().email,
  });
  await recordAudit({ user: actor.id, action: 'create', entity: 'broadcast', entityId: String(b._id), description: `Created broadcast "${b.subject}" (${b.status})` });
  return serializeBroadcast(b, true);
}

/** Only draft/scheduled broadcasts are editable. The status condition is part of the write, so an edit can never slip in after a send has been claimed. */
export async function update(actor: SessionUser, id: string, input: UpdateBroadcastInput, now = new Date()) {
  const current = await Broadcast.findById(id).select('status').lean();
  if (!current) throw new AppError(404, 'Broadcast not found');
  if (current.status === 'scheduled' || input.scheduledAt) assertMaySchedule(actor);

  const $set: Record<string, unknown> = {};
  if (input.subject !== undefined) $set.subject = input.subject;
  if (input.preview !== undefined) $set.preview = input.preview;
  if (input.content !== undefined) $set.content = input.content;
  if (input.scheduledAt !== undefined) {
    if (input.scheduledAt) {
      assertFuture(input.scheduledAt, now);
      $set.scheduledAt = input.scheduledAt;
      $set.status = 'scheduled';
    } else {
      $set.scheduledAt = null;
      $set.status = 'draft';
    }
  }

  const updated = await Broadcast.findOneAndUpdate({ _id: id, status: { $in: ['draft', 'scheduled'] } }, { $set }, { new: true }).lean();
  if (!updated) await throwNotEditable(id, 'edited');
  await recordAudit({ user: actor.id, action: 'update', entity: 'broadcast', entityId: id, description: `Updated broadcast "${updated!.subject}"` });
  return serializeBroadcast(updated!, true);
}

/** Drafts, scheduled broadcasts and failed ones that never delivered anything may be deleted. Anything that has been (even partly) sent is a historical record. */
export async function remove(actor: SessionUser, id: string): Promise<void> {
  const res = await Broadcast.findOneAndDelete({ _id: id, status: { $in: ['draft', 'scheduled', 'failed'] }, sentCount: 0 }).lean();
  if (!res) {
    const existing = await Broadcast.findById(id).select('status').lean();
    if (!existing) throw new AppError(404, 'Broadcast not found');
    throw conflict("This broadcast has been sent (or is sending), so it's kept as a record and can't be deleted.");
  }
  await BroadcastDelivery.deleteMany({ broadcast: id });
  await recordAudit({ user: actor.id, action: 'delete', entity: 'broadcast', entityId: id, description: `Deleted broadcast "${res.subject}"` });
}

async function throwNotEditable(id: string, verb: string): Promise<never> {
  const existing = await Broadcast.findById(id).select('status').lean();
  if (!existing) throw new AppError(404, 'Broadcast not found');
  throw conflict(`This broadcast is ${existing.status} and can't be ${verb}.`);
}

// ---------------------------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------------------------

/** Broadcast now: bypass the schedule. Claims atomically, then sends as much as the time budget allows; the scheduler finishes the rest. */
export async function sendNow(actor: SessionUser, id: string, opts: ProcessOptions = {}) {
  const now = (opts.now ?? (() => new Date()))();
  const claimed = await Broadcast.findOneAndUpdate(
    { _id: id, status: { $in: ['draft', 'scheduled'] } },
    { $set: { status: 'sending', startedAt: now, lockedUntil: new Date(now.getTime() + LEASE_MS), lastError: null, transientFailures: 0, fromEmail: getSenderConfig().email } },
    { new: true }
  ).lean();
  if (!claimed) await throwNotEditable(id, 'sent now');
  await recordAudit({ user: actor.id, action: 'status_change', entity: 'broadcast', entityId: id, description: `Broadcast now: "${claimed!.subject}"` });
  await runClaimed(id, opts);
  return get(id);
}

/** Retry a failed broadcast, or re-send only the rejected recipients of one that finished with failures. Already-delivered recipients are never re-sent. */
export async function retry(actor: SessionUser, id: string, opts: ProcessOptions = {}) {
  const now = (opts.now ?? (() => new Date()))();
  const claimed = await Broadcast.findOneAndUpdate(
    { _id: id, $or: [{ status: 'failed' }, { status: 'sent', failedCount: { $gt: 0 } }] },
    { $set: { status: 'sending', lockedUntil: new Date(now.getTime() + LEASE_MS), lastError: null, transientFailures: 0, startedAt: now } },
    { new: true }
  ).lean();
  if (!claimed) await throwNotEditable(id, 'retried');
  await BroadcastDelivery.updateMany({ broadcast: id, status: 'failed' }, { $set: { status: 'pending', error: null } });
  if (claimed!.recipientCount === 0) await Broadcast.updateOne({ _id: id }, { $set: { audienceSnapshotAt: null } });
  await recordAudit({ user: actor.id, action: 'status_change', entity: 'broadcast', entityId: id, description: `Retry: "${claimed!.subject}"` });
  await runClaimed(id, opts);
  return get(id);
}

/**
 * Scheduler entry point (called by /api/cron/broadcasts). Stateless: everything it needs is in the
 * database, so a restart, redeploy or missed tick only delays a send — it never loses or repeats one.
 *  1. Claims scheduled broadcasts whose time has come.
 *  2. Resumes broadcasts left in "sending" whose worker died or ran out of time (lease expired).
 */
export async function processDue(opts: ProcessOptions = {}) {
  const nowFn = opts.now ?? (() => new Date());
  const deadline = Date.now() + (opts.budgetMs ?? DEFAULT_BUDGET_MS);
  const handled: string[] = [];

  while (Date.now() < deadline) {
    const now = nowFn();
    let claimed = await Broadcast.findOneAndUpdate(
      { status: 'scheduled', scheduledAt: { $lte: now } },
      { $set: { status: 'sending', startedAt: now, lockedUntil: new Date(now.getTime() + LEASE_MS), lastError: null, transientFailures: 0, fromEmail: getSenderConfig().email } },
      { sort: { scheduledAt: 1 }, new: true }
    ).lean();

    if (!claimed) {
      claimed = await Broadcast.findOneAndUpdate(
        { status: 'sending', _id: { $nin: handled }, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
        { $set: { lockedUntil: new Date(now.getTime() + LEASE_MS) } },
        { sort: { updatedAt: 1 }, new: true }
      ).lean();
    }
    if (!claimed) break;

    const id = String(claimed._id);
    handled.push(id);
    await runClaimed(id, { ...opts, budgetMs: Math.max(1000, deadline - Date.now()) });
  }
  return { handled };
}

type StopReason = 'finished' | 'paused' | 'failed' | 'lost-lease';

/** Sends pending recipients of a broadcast this worker has already claimed (status 'sending' + lease). */
async function runClaimed(id: string, opts: ProcessOptions): Promise<StopReason> {
  const sender = opts.sender ?? resendBatchSender;
  const nowFn = opts.now ?? (() => new Date());
  const deadline = Date.now() + (opts.budgetMs ?? DEFAULT_BUDGET_MS);
  const pauseMs = opts.pauseMs ?? PAUSE_BETWEEN_CHUNKS_MS;
  const chunkSize = opts.chunkSize ?? CHUNK_SIZE;
  const cfg = getSenderConfig();

  const b = await Broadcast.findById(id).lean();
  if (!b || b.status !== 'sending') return 'lost-lease';

  if (!b.audienceSnapshotAt) await snapshotAudience(id, nowFn());

  const release = (extra: Record<string, unknown> = {}) => Broadcast.updateOne({ _id: id, status: 'sending' }, { $set: { lockedUntil: null, ...extra } });

  for (;;) {
    if (Date.now() >= deadline) {
      await release();
      return 'paused'; // lease released: the next scheduler tick resumes immediately
    }

    const pending = await BroadcastDelivery.find({ broadcast: id, status: 'pending' }).sort({ _id: 1 }).limit(chunkSize).lean();
    if (pending.length === 0) break;

    // Extend the lease; if the status changed under us (should not happen) stop touching it.
    const held = await Broadcast.updateOne({ _id: id, status: 'sending' }, { $set: { lockedUntil: new Date(nowFn().getTime() + LEASE_MS) } });
    if (held.matchedCount === 0) return 'lost-lease';

    const emails: BatchEmail[] = pending.map((d) => ({
      from: cfg.from,
      to: [d.email],
      subject: mergeText(b.subject, d.firstName),
      html: renderBroadcastHtml({ content: b.content, preview: b.preview, firstName: d.firstName, logoUrl: cfg.logoUrl, fontBaseUrl: cfg.fontBaseUrl }),
      text: renderBroadcastText({ content: b.content, firstName: d.firstName }),
    }));
    // Deterministic for a given set of still-pending recipients, so a retry after a crash that
    // happened between "Resend accepted it" and "we recorded it" is de-duplicated by Resend (24h).
    const key = `bc-${id}-${pending[0]._id}-${pending.length}`;
    const res = await sender(emails, key);

    if (res.kind === 'ok') {
      const at = nowFn();
      const rejectedAt = new Map(res.rejected.map((r) => [r.index, r.message]));
      await BroadcastDelivery.bulkWrite(
        pending.map((d, i) => ({
          updateOne: {
            filter: { _id: d._id },
            update: rejectedAt.has(i)
              ? { $set: { status: 'failed', error: rejectedAt.get(i), attemptedAt: at } }
              : { $set: { status: 'sent', providerId: res.ids[i], error: null, attemptedAt: at } },
          },
        }))
      );
      await Broadcast.updateOne(
        { _id: id },
        { $inc: { sentCount: pending.length - rejectedAt.size, failedCount: rejectedAt.size }, $set: { transientFailures: 0 } }
      );
      await sleep(pauseMs);
      continue;
    }

    if (res.kind === 'rate') {
      await sleep(Math.min(2000, pauseMs * 8 + 500)); // back off; same chunk, same key
      continue;
    }

    if (res.kind === 'quota') {
      await release({ lastError: `${res.message} Sending will resume automatically once your plan's limit resets.` });
      return 'paused';
    }

    if (res.kind === 'transient') {
      const fresh = await Broadcast.findByIdAndUpdate(id, { $inc: { transientFailures: 1 }, $set: { lastError: res.message } }, { new: true }).lean();
      if ((fresh?.transientFailures ?? 0) >= MAX_TRANSIENT_FAILURES) {
        await BroadcastDelivery.updateMany({ broadcast: id, status: 'pending' }, { $set: { status: 'failed', error: 'Gave up after repeated email provider errors' } });
        break; // finalise below
      }
      await release();
      return 'paused';
    }

    // fatal: configuration problem. Leave every unsent recipient pending so Retry resumes after it is fixed.
    await Broadcast.updateOne({ _id: id, status: 'sending' }, { $set: { status: 'failed', lockedUntil: null, lastError: res.message } });
    await syncCounts(id);
    return 'failed';
  }

  await finalize(id, nowFn());
  return 'finished';
}

async function snapshotAudience(id: string, at: Date) {
  const { recipients } = await resolveAudience();
  if (recipients.length > 0) {
    try {
      await BroadcastDelivery.insertMany(
        recipients.map((r) => ({ broadcast: id, lead: r.lead, email: r.email, firstName: r.firstName, status: 'pending' })),
        { ordered: false }
      );
    } catch (err) {
      // E11000 = already snapshotted by an earlier (interrupted) attempt; the unique index kept it consistent.
      const dup = (err as { code?: number; writeErrors?: { code?: number }[] }) ?? {};
      const onlyDuplicates = dup.code === 11000 || (dup.writeErrors ?? []).every((w) => w.code === 11000);
      if (!onlyDuplicates) throw err;
    }
  }
  const total = await BroadcastDelivery.countDocuments({ broadcast: id });
  await Broadcast.updateOne({ _id: id }, { $set: { audienceSnapshotAt: at, recipientCount: total } });
}

async function syncCounts(id: string) {
  const [sent, failed] = await Promise.all([
    BroadcastDelivery.countDocuments({ broadcast: id, status: 'sent' }),
    BroadcastDelivery.countDocuments({ broadcast: id, status: 'failed' }),
  ]);
  await Broadcast.updateOne({ _id: id }, { $set: { sentCount: sent, failedCount: failed } });
  return { sent, failed };
}

async function finalize(id: string, at: Date) {
  const { sent, failed } = await syncCounts(id);
  const b = await Broadcast.findById(id).select('sentAt recipientCount').lean();
  const noRecipients = (b?.recipientCount ?? 0) === 0;
  const status = sent > 0 ? 'sent' : 'failed';
  const lastError =
    sent > 0
      ? failed > 0
        ? `${failed} recipient${failed === 1 ? ' was' : 's were'} rejected by the email provider.`
        : null
      : noRecipients
        ? 'There are no leads with a valid email address to send to.'
        : 'Every recipient was rejected by the email provider.';
  await Broadcast.updateOne(
    { _id: id, status: 'sending' },
    { $set: { status, sentAt: b?.sentAt ?? at, lockedUntil: null, lastError } }
  );
}
