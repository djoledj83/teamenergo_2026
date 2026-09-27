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
import { getAlbums, getPage, mediaUrl, type AlbumSummary } from "@/lib/api/public";
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
  const page = await getPage("gallery", locale as Locale).catch(() => null);
  if (!page?.meta) return {};
  return {
    title: page.meta.seoTitle ?? page.meta.title,
    ...(page.meta.seoDescription ? { description: page.meta.seoDescription } : {}),
  };
}

export default async function GalleryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [page, albums] = await Promise.all([
    getPage("gallery", locale as Locale).catch(() => null),
    getAlbums(locale as Locale)
      .then((data) => data.items)
      .catch((error: unknown) => {
        console.error("[galerija] could not load albums from the API:", error);
        return [] as AlbumSummary[];
      }),
  ]);

  return (
    <>
      <PageHero title={page?.meta?.title ?? "Galerija"} iconName="PhotoIcon" />
      <PageBlocks blocks={page?.blocks ?? []} />

      {albums.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {albums.map((album) => {
              const cover = mediaUrl(album.coverImage);
              return (
                <Link
                  key={album.id}
                  href={`/galerija/${album.slug}`}
                  className="group block bg-ts-surface border border-ts-border rounded-3xl overflow-hidden hover:border-ts-red transition-colors">
                  {cover && (
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <AppImage
                        src={cover}
                        alt={album.coverImage?.alt ?? album.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 24rem"
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-[1.04]" />
                    </div>
                  )}
                  <div className="p-6 space-y-1">
                    <h2 className="font-display text-lg font-bold text-ts-fg group-hover:text-ts-red transition-colors">
                      {album.title}
                    </h2>
                    {album.description && (
                      <p className="text-sm text-ts-muted leading-relaxed">{album.description}</p>
                    )}
                    <p className="flex items-center gap-1.5 text-xs text-ts-muted pt-1">
                      <Icon name="PhotoIcon" size={13} />
                      {album.itemCount} {album.itemCount === 1 ? "fotografija" : "fotografija"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
