import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link, redirect } from "@/i18n/navigation";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { getTeam, getTeamMember, mediaUrl, type TeamMemberEntry } from "@/lib/api/public";
import type { Locale } from "@teamenergo/shared";

/**
 * One team member.
 *
 * Addressed by a per-language slug, like services and projects, so the
 * language switcher lands on /en/tim/<english-slug>. The API resolves a slug
 * in either language and this redirects to the canonical one.
 */

export async function generateStaticParams() {
  const params: Array<{ locale: string; slug: string }> = [];
  for (const locale of routing.locales) {
    const { items } = await getTeam(locale).catch(() => ({ items: [] as TeamMemberEntry[] }));
    for (const member of items) {
      if (member.slug) params.push({ locale, slug: member.slug });
    }
  }
  return params;
}

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

            {(member.email || member.linkedinUrl) && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {member.email && (
                  <a
                    href={`mailto:${member.email}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-ts-border text-sm font-semibold text-ts-muted hover:text-ts-fg hover:border-ts-red transition-all">
                    <Icon name="EnvelopeIcon" size={15} />
                    {member.email}
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
