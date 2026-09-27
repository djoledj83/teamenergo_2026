import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AccessTokenClaims, AdminRole } from '@teamenergo/shared';
import { HttpError } from '../errors.js';
import { verifyAccessToken } from '../auth/tokens.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessTokenClaims;
    }
  }
}

/**
 * The API is reached only through the Next.js BFF, which holds the httpOnly
 * cookies and forwards the access token as a bearer credential. Keeping the
 * API itself cookie-agnostic means it stays a plain stateless REST service.
 */
function bearerFrom(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : undefined;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = bearerFrom(req);
  if (!token) return next(HttpError.unauthorized());

  try {
    req.auth = verifyAccessToken(token);
    return next();
  } catch {
    return next(HttpError.unauthorized('Sesija je istekla'));
  }
};

/** Must run after requireAuth. */
export function requireRole(...roles: AdminRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(HttpError.unauthorized());
    if (!roles.includes(req.auth.role)) return next(HttpError.forbidden());
    return next();
  };
}

/**
 * Blocks every route except the password change itself while a user is
 * flagged `mustChangePassword`, so a seeded initial credential cannot be used
 * to do real work.
 */
export const blockUntilPasswordChanged: RequestHandler = (req, _res, next) => {
  if (req.auth?.mustChangePassword) {
    return next(
      new HttpError(403, 'FORBIDDEN', 'Morate promeniti lozinku pre nastavka', {
        mustChangePassword: true,
      }),
    );
  }
  return next();
};

/** Express 4 does not catch rejected promises from handlers; this does. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
