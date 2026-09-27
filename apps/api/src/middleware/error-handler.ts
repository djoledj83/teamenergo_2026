import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ERROR_CODES, type ApiFailure } from '@teamenergo/shared';
import { HttpError } from '../errors.js';
import { isProduction } from '../env.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  const body: ApiFailure = {
    error: { code: ERROR_CODES.NOT_FOUND, message: 'Ruta ne postoji' },
  };
  res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    const body: ApiFailure = {
      error: {
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Podaci nisu ispravni',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    };
    res.status(400).json(body);
    return;
  }

  if (err instanceof HttpError) {
    const body: ApiFailure = {
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.status).json(body);
    return;
  }

  req.log?.error({ err }, 'unhandled error');

  const body: ApiFailure = {
    error: {
      code: ERROR_CODES.INTERNAL,
      message: 'Došlo je do greške na serveru',
      // Never leak internals in production; invaluable in development.
      details: isProduction ? undefined : (err as Error)?.stack,
    },
  };
  res.status(500).json(body);
};
