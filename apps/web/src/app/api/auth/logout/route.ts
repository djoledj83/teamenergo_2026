import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  await logout();
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
