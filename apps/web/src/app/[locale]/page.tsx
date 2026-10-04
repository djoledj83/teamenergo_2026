import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import HeroSection from "@/components/home/HeroSection";
import ServicesSection from "@/components/home/ServicesSection";
import NewsSection from "@/components/home/NewsSection";
import PostCard from "@/components/news/PostCard";
import VideoModal from "@/components/VideoModal";
import StatsSection from "@/components/home/StatsSection";
import ProjectsSection from "@/components/home/ProjectsSection";
import TestimonialSection from "@/components/home/TestimonialSection";
import ContactSection from "@/components/home/ContactSection";
import { getBootstrap, getHomepage, type Bootstrap, type Homepage } from "@/lib/api/public";
import type { Locale } from "@teamenergo/shared";

export const metadata: Metadata = {
  title: "Teamenergo | Telekomunikacije i energetska infrastruktura",
  description:
    "Teamenergo projektuje i gradi telekomunikacionu i energetsku infrastrukturu — od optičkih mreža i sistema tehničke zaštite do obnovljivih izvora energije i e-mobilnosti.",
};

const EMPTY: Homepage = {
  page: null,
  services: [],
  servicesTotal: 0,
  serviceOptions: [],
  posts: [],
  postsTotal: 0,
  stats: [],
  projects: [],
  testimonials: [],
  clients: [],
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // One request covers every collection the homepage renders. Caught rather
  // than thrown: a visitor should get the page even when the API is down, not
  // a 500.
  const [
    {
      page,
      services,
      servicesTotal,
      serviceOptions,
      posts,
      postsTotal,
      stats,
      projects,
      testimonials,
      clients,
    },
    bootstrap,
  ] =
    await Promise.all([
      getHomepage(locale as Locale).catch((error: unknown) => {
        console.error("[home] could not load content from the API:", error);
        return EMPTY;
      }),
      getBootstrap(locale as Locale).catch(
        (): Bootstrap => ({ locales: [], nav: [], settings: {}, documents: [] }),
      ),
    ]);

  // Blocks are addressed by key rather than position, so reordering them in
  // the admin cannot silently move somebody else's copy into the hero.
  const block = (key: string) => page?.blocks.find((b) => b.blockKey === key) ?? null;
  const videoBlock = block("video");

  return (
    <>
      <HeroSection block={block("hero")} stats={stats} clients={clients} />
      <ServicesSection services={services} total={servicesTotal} block={block("services")} />

      {/* Cards are rendered here, on the server, and passed in as children:
          the rail needs client state for its arrows, the cards need none, and
          this keeps eight of them out of the client bundle. */}
      <NewsSection count={posts.length} total={postsTotal} block={block("news")}>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} locale={locale} />
        ))}
      </NewsSection>

      <StatsSection stats={stats} block={block("stats")} />

      {videoBlock?.videoUrl && (
        <section className="pb-32 px-6">
          <div className="max-w-7xl mx-auto flex flex-col items-center gap-4 text-center">
            {videoBlock.heading && (
              <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-black text-ts-fg leading-tight">
                {videoBlock.heading}
              </h2>
            )}
            <VideoModal
              url={videoBlock.videoUrl}
              label={videoBlock.ctaLabel ?? "Pogledajte naš video"}
            />
          </div>
        </section>
      )}

      <ProjectsSection projects={projects} block={block("projects")} />
      <TestimonialSection
        testimonials={testimonials}
        clients={clients}
        block={block("testimonials")}
      />
      <ContactSection
        block={block("contact")}
        services={serviceOptions}
        settings={bootstrap.settings}
      />
    </>
  );
}
