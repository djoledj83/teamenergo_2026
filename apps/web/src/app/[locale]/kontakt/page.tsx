import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import PageHero from "@/components/PageHero";
import PageBlocks from "@/components/PageBlocks";
import ContactSection from "@/components/home/ContactSection";
import {
  getBootstrap,
  getPage,
  getServices,
  type Bootstrap,
  type ServiceSummary,
} from "@/lib/api/public";
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
  const page = await getPage("contact", locale as Locale).catch(() => null);
  if (!page?.meta) return {};
  return {
    title: page.meta.seoTitle ?? page.meta.title,
    ...(page.meta.seoDescription ? { description: page.meta.seoDescription } : {}),
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [page, bootstrap, services] = await Promise.all([
    getPage("contact", locale as Locale).catch(() => null),
    getBootstrap(locale as Locale).catch(
      (): Bootstrap => ({ locales: [], nav: [], settings: {} }),
    ),
    getServices(locale as Locale)
      .then((data) => data.items)
      .catch(() => [] as ServiceSummary[]),
  ]);

  return (
    <>
      <PageHero title={page?.meta?.title ?? "Kontakt"} iconName="EnvelopeIcon" />
      <PageBlocks blocks={page?.blocks ?? []} />

      {/* The form brings the contact details with it, so they are not
          repeated above it. */}
      <ContactSection services={services} settings={bootstrap.settings} />
    </>
  );
}
