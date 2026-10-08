import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import * as broadcasts from '@/services/broadcasts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false; // never run open: no secret configured = disabled
  const header = req.headers.get('authorization') ?? '';
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/**
 * Scheduler tick. Authenticated by a shared secret (Vercel Cron sends it automatically as
 * `Authorization: Bearer $CRON_SECRET`; GitHub Actions / any external pinger can send the same
 * header). It is excluded from the session middleware, so this check is the only gate.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, message: 'Scheduler is not configured (CRON_SECRET missing)' }, { status: 503 });
  }
  if (!authorised(req)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    await connectDB();
    const { handled } = await broadcasts.processDue();
    return NextResponse.json({ success: true, handled: handled.length });
  } catch (err) {
    console.error('Broadcast scheduler tick failed:', err);
    return NextResponse.json({ success: false, message: 'Scheduler tick failed' }, { status: 500 });
  }
}
