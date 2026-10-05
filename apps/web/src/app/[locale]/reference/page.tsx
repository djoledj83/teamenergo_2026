import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import PageHero from "@/components/PageHero";
import PageBlocks from "@/components/PageBlocks";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { getPage, getProjects, mediaUrl, type ProjectSummary } from "@/lib/api/public";
import type { Locale } from "@teamenergo/shared";
import { seoMetadata } from "@/lib/seo";

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
  const page = await getPage("projects", locale as Locale).catch(() => null);
  if (!page?.meta) return {};
  return seoMetadata(page.meta, { title: page.meta.title });
}

export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [page, projects] = await Promise.all([
    getPage("projects", locale as Locale).catch(() => null),
    getProjects(locale as Locale, { pageSize: 50 })
      .then((data) => data.items)
      .catch((error: unknown) => {
        console.error("[reference] could not load projects from the API:", error);
        return [] as ProjectSummary[];
      }),
  ]);

  return (
    <>
      <PageHero title={page?.meta?.title ?? "Reference"} iconName="MapPinIcon"
        lead={page?.meta?.intro}
      />
      <PageBlocks blocks={page?.blocks ?? []} />

      {projects.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto space-y-8">
            {projects.map((project, index) => (
              <ProjectCard key={project.id} project={project} reverse={index % 2 !== 0} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ProjectCard({ project, reverse }: { project: ProjectSummary; reverse: boolean }) {
  const image = mediaUrl(project.coverImage);

  return (
    <Link
      href={`/reference/${project.slug}`}
      className="group block bg-ts-surface border border-ts-border rounded-[32px] overflow-hidden hover:border-ts-red/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red">
      <div className={`flex flex-col ${reverse ? "lg:flex-row-reverse" : "lg:flex-row"}`}>
        {image && (
          <div className="lg:w-[45%] h-64 lg:h-auto flex-shrink-0 relative">
            <AppImage
              src={image}
              alt={project.coverImage?.alt ?? project.title}
              fill
              className="object-cover w-full h-full" />
          </div>
        )}

        <div className="flex-1 p-8 lg:p-12 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            {(project.location || project.year) && (
              <div className="flex items-center gap-2 text-ts-muted text-sm">
                <Icon name="MapPinIcon" size={14} />
                <span>{[project.location, project.year].filter(Boolean).join(" · ")}</span>
              </div>
            )}
            <h2 className="font-display text-2xl lg:text-3xl font-bold text-ts-fg leading-tight">
              {project.title}
            </h2>
            {/* Three lines on the card, the whole summary on the project's
                own page — the same cut the service, news and team cards use. */}
            {project.summary && (
              <p className="text-ts-muted leading-relaxed line-clamp-3">{project.summary}</p>
            )}
          </div>

          {project.metrics.length > 0 && (
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-ts-border">
              {project.metrics.map((metric) => (
                <div key={metric.id}>
                  <p className="font-display text-xl font-black text-ts-fg">{metric.value}</p>
                  <p className="text-[10px] text-ts-muted font-semibold uppercase tracking-wider mt-0.5">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
