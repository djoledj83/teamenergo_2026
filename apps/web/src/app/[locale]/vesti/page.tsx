import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import PageHero from "@/components/PageHero";
import PageBlocks from "@/components/PageBlocks";
import PostCard from "@/components/news/PostCard";
import { getPage, getPosts, type PostSummary } from "@/lib/api/public";
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
            {posts.map((post) => (
              <PostCard key={post.id} post={post} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
