import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({ success: true, message: 'Navaro CRM API is running', timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ success: false, message: 'Database unavailable' }, { status: 503 });
  }
}
