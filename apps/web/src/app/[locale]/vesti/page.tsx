import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import PageHero from "@/components/PageHero";
import PageBlocks from "@/components/PageBlocks";
import AppImage from "@/components/ui/AppImage";
import { getPage, getPosts, mediaUrl, type PostSummary } from "@/lib/api/public";
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
  const page = await getPage("news", locale as Locale).catch(() => null);
  if (!page?.meta) return {};
  return {
    title: page.meta.seoTitle ?? page.meta.title,
    ...(page.meta.seoDescription ? { description: page.meta.seoDescription } : {}),
  };
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "sr-RS", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [page, posts] = await Promise.all([
    getPage("news", locale as Locale).catch(() => null),
    getPosts(locale as Locale, { pageSize: 30 })
      .then((data) => data.items)
      .catch((error: unknown) => {
        console.error("[vesti] could not load posts from the API:", error);
        return [] as PostSummary[];
      }),
  ]);

  return (
    <>
      <PageHero title={page?.meta?.title ?? "Vesti"} iconName="NewspaperIcon" />
      <PageBlocks blocks={page?.blocks ?? []} />

      {posts.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => {
              const cover = mediaUrl(post.coverImage);
              return (
                <Link
                  key={post.id}
                  href={`/vesti/${post.slug}`}
                  className="group bg-ts-surface border border-ts-border rounded-3xl overflow-hidden hover:border-ts-red/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red">
                  {cover && (
                    <div className="relative aspect-[16/10]">
                      <AppImage
                        src={cover}
                        alt={post.coverImage?.alt ?? post.title}
                        fill
                        className="object-cover w-full h-full" />
                    </div>
                  )}
                  <div className="p-6 space-y-2">
                    {post.publishedAt && (
                      <p className="text-xs text-ts-muted">{formatDate(post.publishedAt, locale)}</p>
                    )}
                    <h2 className="font-display text-lg font-bold text-ts-fg leading-snug">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-sm text-ts-muted leading-relaxed">{post.excerpt}</p>
                    )}
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
