import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link, redirect } from "@/i18n/navigation";
import ParallaxCover from "@/components/gallery/ParallaxCover";
import Icon from "@/components/ui/AppIcon";
import AlbumGallery from "@/components/gallery/AlbumGallery";
import { getAlbum, mediaUrl } from "@/lib/api/public";
import type { Locale } from "@teamenergo/shared";

/**
 * One album.
 *
 * Addressed by a per-language slug like the rest of the site, so the language
 * switcher lands on /en/galerija/<english-slug>. The API resolves a slug in
 * either language and this redirects to the canonical one.
 */


/**
 * No generateStaticParams — deliberately.
 *
 * There was one, and it fetched the list of slugs so each detail page could be
 * prerendered. It cannot work in this deployment: the API is a separate
 * container that does not exist during `docker compose build`, so the fetch
 * always failed and the function always returned an empty array.
 *
 * An empty array is not harmless. Next still treats the route as statically
 * generated, and serves each request by REGENERATING it — the error context
 * reads `revalidateReason: "stale"`. That regeneration runs in a static
 * rendering context, where the root layout's getLocale() has to fall back to
 * reading request headers, which throws DYNAMIC_SERVER_USAGE. The visitor gets
 * a 500 and the log shows only a digest, because the failure happens inside
 * Next before any application code runs — no layout or page ever executes,
 * which is what makes it so hard to place.
 *
 * With no generateStaticParams the route is plainly dynamic (`ƒ` in the build
 * output), renders per request, and works. Note that `export const dynamic =
 * "force-dynamic"` does NOT substitute for this: the ISR path is chosen from
 * the presence of generateStaticParams, before that setting is consulted.
 */
async function load(locale: string, slug: string) {
  if (!hasLocale(routing.locales, locale)) return null;
  return getAlbum(decodeURIComponent(slug), locale as Locale).catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const album = await load(locale, slug);
  if (!album) return {};
  return {
    title: album.title,
    ...(album.description ? { description: album.description } : {}),
  };
}

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const album = await load(locale, slug);
  if (!album) notFound();

  if (album.slug && album.slug !== decodeURIComponent(slug)) {
    redirect({ href: `/galerija/${album.slug}`, locale });
  }

  // The grid shows every photo, the cover included. When the photos were
  // full-width the repeat read as a duplicate and the cover was filtered out —
  // but that left the count disagreeing with what was on screen, and at
  // thumbnail size a complete album is what the page is for.
  const cover = mediaUrl(album.coverImage);

  return (
    <article className="pb-24">
      {/* `isolate` makes this header its own stacking context, so the layers
          below stack against each other and not against the page.
          Without it the background image needed a negative z-index to sit
          under the text — and a negative z-index escapes any ancestor that
          is not itself a stacking context, so it landed behind the layout's
          own background and the cover was simply invisible. */}
      <header className="relative isolate pt-36 pb-16 px-6 overflow-hidden">
        {cover && (
          <>
            <ParallaxCover src={cover} alt={album.coverImage?.alt ?? album.title} />
            <div
              className="absolute inset-0 z-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(11,15,20,0.72) 0%, rgba(11,15,20,0.62) 45%, #0B0F14 100%)",
              }}
            />
          </>
        )}

        <div className="max-w-5xl mx-auto space-y-5 relative z-10">
          <Link
            href="/galerija"
            className="inline-flex items-center gap-2 text-sm font-bold text-ts-muted hover:text-ts-fg transition-colors">
            <Icon name="ArrowLeftIcon" size={14} />
            Galerija
          </Link>

          <h1 className="font-display text-[clamp(2rem,5vw,3.5rem)] font-black text-ts-fg leading-tight tracking-tight">
            {album.title}
          </h1>

          {album.description && (
            <p className="text-ts-muted leading-relaxed max-w-2xl">{album.description}</p>
          )}

          <p className="text-xs font-bold text-ts-muted uppercase tracking-widest">
            {album.items.length} {album.items.length === 1 ? "fotografija" : "fotografija"}
          </p>
        </div>
      </header>

      {album.items.length === 0 ? (
        <p className="max-w-5xl mx-auto px-6 text-sm text-ts-muted">
          Album još nema fotografije.
        </p>
      ) : (
        <AlbumGallery items={album.items} />
      )}
    </article>
  );
}
