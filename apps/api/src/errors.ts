import { ERROR_CODES, type ErrorCode } from '@teamenergo/shared';

/**
 * Errors thrown with this class are rendered by the error middleware into the
 * shared `{ error: { code, message, details } }` envelope. Anything else that
 * escapes a handler becomes a generic 500 and is logged in full.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new HttpError(400, ERROR_CODES.VALIDATION_FAILED, message, details);
  }

  static unauthorized(message = 'Niste prijavljeni') {
    return new HttpError(401, ERROR_CODES.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Nemate dozvolu za ovu akciju') {
    return new HttpError(403, ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(message = 'Traženi resurs ne postoji') {
    return new HttpError(404, ERROR_CODES.NOT_FOUND, message);
  }

  static conflict(message: string, details?: unknown) {
    return new HttpError(409, ERROR_CODES.CONFLICT, message, details);
  }
}
