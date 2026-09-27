import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link, redirect } from "@/i18n/navigation";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { getPost, getPosts, mediaUrl, type PostSummary } from "@/lib/api/public";
import type { Locale } from "@teamenergo/shared";

export async function generateStaticParams() {
  const params: Array<{ locale: string; slug: string }> = [];
  for (const locale of routing.locales) {
    const { items } = await getPosts(locale, { pageSize: 100 }).catch(() => ({
      items: [] as PostSummary[],
      total: 0,
      page: 1,
      pageSize: 100,
    }));
    for (const post of items) params.push({ locale, slug: post.slug });
  }
  return params;
}

async function load(locale: string, slug: string) {
  if (!hasLocale(routing.locales, locale)) return null;
  return getPost(decodeURIComponent(slug), locale as Locale).catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await load(locale, slug);
  if (!post) return {};
  return { title: post.title, ...(post.excerpt ? { description: post.excerpt } : {}) };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const post = await load(locale, slug);
  if (!post) notFound();

  if (post.slug !== decodeURIComponent(slug)) {
    redirect({ href: `/vesti/${post.slug}`, locale });
  }

  const cover = mediaUrl(post.coverImage);
  const published = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(locale === "en" ? "en-GB" : "sr-RS", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <article>
      <section className="pt-36 pb-10 px-6">
        <div className="max-w-3xl mx-auto space-y-5">
          <Link
            href="/vesti"
            className="inline-flex items-center gap-2 text-sm font-bold text-ts-muted hover:text-ts-fg transition-colors">
            <Icon name="ArrowLeftIcon" size={14} />
            Vesti
          </Link>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] font-black text-ts-fg leading-tight tracking-tight">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-ts-muted">
            {published && <span>{published}</span>}
            {post.authorName && <span>· {post.authorName}</span>}
            {post.categories.map((category) => (
              <span
                key={category.id}
                className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-blue-500/10 text-ts-blue">
                {category.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {cover && (
        <section className="px-6 pb-10">
          <div className="max-w-4xl mx-auto relative h-[clamp(12rem,32vw,22rem)] rounded-[28px] overflow-hidden">
            <AppImage
              src={cover}
              alt={post.coverImage?.alt ?? post.title}
              fill
              priority
              className="object-cover w-full h-full" />
          </div>
        </section>
      )}

      {post.body && (
        <section className="px-6 pb-20">
          <div className="max-w-3xl mx-auto">
            {/* Sanitised by the API on write. */}
            <div
              className="prose prose-invert prose-headings:font-display prose-a:text-ts-red max-w-none"
              dangerouslySetInnerHTML={{ __html: post.body }} />
          </div>
        </section>
      )}
    </article>
  );
}
