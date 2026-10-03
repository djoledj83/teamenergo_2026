import { Link } from "@/i18n/navigation";
import AppImage from "@/components/ui/AppImage";
import { mediaUrl, type PostSummary } from "@/lib/api/public";

/**
 * One article, as a card.
 *
 * Shared by the news listing and the homepage carousel. The two had the same
 * markup written twice, which is how a card ends up looking subtly different
 * on the page that matters most.
 *
 * A server component: it renders no interactive state, and keeping it off the
 * client bundle matters on the homepage, where it appears eight times.
 */

export function formatPostDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "sr-RS", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function PostCard({
  post,
  locale,
  className = "",
}: {
  post: PostSummary;
  locale: string;
  className?: string;
}) {
  const cover = mediaUrl(post.coverImage);

  return (
    <Link
      href={`/vesti/${post.slug}`}
      className={`group bg-ts-surface border border-ts-border rounded-3xl overflow-hidden hover:border-ts-red/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red ${className}`}>
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
          <p className="text-xs text-ts-muted">{formatPostDate(post.publishedAt, locale)}</p>
        )}
        <h3 className="font-display text-lg font-bold text-ts-fg leading-snug line-clamp-2">
          {post.title}
        </h3>
        {post.excerpt && (
          // Three lines, like the service and team cards: in a row of cards
          // one long excerpt would otherwise set the height for all of them.
          <p className="text-sm text-ts-muted leading-relaxed line-clamp-3">{post.excerpt}</p>
        )}
      </div>
    </Link>
  );
}
