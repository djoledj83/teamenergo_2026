import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getBootstrap, type Bootstrap } from '@/lib/api/public';
import type { Locale } from '@teamenergo/shared';

/**
 * Public-site shell.
 *
 * The navigation and settings behind the header and footer are the same on
 * every page, so they are fetched here once rather than in each page. The
 * request is cached and tagged, so this costs one API call per language per
 * revalidation window no matter how many pages are visited.
 *
 * `setRequestLocale` is what allows these pages to be statically rendered:
 * without it every page that reads a translation becomes dynamic, because
 * next-intl would have to look at the incoming request to know the language.
 */

const EMPTY_BOOTSTRAP: Bootstrap = { locales: [], nav: [], settings: {}, documents: [] };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // A URL like /de/usluge reaches this layout with an unsupported locale;
  // 404 rather than silently serving Serbian under a German prefix.
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  // The chrome must not take the page down with it when the API is
  // unreachable: a site that renders without its navigation is better than
  // a 500.
  const bootstrap = await getBootstrap(locale as Locale).catch((error: unknown) => {
    console.error('[layout] could not load navigation from the API:', error);
    return EMPTY_BOOTSTRAP;
  });

  return (
    <NextIntlClientProvider>
      <div className="bg-ts-bg text-ts-fg min-h-screen flex flex-col">
        <Header nav={bootstrap.nav} locales={bootstrap.locales} />
        <main className="flex-1">{children}</main>
        <Footer
          nav={bootstrap.nav}
          settings={bootstrap.settings}
          documents={bootstrap.documents}
        />
      </div>
    </NextIntlClientProvider>
  );
}
