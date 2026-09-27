import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

/**
 * Per-request locale and UI strings.
 *
 * Only interface chrome lives in these message files — labels, buttons, empty
 * states. Everything the client edits comes from the database through the
 * public API, so the message catalogues stay small and do not need a
 * translation workflow of their own.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
