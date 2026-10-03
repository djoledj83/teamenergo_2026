import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link, redirect } from "@/i18n/navigation";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { getPost, mediaUrl } from "@/lib/api/public";
import type { Locale } from "@teamenergo/shared";
import RichText from "@/components/RichText";

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
            <RichText html={post.body} />
          </div>
        </section>
      )}
    </article>
  );
}
