import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link, redirect } from "@/i18n/navigation";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { getService, getServices, mediaUrl, type ServiceSummary } from "@/lib/api/public";
import type { Locale } from "@teamenergo/shared";

/**
 * A single service.
 *
 * Slugs are per-language, so /en/usluge/energetika is a URL the language
 * switcher will produce even though "energetika" is the Serbian slug. The API
 * looks an entity up by its slug in ANY language and returns the requested
 * language's translation, so the page can recognise that case: when the
 * returned slug differs from the one in the URL, it redirects to the
 * canonical one. The alternative — serving the same content under both — is
 * what search engines treat as duplicate content.
 */

export async function generateStaticParams() {
  const params: Array<{ locale: string; slug: string }> = [];
  for (const locale of routing.locales) {
    // A build with no API reachable produces no static params; the pages are
    // then rendered on demand instead, which is the correct fallback rather
    // than a failed build.
    const { items } = await getServices(locale).catch(() => ({ items: [] as ServiceSummary[] }));
    for (const service of items) params.push({ locale, slug: service.slug });
  }
  return params;
}

async function load(locale: string, slug: string) {
  if (!hasLocale(routing.locales, locale)) return null;
  return getService(decodeURIComponent(slug), locale as Locale).catch((error: unknown) => {
    console.error("[usluga] could not load the service from the API:", error);
    return null;
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const service = await load(locale, slug);
  if (!service) return {};
  return {
    title: service.title,
    ...(service.summary ? { description: service.summary } : {}),
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const service = await load(locale, slug);
  if (!service) notFound();

  // Reached through the language switcher with the other language's slug.
  if (service.slug !== decodeURIComponent(slug)) {
    redirect({ href: `/usluge/${service.slug}`, locale });
  }

  const t = await getTranslations("home");
  const accent = service.accent === "amber" ? "amber" : "blue";
  const image = mediaUrl(service.image);

  return (
    <article>
      <section className="pt-36 pb-12 px-6 border-b border-ts-border">
        <div className="max-w-7xl mx-auto space-y-5">
          <Link
            href="/usluge"
            className="inline-flex items-center gap-2 text-sm font-bold text-ts-muted hover:text-ts-fg transition-colors">
            <Icon name="ArrowLeftIcon" size={14} />
            {t("servicesEyebrow")}
          </Link>

          <div className="flex items-start justify-between gap-6">
            <div className="space-y-4">
              {service.category && (
                <span
                  className={`inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                    accent === "amber"
                      ? "bg-amber-500/10 text-ts-red"
                      : "bg-blue-500/10 text-ts-blue"
                  }`}>
                  {service.category}
                </span>
              )}
              <h1 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-black text-ts-fg leading-tight tracking-tight">
                {service.title}
              </h1>
              {service.summary && (
                <p className="text-ts-muted max-w-2xl leading-relaxed text-lg font-light">
                  {service.summary}
                </p>
              )}
            </div>

            {service.iconName && (
              <div
                className={`hidden sm:flex w-16 h-16 rounded-2xl items-center justify-center flex-shrink-0 ${
                  accent === "amber"
                    ? "bg-amber-500/15 text-ts-red"
                    : "bg-blue-500/15 text-ts-blue"
                }`}>
                <Icon name={service.iconName} size={30} />
              </div>
            )}
          </div>
        </div>
      </section>

      {image && (
        <section className="px-6 pt-12">
          <div className="max-w-7xl mx-auto">
            <div className="relative h-[clamp(14rem,40vw,28rem)] rounded-[32px] overflow-hidden">
              <AppImage
                src={image}
                alt={service.image?.alt ?? service.title}
                fill
                priority
                className="object-cover w-full h-full" />
            </div>
            {service.image?.caption && (
              <p className="text-xs text-ts-muted mt-3">{service.image.caption}</p>
            )}
          </div>
        </section>
      )}

      {service.stats.length > 0 && (
        <section className="px-6 pt-12">
          <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
            {service.stats.map((stat) => (
              <div
                key={stat.id}
                className="p-6 bg-ts-surface border border-ts-border rounded-3xl">
                <p className="font-display text-3xl font-black text-ts-fg">{stat.value}</p>
                <p className="text-[10px] text-ts-muted font-semibold uppercase tracking-wider mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {service.body && (
        <section className="px-6 py-16">
          <div className="max-w-3xl mx-auto">
            {/* Body is HTML from the admin's rich-text editor. The API
                sanitises it on write (see apps/api/src/content/rich-text.ts),
                so what is stored is already safe to inject here. */}
            <div
              className="prose prose-invert prose-headings:font-display prose-headings:font-bold prose-a:text-ts-red max-w-none"
              dangerouslySetInnerHTML={{ __html: service.body }} />
          </div>
        </section>
      )}

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto bg-ts-surface border border-ts-border rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-ts-fg">{t("statsCtaHeading")}</h2>
            <p className="text-ts-muted mt-1">{t("statsCtaBody")}</p>
          </div>
          <Link
            href="/kontakt"
            className="flex-shrink-0 bg-ts-red text-black px-8 py-4 rounded-full font-bold text-sm hover:bg-amber-400 transition-all hover:scale-105 whitespace-nowrap">
            {t("statsCtaButton")}
          </Link>
        </div>
      </section>
    </article>
  );
}
