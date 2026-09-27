import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Niste prijavljeni' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
}
