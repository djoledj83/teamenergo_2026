import type { RequestHandler } from 'express';
import type { ZodSchema, z } from 'zod';

/**
 * Validates and REPLACES the request body with the parsed result, so handlers
 * receive data that is both typed and stripped of unknown keys. The schemas
 * come from packages/shared — the same module the frontend builds its types
 * from, so the two sides cannot drift.
 *
 * ZodError is translated into the shared error envelope by the error handler.
 */
export function validateBody(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    return next();
  };
}

/**
 * Parses query parameters inside a handler rather than as middleware.
 *
 * `req.query` is a getter in newer Express versions and cannot be reassigned,
 * so returning the parsed value keeps the result properly typed instead of
 * smuggling it onto the request object.
 */
export function parseQuery<S extends ZodSchema>(schema: S, query: unknown): z.infer<S> {
  return schema.parse(query);
}
