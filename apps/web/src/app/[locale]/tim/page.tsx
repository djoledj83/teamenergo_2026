import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import PageHero from "@/components/PageHero";
import PageBlocks from "@/components/PageBlocks";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { Link } from "@/i18n/navigation";
import { getPage, getTeam, mediaUrl, type TeamMemberEntry } from "@/lib/api/public";
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
  const page = await getPage("team", locale as Locale).catch(() => null);
  if (!page?.meta) return {};
  return {
    title: page.meta.seoTitle ?? page.meta.title,
    ...(page.meta.seoDescription ? { description: page.meta.seoDescription } : {}),
  };
}

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [page, team] = await Promise.all([
    getPage("team", locale as Locale).catch(() => null),
    getTeam(locale as Locale)
      .then((data) => data.items)
      .catch((error: unknown) => {
        console.error("[tim] could not load the team from the API:", error);
        return [] as TeamMemberEntry[];
      }),
  ]);

  return (
    <>
      <PageHero title={page?.meta?.title ?? "Tim"} iconName="UserGroupIcon" />
      <PageBlocks blocks={page?.blocks ?? []} />

      {team.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((member) => (
              <Member key={member.id} member={member} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

const CARD_CLASS =
  "block overflow-hidden bg-ts-surface border border-ts-border rounded-3xl";

function Member({ member }: { member: TeamMemberEntry }) {
  const body = <MemberBody member={member} />;

  // A member whose slug has not been backfilled yet has no page to open, so
  // the card stays a plain card rather than a link to a 404.
  if (!member.slug) return <article className={CARD_CLASS}>{body}</article>;

  return (
    <Link
      href={`/tim/${member.slug}`}
      className={`group ${CARD_CLASS} hover:border-ts-red/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red`}>
      {body}
    </Link>
  );
}

function MemberBody({ member }: { member: TeamMemberEntry }) {
  const photo = mediaUrl(member.photo);

  return (
    <>
      {photo && (
        <div className="relative aspect-[4/5]">
          <AppImage
            src={photo}
            alt={member.photo?.alt ?? member.name}
            fill
            className="object-cover object-top w-full h-full" />
        </div>
      )}

      <div className="p-6 space-y-2">
        <h2 className="font-display text-lg font-bold text-ts-fg">{member.name}</h2>
        {member.role && <p className="text-sm text-ts-red font-semibold">{member.role}</p>}
        {member.bio && <p className="text-sm text-ts-muted leading-relaxed">{member.bio}</p>}

        {(member.email || member.linkedinUrl) && (
          <div className="flex items-center gap-3 pt-2 text-ts-muted">
            {member.email && <Icon name="EnvelopeIcon" size={15} />}
            {member.linkedinUrl && <Icon name="GlobeAltIcon" size={15} />}
          </div>
        )}
      </div>
    </>
  );
}
