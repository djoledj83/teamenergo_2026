import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import PageHero from "@/components/PageHero";
import PageBlocks from "@/components/PageBlocks";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { getPage, getServices, mediaUrl, type ServiceSummary } from "@/lib/api/public";
import type { Locale } from "@teamenergo/shared";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const page = await getPage("services", locale as Locale).catch(() => null);
  if (page?.meta) {
    return {
      title: page.meta.seoTitle ?? page.meta.title,
      ...(page.meta.seoDescription ? { description: page.meta.seoDescription } : {}),
    };
  }
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: t("servicesEyebrow") };
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("home");

  // This page is the odd one out among the listing pages: tim, vesti,
  // reference and galerija all read their editable page row, and this one did
  // not — so the "Usluge" page in the admin, its title, its SEO fields and any
  // block added to it were edited and then rendered nowhere at all.
  const [page, { items: services }] = await Promise.all([
    getPage("services", locale as Locale).catch(() => null),
    getServices(locale as Locale).catch((error: unknown) => {
      console.error("[usluge] could not load services from the API:", error);
      return { items: [] as ServiceSummary[] };
    }),
  ]);

  return (
    <>
      <PageHero
        eyebrow={t("servicesEyebrow")}
        title={page?.meta?.title ?? t("servicesHeading")}
        {...(page?.meta?.title ? {} : { accent: t("servicesHeadingAccent") })}
        iconName="WrenchScrewdriverIcon"
        lead={page?.meta?.intro}
      />
      <PageBlocks blocks={page?.blocks ?? []} />

      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          {services.length === 0 ? (
            <p className="text-ts-muted">—</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function ServiceCard({ service }: { service: ServiceSummary }) {
  const accent = service.accent === "amber" ? "amber" : "blue";
  const image = mediaUrl(service.image);

  return (
    <Link
      href={`/usluge/${service.slug}`}
      className="service-card group flex flex-col h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red rounded-2xl">
      {image && (
        <div className="project-img-wrap flex-shrink-0 h-52 m-4 mb-0 rounded-xl overflow-hidden">
          <AppImage
            src={image}
            alt={service.image?.alt ?? service.title}
            fill
            className="object-cover w-full h-full" />
        </div>
      )}

      <div className="p-6 flex flex-col justify-between flex-1">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            {service.category ? (
              <span
                className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                  accent === "amber" ? "bg-amber-500/10 text-ts-red" : "bg-blue-500/10 text-ts-blue"
                }`}>
                {service.category}
              </span>
            ) : (
              <span />
            )}
            {service.iconName && (
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  accent === "amber" ? "bg-amber-500/15 text-ts-red" : "bg-blue-500/15 text-ts-blue"
                }`}>
                <Icon name={service.iconName} size={18} />
              </div>
            )}
          </div>

          <h2 className="font-display text-xl font-bold text-ts-fg leading-tight">
            {service.title}
          </h2>
          {service.summary && (
            // Three lines on the card, the whole summary on the service's own
            // page — the same cut the home page and the team cards use. These
            // sit in a grid, so one long summary stretched its entire row and
            // left the cards beside it with dead space under their text.
            <p className="text-ts-muted text-sm leading-relaxed line-clamp-3">
              {service.summary}
            </p>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-ts-border flex items-center justify-between">
          <div className="flex gap-6">
            {service.stats.map((s) => (
              <div key={s.id}>
                <p className="font-display text-lg font-black text-ts-fg">{s.value}</p>
                <p className="text-[10px] text-ts-muted font-semibold uppercase tracking-wider">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
          <div className="w-9 h-9 rounded-full border border-ts-border flex items-center justify-center text-ts-muted group-hover:bg-ts-red group-hover:border-ts-red group-hover:text-black transition-all">
            <Icon name="ArrowRightIcon" size={14} />
          </div>
        </div>
      </div>
    </Link>
  );
}
