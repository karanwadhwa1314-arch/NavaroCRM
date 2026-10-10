import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import * as projectCards from '@/services/project-cards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false; // never run open: no secret configured = disabled
  const header = req.headers.get('authorization') ?? '';
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/**
 * Daily clean-up of Done project cards older than the retention window. Same shared-secret scheme as the
 * broadcast scheduler (excluded from the session middleware, so this check is the only gate).
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, message: 'Scheduler is not configured (CRON_SECRET missing)' }, { status: 503 });
  }
  if (!authorised(req)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    await connectDB();
    const { deleted } = await projectCards.expireDoneCards();
    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    console.error('Project card clean-up failed:', err);
    return NextResponse.json({ success: false, message: 'Clean-up failed' }, { status: 500 });
  }
}
