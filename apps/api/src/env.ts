import { z } from 'zod';

/**
 * Environment is validated once at boot. A missing or malformed variable
 * fails the process immediately with a readable message, rather than
 * surfacing as an undefined value somewhere deep in a request handler.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (value) => {
        try {
          const url = new URL(value);
          return Boolean(url.hostname) && url.protocol.startsWith('postgres');
        } catch {
          return false;
        }
      },
      'DATABASE_URL is not a valid postgres:// URL. If the password contains ' +
        '@ : / ? # [ ] or a space it must be percent-encoded (@ becomes %40), ' +
        'or the URL will be parsed with the wrong host.',
    ),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_INITIAL_PASSWORD: z.string().min(8).optional(),

  UPLOAD_DIR: z.string().default('./uploads'),
  // Separate limits: a photograph that needs more than a few megabytes has
  // not been sized for the web, while a scanned PDF legitimately runs large.
  // One shared limit would have to be the looser of the two.
  MAX_IMAGE_MB: z.coerce.number().int().positive().default(3),
  MAX_DOCUMENT_MB: z.coerce.number().int().positive().default(10),

  REVALIDATE_SECRET: z.string().optional(),
  WEB_INTERNAL_URL: z.string().url().default('http://web:3000'),

  DEFAULT_LOCALE: z.string().default('sr'),
  SUPPORTED_LOCALES: z.string().default('sr,en'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
