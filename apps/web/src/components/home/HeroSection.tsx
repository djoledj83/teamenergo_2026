"use client";

import { useEffect, useRef } from "react";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { Link } from "@/i18n/navigation";
import TickerBar from "@/components/home/TickerBar";
import { mediaUrl, type ClientEntry, type PageBlock, type StatEntry } from "@/lib/api/public";

/**
 * Homepage hero.
 *
 * Every word here comes from the `hero` block of the `home` page, editable at
 * /admin/pages/home. The figures beside it are the featured statistics, so
 * the client controls both without touching code.
 *
 * The heading is deliberately two fields rather than one: `heading` renders
 * plain and `subheading` in the accent treatment. A single field would mean
 * guessing where to break the line and which half to emphasise, which is not
 * a decision code can make for copy it has never seen.
 */

const FLOAT_POSITIONS = [
  { className: "float-1", position: "top-[18%] left-[3%]" },
  { className: "float-2", position: "top-[12%] right-[4%]" },
  { className: "float-3", position: "bottom-[28%] right-[2%]" },
];

function formatStat(stat: StatEntry): string {
  const value = stat.isDecimal
    ? stat.value.toFixed(2)
    : stat.value.toLocaleString("sr-RS").replace(/ /g, ".");
  return `${stat.prefix ?? ""}${value}${stat.suffix ?? ""}`;
}

export default function HeroSection({
  block,
  stats = [],
  clients = [],
}: {
  block?: PageBlock | null;
  stats?: StatEntry[];
  clients?: ClientEntry[];
}) {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const x = (clientX / innerWidth - 0.5) * 20;
      const y = (clientY / innerHeight - 0.5) * 10;
      const glowEl = hero.querySelector<HTMLElement>(".hero-glow");
      if (glowEl) glowEl.style.transform = `translate(${x}px, ${y}px)`;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Nothing to show and nothing to fall back to — better an honest gap than
  // somebody else's marketing copy.
  if (!block?.heading && !block?.body) return null;

  const image = mediaUrl(block.image);
  const miniStats = stats.slice(0, 3);
  const floating = stats.slice(0, FLOAT_POSITIONS.length);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center overflow-hidden grid-lines pb-20"
      style={{ background: "linear-gradient(160deg, #0B0F14 0%, #0F1A24 50%, #0B0F14 100%)" }}>

      <div
        className="hero-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full pointer-events-none transition-transform duration-700"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(245,158,11,0.06) 0%, rgba(45,125,210,0.04) 40%, transparent 70%)",
        }} />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, transparent 48%, rgba(245,158,11,0.03) 49%, rgba(245,158,11,0.03) 51%, transparent 52%)",
        }} />

      <div className="max-w-7xl mx-auto px-6 pt-28 pb-16 w-full relative z-10">
        <div className={`grid gap-16 items-center ${image ? "lg:grid-cols-2" : ""}`}>
          {/* LEFT */}
          <div className="space-y-10">
            {block.eyebrow && (
              <div className="inline-flex items-center gap-2.5 bg-ts-surface border border-ts-border rounded-full px-4 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-ts-red opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-ts-red" />
                </span>
                <span className="text-xs font-semibold text-ts-muted uppercase tracking-widest">
                  {block.eyebrow}
                </span>
              </div>
            )}

            {(block.heading || block.subheading) && (
              <h1 className="font-display text-[clamp(2.5rem,6vw,5rem)] font-black leading-[0.95] tracking-tight text-ts-fg">
                {block.heading}
                {block.subheading && (
                  <>
                    <br />
                    <span className="text-gradient-red italic">{block.subheading}</span>
                  </>
                )}
              </h1>
            )}

            {block.body && (
              // Sanitised by the API on write; see apps/api/src/content/rich-text.ts.
              <div
                className="text-lg text-ts-muted leading-relaxed max-w-lg font-light [&>p]:mb-4 [&>p:last-child]:mb-0"
                dangerouslySetInnerHTML={{ __html: block.body }} />
            )}

            {block.ctaLabel && block.ctaHref && (
              <div className="flex flex-wrap gap-4">
                <Link
                  href={block.ctaHref}
                  className="bg-ts-red text-black px-8 py-4 rounded-full font-bold text-sm hover:bg-amber-400 transition-all hover:scale-105 shadow-lg shadow-amber-900/20">
                  {block.ctaLabel}
                </Link>
              </div>
            )}

            {miniStats.length > 0 && (
              <div className="flex flex-wrap gap-10 pt-4 border-t border-ts-border">
                {miniStats.map((stat) => (
                  <div key={stat.id}>
                    <p className="font-display text-2xl font-black text-ts-fg">
                      {formatStat(stat)}
                    </p>
                    <p className="text-xs text-ts-muted font-medium mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT */}
          {image && (
            <div className="relative flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[520px] aspect-[4/5] rounded-[32px] overflow-hidden glow-blue">
                <AppImage
                  src={image}
                  alt={block.image?.alt ?? block.heading ?? ""}
                  fill
                  className="object-cover"
                  priority />
                <div
                  className="absolute inset-0"
                  style={{
                    background: "linear-gradient(180deg, transparent 40%, rgba(11,15,20,0.85) 100%)",
                  }} />
                {block.image?.caption && (
                  <div className="absolute bottom-0 left-0 right-0 p-8">
                    <p className="font-display text-xl font-bold text-white">
                      {block.image.caption}
                    </p>
                  </div>
                )}
              </div>

              {floating.map((stat, i) => {
                const spot = FLOAT_POSITIONS[i]!;
                return (
                  <div
                    key={stat.id}
                    className={`absolute hidden lg:flex ${spot.position} ${spot.className} items-center gap-3 bg-ts-surface/90 backdrop-blur-md border border-ts-border rounded-2xl px-4 py-3 shadow-xl`}>
                    {stat.iconName && (
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          stat.accent === "amber"
                            ? "bg-amber-500/15 text-ts-red"
                            : "bg-blue-500/15 text-ts-blue"
                        }`}>
                        <Icon name={stat.iconName} size={18} />
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] text-ts-muted font-semibold uppercase tracking-wider">
                        {stat.label}
                      </p>
                      <p className="font-display text-lg font-black text-ts-fg leading-tight">
                        {formatStat(stat)}
                      </p>
                    </div>
                  </div>
                );
              })}

              <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-ts-accent/10 blur-2xl pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      <div
        className="absolute bottom-20 left-0 right-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to top, #0B0F14, transparent)" }} />

      {/* Anchored to the bottom of the first screen rather than following it,
          so the strip is visible before any scrolling and the hero still
          fills the viewport. */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <TickerBar clients={clients} />
      </div>
    </section>
  );
}
