import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link, redirect } from "@/i18n/navigation";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import RichText from "@/components/RichText";
import { getSiteDocument, mediaUrl } from "@/lib/api/public";
import { downloadFor } from "@/lib/download";
import type { Locale } from "@teamenergo/shared";
import { seoMetadata } from "@/lib/seo";

/**
 * No generateStaticParams — deliberately, and for the reason set out at
 * length in reference/[slug]/page.tsx: the API does not exist during
 * `docker compose build`, so the fetch returns nothing, Next still treats the
 * route as statically generated, and every request is served by regenerating
 * it in a static rendering context — which throws DYNAMIC_SERVER_USAGE and
 * hands the visitor a 500 with only a digest in the log.
 */

async function load(locale: string, slug: string) {
  if (!hasLocale(routing.locales, locale)) return null;
  return getSiteDocument(decodeURIComponent(slug), locale as Locale).catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const document = await load(locale, slug);
  if (!document) return {};
  return seoMetadata(document, {
    title: document.label,
    description: document.description,
  });
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const document = await load(locale, slug);
  if (!document) notFound();

  // Slugs are per-language, so arriving on the Serbian slug of a document
  // while reading English lands on a page whose copy is English and whose
  // address is not. Redirect to this language's own slug.
  if (document.slug !== decodeURIComponent(slug)) {
    redirect({ href: `/sertifikati/${document.slug}`, locale });
  }

  const logo = mediaUrl(document.logo);
  const file = downloadFor(document);

  return (
    <article>
      <section className="pt-36 pb-12 px-6 border-b border-ts-border">
        <div className="max-w-7xl mx-auto space-y-5">
          <Link
            href="/sertifikati"
            className="inline-flex items-center gap-2 text-sm font-bold text-ts-muted hover:text-ts-fg transition-colors">
            <Icon name="ArrowLeftIcon" size={14} />
            Dokumenti i sertifikati
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center gap-8">
            {/* On a light panel: these marks are drawn for white paper and
                disappear into the page's own background. */}
            {logo && (
              <div className="relative w-32 h-32 flex-shrink-0 rounded-2xl bg-white/95 p-4">
                <AppImage
                  src={logo}
                  alt={document.logo?.alt ?? document.label}
                  fill
                  sizes="8rem"
                  priority
                  className="object-contain p-2" />
              </div>
            )}

            <div className="space-y-4 min-w-0">
              <h1 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] font-black text-ts-fg leading-tight tracking-tight">
                {document.label}
              </h1>
              {document.description && (
                <p className="text-ts-muted leading-relaxed text-lg font-light">
                  {document.description}
                </p>
              )}

              {file && (
                <a
                  href={file.href}
                  className="inline-flex items-center gap-2.5 bg-ts-red text-black font-bold text-sm rounded-full pl-5 pr-6 py-3 hover:gap-3.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red focus-visible:ring-offset-2 focus-visible:ring-offset-ts-bg">
                  <Icon name="ArrowDownTrayIcon" size={16} />
                  Preuzmite dokument
                  <span className="text-[11px] font-bold opacity-70 uppercase tracking-wider">
                    {file.extension}
                    {file.size ? ` · ${file.size}` : ""}
                  </span>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {document.body && (
        <section className="px-6 py-16">
          <div className="max-w-7xl mx-auto">
            <RichText html={document.body} />
          </div>
        </section>
      )}
    </article>
  );
}
