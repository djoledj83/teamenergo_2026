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

  // The API already returns management first, so a single partition keeps
  // both groups in their configured order.
  const management = team.filter((member) => member.isManagement);
  const others = team.filter((member) => !member.isManagement);

  return (
    <>
      <PageHero title={page?.meta?.title ?? "Tim"} iconName="UserGroupIcon"
        lead={page?.meta?.intro}
      />
      <PageBlocks blocks={page?.blocks ?? []} />

      {team.length > 0 && (
        <section className="py-16 px-6 space-y-14">
          {management.length > 0 && (
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Headings only when there are two groups to tell apart. With
                  nobody marked as management the page is one plain grid, as
                  it was. */}
              {others.length > 0 && <GroupHeading>Rukovodstvo</GroupHeading>}
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 gap-6 ${
                  MANAGEMENT_COLUMNS[management.length] ?? "lg:grid-cols-3"
                }`}>
                {management.map((member) => (
                  <Member key={member.id} member={member} />
                ))}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div className="max-w-7xl mx-auto space-y-6">
              {management.length > 0 && <GroupHeading>Tim</GroupHeading>}
              {/* Four across on a wide screen rather than three, which makes
                  each card — and so each photo, since its height follows the
                  width through the aspect ratio — about a quarter smaller. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {others.map((member) => (
                  <Member key={member.id} member={member} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

/**
 * How many columns the management row uses: one per person, so three managers
 * fill the row and each card is wider than the four-across grid below.
 *
 * A lookup rather than an interpolated class name — Tailwind scans source
 * text for complete class names, so `lg:grid-cols-${n}` compiles to nothing
 * and the row silently collapses to one column.
 *
 * A lone manager is capped instead of being stretched across 1280px, which
 * would make the photo taller than the viewport. Past four the row falls back
 * to three columns rather than four: wrapping at four would make the cards
 * exactly the size of the team grid below and lose the distinction the row
 * exists to make.
 */
const MANAGEMENT_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1 lg:max-w-sm",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-sm font-bold text-ts-muted uppercase tracking-widest">
      {children}
    </h2>
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
        {member.bio && (
          // Three lines on the card, the whole bio on the member's own page.
          // Cards sit in a grid, so one long biography would otherwise stretch
          // its whole row and leave the others with dead space beneath them.
          <p className="text-sm text-ts-muted leading-relaxed line-clamp-3">{member.bio}</p>
        )}

        {(member.email || member.phone || member.linkedinUrl) && (
          <div className="flex items-center gap-3 pt-2 text-ts-muted">
            {member.email && <Icon name="EnvelopeIcon" size={15} />}
            {member.phone && <Icon name="PhoneIcon" size={15} />}
            {member.linkedinUrl && <Icon name="GlobeAltIcon" size={15} />}
          </div>
        )}
      </div>
    </>
  );
}
