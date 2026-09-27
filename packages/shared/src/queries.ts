import { z } from 'zod';
import { DEFAULT_LOCALE, LOCALES } from './locales.js';

/** Every public endpoint is locale-scoped. */
export const localeQuerySchema = z.object({
  locale: z.enum(LOCALES).default(DEFAULT_LOCALE),
});
export type LocaleQuery = z.infer<typeof localeQuerySchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const listQuerySchema = localeQuerySchema.merge(paginationSchema);
export type ListQuery = z.infer<typeof listQuerySchema>;

export const postListQuerySchema = listQuerySchema.extend({
  category: z.string().min(1).optional(),
});
export type PostListQuery = z.infer<typeof postListQuerySchema>;

export const projectListQuerySchema = listQuerySchema.extend({
  service: z.string().min(1).optional(),
  featured: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .optional(),
});
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

/** Contact form submission. */
export const inquirySchema = z.object({
  name: z.string().min(2, 'Ime je obavezno').max(120),
  email: z.string().email('Unesite ispravnu email adresu'),
  phone: z.string().max(40).optional(),
  company: z.string().max(160).optional(),
  serviceId: z.string().min(1).optional(),
  message: z.string().min(10, 'Poruka mora imati najmanje 10 karaktera').max(5000),
  locale: z.enum(LOCALES).default(DEFAULT_LOCALE),
  /** Honeypot — real users never fill this in. */
  website: z.string().max(0).optional(),
});
export type InquiryInput = z.infer<typeof inquirySchema>;
