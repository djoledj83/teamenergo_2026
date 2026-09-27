import React from 'react';
import type { Metadata, Viewport } from 'next';
import { getLocale } from 'next-intl/server';
import '../styles/index.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B0F14',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Teamenergo',
    template: '%s | Teamenergo',
  },
  description:
    'Teamenergo — telekomunikacije, energetika, obnovljivi izvori energije i sistemi tehničke zaštite.',
  // Icons are NOT declared here. Next's app-directory file conventions own
  // them — favicon.ico, icon.png and apple-icon.png sit next to this file and
  // are emitted automatically. Declaring them here as well produced a second
  // set of <link> tags, and app/favicon.ico silently won regardless, which is
  // why the tab kept showing the old mark.
};

/**
 * The single root layout, shared by the public site and the admin panel.
 *
 * Two root layouts via route groups would let each own its <html>, but it
 * would also mean moving every admin route and losing the top-level
 * not-found. Reading the locale here instead keeps that structure intact:
 * getLocale() resolves from the URL on public routes and falls back to the
 * default on /admin, which is Serbian-only anyway.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    // suppressHydrationWarning covers attributes that browser extensions
    // inject into <body> before React hydrates (ColorZilla's
    // cz-shortcut-listen, password managers, form fillers). Those are not
    // our markup and there is nothing to fix in the app, but without this
    // React reports a mismatch on every page load in development. It applies
    // one level deep only, so genuine mismatches inside the tree still
    // surface normally.
    <html lang={locale} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
