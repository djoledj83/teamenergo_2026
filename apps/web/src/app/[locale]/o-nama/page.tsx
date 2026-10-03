import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import PageHero from "@/components/PageHero";
import PageBlocks from "@/components/PageBlocks";
import { getPage, type PageContent } from "@/lib/api/public";
import type { Locale } from "@teamenergo/shared";

/**
 * O nama.
 *
 * Nothing on this page is written here: the heading and every section come
 * from the `about` page and its blocks, editable at /admin/pages/about.
 */

const PAGE_KEY = "about";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

async function load(locale: string): Promise<PageContent | null> {
  if (!hasLocale(routing.locales, locale)) return null;
  return getPage(PAGE_KEY, locale as Locale).catch((error: unknown) => {
    console.error("[o-nama] could not load the page from the API:", error);
    return null;
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const page = await load(locale);
  if (!page?.meta) return {};
  return {
    title: page.meta.seoTitle ?? page.meta.title,
    ...(page.meta.seoDescription ? { description: page.meta.seoDescription } : {}),
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const page = await load(locale);

  return (
    <>
      <PageHero
        title={page?.meta?.title ?? "O nama"}
        iconName="BuildingOffice2Icon"
        lead={page?.meta?.intro}
      />
      <PageBlocks blocks={page?.blocks ?? []} />
    </>
  );
}
