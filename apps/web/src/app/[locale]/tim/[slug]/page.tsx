import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link, redirect } from "@/i18n/navigation";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { getTeamMember, mediaUrl } from "@/lib/api/public";
import type { Locale } from "@teamenergo/shared";

/**
 * One team member.
 *
 * Addressed by a per-language slug, like services and projects, so the
 * language switcher lands on /en/tim/<english-slug>. The API resolves a slug
 * in either language and this redirects to the canonical one.
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
  return getTeamMember(decodeURIComponent(slug), locale as Locale).catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const member = await load(locale, slug);
  if (!member) return {};
  return {
    title: member.name,
    ...(member.role ? { description: `${member.name} — ${member.role}` } : {}),
  };
}

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const member = await load(locale, slug);
  if (!member) notFound();

  if (member.slug && member.slug !== decodeURIComponent(slug)) {
    redirect({ href: `/tim/${member.slug}`, locale });
  }

  const photo = mediaUrl(member.photo);

  return (
    <article className="pt-36 pb-24 px-6">
      <div className="max-w-5xl mx-auto space-y-10">
        <Link
          href="/tim"
          className="inline-flex items-center gap-2 text-sm font-bold text-ts-muted hover:text-ts-fg transition-colors">
          <Icon name="ArrowLeftIcon" size={14} />
          Tim
        </Link>

        <div className={`grid gap-10 ${photo ? "md:grid-cols-[minmax(0,18rem)_1fr]" : ""} items-start`}>
          {photo && (
            <div className="relative aspect-[4/5] rounded-[28px] overflow-hidden">
              <AppImage
                src={photo}
                alt={member.photo?.alt ?? member.name}
                fill
                priority
                className="object-cover object-top w-full h-full" />
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-black text-ts-fg leading-tight tracking-tight">
                {member.name}
              </h1>
              {member.role && <p className="text-lg text-ts-red font-semibold">{member.role}</p>}
            </div>

            {member.bio && (
              <p className="text-ts-muted leading-relaxed whitespace-pre-line">{member.bio}</p>
            )}

            {(member.email || member.phone || member.linkedinUrl) && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {member.email && (
                  <a
                    href={`mailto:${member.email}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-ts-border text-sm font-semibold text-ts-muted hover:text-ts-fg hover:border-ts-red transition-all">
                    <Icon name="EnvelopeIcon" size={15} />
                    {member.email}
                  </a>
                )}
                {member.phone && (
                  <a
                    href={`tel:${member.phone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-ts-border text-sm font-semibold text-ts-muted hover:text-ts-fg hover:border-ts-red transition-all">
                    <Icon name="PhoneIcon" size={15} />
                    {member.phone}
                  </a>
                )}
                {member.linkedinUrl && (
                  <a
                    href={member.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-ts-border text-sm font-semibold text-ts-muted hover:text-ts-fg hover:border-ts-red transition-all">
                    <Icon name="GlobeAltIcon" size={15} />
                    LinkedIn
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
