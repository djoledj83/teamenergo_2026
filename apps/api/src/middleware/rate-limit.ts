import rateLimit from 'express-rate-limit';
import { ERROR_CODES, type ApiFailure } from '@teamenergo/shared';
import { isProduction } from '../env.js';

const failure: ApiFailure = {
  error: {
    code: ERROR_CODES.RATE_LIMITED,
    message: 'Previše pokušaja. Pokušajte ponovo za nekoliko minuta.',
  },
};

/**
 * Login is the one endpoint where an attacker gets unlimited free guesses, so
 * it is limited per IP. Successful logins are not counted, so a person working
 * normally never trips it.
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 10 : 100,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: failure,
});

/** Public form submissions — spam control rather than security. */
export const publicWriteRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: isProduction ? 20 : 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: failure,
});

/** Broad ceiling on the admin surface to blunt scripted abuse. */
export const adminRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: isProduction ? 300 : 10_000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: failure,
});
