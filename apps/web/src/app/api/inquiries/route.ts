import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api/client';

/**
 * Contact form submissions.
 *
 * The API is not publicly routable — only Next.js talks to it — so the
 * browser posts here and this forwards. That is the same shape the admin
 * panel uses, and it keeps the API's address out of client code.
 *
 * Validation stays on the API: duplicating the rules here would mean two
 * definitions of a valid inquiry that could drift apart, and the API is the
 * one that has to hold regardless of what the browser sends.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Neispravan zahtev.' } },
      { status: 400 },
    );
  }

  try {
    const result = await apiFetch<{ ok: boolean }>('/api/v1/public/inquiries', {
      method: 'POST',
      body,
      cache: 'no-store',
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      // Field errors and the rate limiter's 429 both matter to the person
      // filling in the form, so the API's own status and details pass through.
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.status },
      );
    }

    console.error('[inquiries] unexpected failure forwarding to the API:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Slanje nije uspelo. Pokušajte ponovo.' } },
      { status: 500 },
    );
  }
}
