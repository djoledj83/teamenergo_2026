import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import HeroSection from "@/components/home/HeroSection";
import ServicesSection from "@/components/home/ServicesSection";
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
  stats: [],
  projects: [],
  testimonials: [],
  clients: [],
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // One request covers all six collections the homepage renders. Caught
  // rather than thrown: a visitor should get the page even when the API is
  // down, not a 500.
  const [{ page, services, stats, projects, testimonials, clients }, bootstrap] =
    await Promise.all([
      getHomepage(locale as Locale).catch((error: unknown) => {
        console.error("[home] could not load content from the API:", error);
        return EMPTY;
      }),
      getBootstrap(locale as Locale).catch(
        (): Bootstrap => ({ locales: [], nav: [], settings: {} }),
      ),
    ]);

  // Blocks are addressed by key rather than position, so reordering them in
  // the admin cannot silently move somebody else's copy into the hero.
  const block = (key: string) => page?.blocks.find((b) => b.blockKey === key) ?? null;

  return (
    <>
      <HeroSection block={block("hero")} stats={stats} clients={clients} />
      <ServicesSection services={services} />
      <StatsSection stats={stats} />
      <ProjectsSection projects={projects} />
      <TestimonialSection testimonials={testimonials} clients={clients} />
      <ContactSection block={block("contact")} services={services} settings={bootstrap.settings} />
    </>
  );
}
