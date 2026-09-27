'use client';

import type { ApiFailure } from '@teamenergo/shared';

/**
 * Browser-side client for the admin API.
 *
 * Every request goes to the Next.js BFF at /api/admin/*, never to the API
 * directly. The session cookie is httpOnly and attached by the browser; the
 * bearer token is added server-side. Nothing here ever sees a token.
 */

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Field-level messages from a Zod failure, keyed by field path. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const entries: Record<string, string> = {};
    for (const issue of this.details as Array<{ path?: string; message?: string }>) {
      if (issue.path && issue.message) entries[issue.path] = issue.message;
    }
    return entries;
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const failure = payload as ApiFailure | null;
    throw new AdminApiError(
      response.status,
      failure?.error?.code ?? 'UNKNOWN',
      failure?.error?.message ?? `Zahtev nije uspeo (${response.status})`,
      failure?.error?.details,
    );
  }

  return payload as T;
}

const base = (path: string) => `/api/admin/${path.replace(/^\//, '')}`;

export const adminApi = {
  get: <T>(path: string) => fetch(base(path), { cache: 'no-store' }).then(parse<T>),

  post: <T>(path: string, body?: unknown) =>
    fetch(base(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }).then(parse<T>),

  patch: <T>(path: string, body: unknown) =>
    fetch(base(path), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(parse<T>),

  put: <T>(path: string, body: unknown) =>
    fetch(base(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(parse<T>),

  delete: <T>(path: string) => fetch(base(path), { method: 'DELETE' }).then(parse<T>),

  /** Multipart upload — Content-Type is left to the browser so the boundary is correct. */
  upload: <T>(path: string, files: File[], folder?: string) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    if (folder) form.append('folder', folder);
    return fetch(base(path), { method: 'POST', body: form }).then(parse<T>);
  },

  /**
   * Upload with a progress callback.
   *
   * XMLHttpRequest rather than fetch: fetch still cannot report how much of a
   * request body has been sent, so a spinner is the best it can offer. On a
   * slow connection with several files that is the difference between "this
   * is working" and "this has frozen".
   */
  uploadWithProgress: <T>(
    path: string,
    files: File[],
    onProgress: (percent: number) => void,
    folder?: string,
  ): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const form = new FormData();
      for (const file of files) form.append('files', file);
      if (folder) form.append('folder', folder);

      const request = new XMLHttpRequest();
      request.open('POST', base(path));

      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      request.addEventListener('load', () => {
        let payload: unknown = null;
        try {
          payload = request.responseText ? JSON.parse(request.responseText) : null;
        } catch {
          payload = null;
        }

        if (request.status >= 200 && request.status < 300) {
          resolve(payload as T);
          return;
        }

        const failure = payload as ApiFailure | null;
        reject(
          new AdminApiError(
            request.status,
            failure?.error?.code ?? 'UNKNOWN',
            failure?.error?.message ?? `Otpremanje nije uspelo (${request.status})`,
            failure?.error?.details,
          ),
        );
      });

      request.addEventListener('error', () =>
        reject(new AdminApiError(0, 'NETWORK', 'Veza je prekinuta tokom otpremanja.')),
      );
      request.addEventListener('abort', () =>
        reject(new AdminApiError(0, 'ABORTED', 'Otpremanje je otkazano.')),
      );

      request.send(form);
    }),
};

export async function signOut(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/admin/login';
}
