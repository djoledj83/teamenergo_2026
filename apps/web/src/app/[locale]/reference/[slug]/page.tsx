import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link, redirect } from "@/i18n/navigation";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { getProject, getProjects, mediaUrl, type ProjectSummary } from "@/lib/api/public";
import type { Locale } from "@teamenergo/shared";

/** Slugs are per-language; see the note in usluge/[slug]/page.tsx. */

export async function generateStaticParams() {
  const params: Array<{ locale: string; slug: string }> = [];
  for (const locale of routing.locales) {
    const { items } = await getProjects(locale, { pageSize: 100 }).catch(() => ({
      items: [] as ProjectSummary[],
      total: 0,
      page: 1,
      pageSize: 100,
    }));
    for (const project of items) params.push({ locale, slug: project.slug });
  }
  return params;
}

async function load(locale: string, slug: string) {
  if (!hasLocale(routing.locales, locale)) return null;
  return getProject(decodeURIComponent(slug), locale as Locale).catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const project = await load(locale, slug);
  if (!project) return {};
  return {
    title: project.title,
    ...(project.summary ? { description: project.summary } : {}),
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const project = await load(locale, slug);
  if (!project) notFound();

  if (project.slug !== decodeURIComponent(slug)) {
    redirect({ href: `/reference/${project.slug}`, locale });
  }

  const cover = mediaUrl(project.coverImage);

  return (
    <article>
      <section className="pt-36 pb-12 px-6 border-b border-ts-border">
        <div className="max-w-7xl mx-auto space-y-5">
          <Link
            href="/reference"
            className="inline-flex items-center gap-2 text-sm font-bold text-ts-muted hover:text-ts-fg transition-colors">
            <Icon name="ArrowLeftIcon" size={14} />
            Reference
          </Link>

          {(project.location || project.year || project.tag) && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-ts-muted">
              {project.tag && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 text-ts-red">
                  {project.tag}
                </span>
              )}
              <span>{[project.location, project.year].filter(Boolean).join(" · ")}</span>
            </div>
          )}

          <h1 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-black text-ts-fg leading-tight tracking-tight">
            {project.title}
          </h1>
          {project.summary && (
            <p className="text-ts-muted max-w-2xl leading-relaxed text-lg font-light">
              {project.summary}
            </p>
          )}
        </div>
      </section>

      {cover && (
        <section className="px-6 pt-12">
          <div className="max-w-7xl mx-auto relative h-[clamp(14rem,40vw,28rem)] rounded-[32px] overflow-hidden">
            <AppImage
              src={cover}
              alt={project.coverImage?.alt ?? project.title}
              fill
              priority
              className="object-cover w-full h-full" />
          </div>
        </section>
      )}

      {project.metrics.length > 0 && (
        <section className="px-6 pt-12">
          <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
            {project.metrics.map((metric) => (
              <div key={metric.id} className="p-6 bg-ts-surface border border-ts-border rounded-3xl">
                <p className="font-display text-3xl font-black text-ts-fg">{metric.value}</p>
                <p className="text-[10px] text-ts-muted font-semibold uppercase tracking-wider mt-1">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {project.body && (
        <section className="px-6 py-16">
          <div className="max-w-3xl mx-auto">
            {/* Sanitised by the API on write. */}
            <div
              className="prose prose-invert prose-headings:font-display prose-a:text-ts-red max-w-none"
              dangerouslySetInnerHTML={{ __html: project.body }} />
          </div>
        </section>
      )}

      {project.gallery.length > 0 && (
        <section className="px-6 pb-20">
          <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-3 gap-4">
            {project.gallery.map((item) => {
              const src = mediaUrl(item);
              if (!src) return null;
              return (
                <div key={item.id} className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                  <AppImage src={src} alt={item.alt ?? project.title} fill className="object-cover w-full h-full" />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}
