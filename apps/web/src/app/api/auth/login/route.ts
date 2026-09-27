import { NextResponse, type NextRequest } from 'next/server';
import { loginSchema } from '@teamenergo/shared';
import { ApiError } from '@/lib/api/client';
import { login } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Podaci nisu ispravni',
          details: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  try {
    // Only the user is returned — the tokens go straight into httpOnly
    // cookies and never touch the response body.
    const user = await login(parsed.data.email, parsed.data.password);
    return NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            // In development the underlying cause is far more useful than a
            // generic message; never leaked in production.
            ...(process.env.NODE_ENV === 'production' ? {} : { details: error.details }),
          },
        },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    throw error;
  }
}
