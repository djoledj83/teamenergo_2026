import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import PageHero from "@/components/PageHero";
import PageBlocks from "@/components/PageBlocks";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import {
  getPage,
  getSiteDocuments,
  mediaUrl,
  type SiteDocumentDetail,
} from "@/lib/api/public";
import type { Locale } from "@teamenergo/shared";
import { seoMetadata } from "@/lib/seo";

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
  const page = await getPage("documents", locale as Locale).catch(() => null);
  if (!page?.meta) return {};
  return seoMetadata(page.meta, { title: page.meta.title });
}

/**
 * Certificates and documents, each linking to its own page.
 *
 * This list exists so the document pages are reachable: a page nothing links
 * to is a page no search engine will rank, and until now a certificate was
 * only ever a badge in the footer pointing straight at a PDF.
 *
 * Documents with no slug are not here — the API leaves them out rather than
 * linking to a 404. They still appear in the footer, as they always have.
 */
export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [page, documents] = await Promise.all([
    getPage("documents", locale as Locale).catch(() => null),
    getSiteDocuments(locale as Locale)
      .then((data) => data.items)
      .catch((error: unknown) => {
        console.error("[sertifikati] could not load documents from the API:", error);
        return [] as SiteDocumentDetail[];
      }),
  ]);

  return (
    <>
      <PageHero
        title={page?.meta?.title ?? "Dokumenti i sertifikati"}
        iconName="DocumentCheckIcon"
        lead={page?.meta?.intro}
      />
      <PageBlocks blocks={page?.blocks ?? []} />

      {documents.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((document) => (
              <DocumentCard key={document.id} document={document} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function DocumentCard({ document }: { document: SiteDocumentDetail }) {
  const logo = mediaUrl(document.logo);

  return (
    <Link
      href={`/sertifikati/${document.slug}`}
      className="group flex flex-col h-full bg-ts-surface border border-ts-border rounded-3xl overflow-hidden hover:border-ts-red/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red">
      {/* The news card's image area, exactly: same ratio, same object-cover,
          no padding. The image fills the box and meets the card's own rounded
          corners.

          `cover` rather than `contain` is the whole point. Contain never
          crops, but it leaves bands wherever the image's proportions differ
          from the box — and a band of card surface around the picture is the
          dark margin this was meant to remove. Cover has no bands by
          construction; the cost is that a banner much wider than 16:10 is
          trimmed at the sides, so artwork wants its subject near the middle. */}
      {logo ? (
        <div className="relative aspect-[16/10]">
          <AppImage
            src={logo}
            alt={document.logo?.alt ?? document.label}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 24rem"
            className="object-cover w-full h-full" />
        </div>
      ) : (
        <div className="aspect-[16/10] flex items-center justify-center bg-ts-bg/40 text-ts-muted">
          <Icon name="DocumentTextIcon" size={34} />
        </div>
      )}

      <div className="p-6 flex flex-col flex-1 gap-2">
        <h2 className="font-display text-lg font-bold text-ts-fg leading-snug group-hover:text-ts-red transition-colors">
          {document.label}
        </h2>
        {document.description && (
          <p className="text-sm text-ts-muted leading-relaxed line-clamp-3">
            {document.description}
          </p>
        )}
        <span className="mt-auto pt-3 inline-flex items-center gap-1.5 text-xs font-bold text-ts-muted uppercase tracking-wider">
          Pogledajte
          <Icon name="ArrowRightIcon" size={13} className="text-ts-red" />
        </span>
      </div>
    </Link>
  );
}
