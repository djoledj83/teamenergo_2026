import type { ApiFailure } from '@teamenergo/shared';

/**
 * Server-side client for the API.
 *
 * The API is not publicly routable: only Next.js talks to it, over the
 * internal Docker network. Every function here runs on the server — in a
 * server component or a route handler — never in the browser.
 */

export const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNotFound() {
    return this.status === 404;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Next.js cache tags, so an admin save can revalidate exactly what changed. */
  tags?: string[];
  revalidate?: number | false;
  accessToken?: string | undefined;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, tags, revalidate, accessToken, headers, ...rest } = options;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(tags || revalidate !== undefined
        ? { next: { ...(tags ? { tags } : {}), ...(revalidate !== undefined ? { revalidate } : {}) } }
        : {}),
    });
  } catch (cause) {
    // A transport failure (API not running, wrong host, DNS) surfaces as a
    // bare TypeError with no useful message. Turning it into an ApiError here
    // means callers get one error type and the operator gets a message that
    // names the address that refused.
    throw new ApiError(
      503,
      'API_UNREACHABLE',
      `Nije moguće povezati se sa API serverom na ${API_URL}. Da li je pokrenut?`,
      cause instanceof Error ? cause.message : String(cause),
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const failure = payload as ApiFailure | null;
    throw new ApiError(
      response.status,
      failure?.error?.code ?? 'UNKNOWN',
      failure?.error?.message ?? `Zahtev nije uspeo (${response.status})`,
      failure?.error?.details,
    );
  }

  return payload as T;
}

/**
 * Returns null on 404 instead of throwing.
 *
 * A missing slug is an expected outcome for a public page — it should render
 * Next.js's notFound() rather than a 500.
 */
export async function apiFetchOptional<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T | null> {
  try {
    return await apiFetch<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}
