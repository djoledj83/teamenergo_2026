import pino from 'pino';
import { env, isProduction } from './env.js';

const isTest = env.NODE_ENV === 'test';

export const logger = pino({
  // Tests assert on behaviour, not logs; request logging would bury the output.
  level: isTest ? 'silent' : isProduction ? 'info' : 'debug',
  ...(isProduction || isTest
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
  base: { service: 'teamenergo-api' },
  redact: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.token'],
});

logger.debug({ port: env.API_PORT }, 'logger initialised');
