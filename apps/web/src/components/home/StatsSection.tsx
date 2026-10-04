"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/AppIcon";
import type { PageBlock, StatEntry } from "@/lib/api/public";
import { sectionCopy } from "@/lib/section-copy";

function useCountUp(target: number, duration = 2000, isDecimal = false) {
  const [count, setCount] = useState(0);
  const startedRef = useRef(false);

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(isDecimal ? parseFloat((eased * target).toFixed(2)) : Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, isDecimal]);

  return { count, start };
}

function StatItem({ stat }: { stat: StatEntry }) {
  const { count, start } = useCountUp(stat.value, 2200, stat.isDecimal);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          start();
          observer.unobserve(el);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [start]);

  const displayCount = stat.isDecimal
    ? count.toFixed(2)
    : count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const accent = stat.accent === "amber" ? "amber" : "blue";

  return (
    <div
      ref={ref}
      className="relative group p-8 bg-ts-surface border border-ts-border rounded-3xl hover:border-ts-accent/40 transition-all duration-300 hover:-translate-y-1"
    >
      {stat.iconName && (
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${
            accent === "amber" ? "bg-amber-500/10 text-ts-accent" : "bg-blue-500/10 text-ts-blue"
          }`}
        >
          <Icon name={stat.iconName} size={22} />
        </div>
      )}

      <div className="font-display text-4xl font-black text-ts-fg mb-1" suppressHydrationWarning>
        {stat.prefix}
        {displayCount}
        {stat.suffix}
      </div>
      <p className="text-ts-fg font-semibold text-base mb-2">{stat.label}</p>
      {stat.description && (
        <p className="text-ts-muted text-sm leading-relaxed">{stat.description}</p>
      )}

      {/* Subtle glow on hover */}
      <div
        className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
          accent === "amber"
            ? "shadow-[inset_0_0_30px_rgba(245,158,11,0.05)]"
            : "shadow-[inset_0_0_30px_rgba(45,125,210,0.05)]"
        }`}
      />
    </div>
  );
}

export default function StatsSection({
  stats,
  block,
}: {
  stats: StatEntry[];
  /** Heading copy for this section, edited on the home page. */
  block?: PageBlock | null;
}) {
  const copy = sectionCopy(block, {
    eyebrow: "U brojkama",
    heading: "Neka brojke",
    accent: "same kažu.",
  });
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const els = sectionRef.current?.querySelectorAll(".reveal-hidden");
    if (!els) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [stats.length]);

  // Seeded statistics start unpublished with a value of zero, so this section
  // stays hidden until real numbers are entered and published in the admin.
  if (stats.length === 0) return null;

  return (
    <section
      id="infrastructure"
      ref={sectionRef}
      className="py-32 px-6 relative"
      style={{
        background: "linear-gradient(180deg, #0B0F14 0%, #0D1520 50%, #0B0F14 100%)",
      }}
    >
      {/* Decorative grid overlay */}
      <div className="absolute inset-0 grid-lines opacity-40 pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-16">
        {/* Header. Both lines cleared in the admin, it goes entirely rather
            than leaving an empty box holding the gap below it open. */}
        {(copy.eyebrow || copy.heading || copy.accent) && (
          <div className="reveal-hidden text-center space-y-4">
            {copy.eyebrow && (
              <div className="inline-flex items-center gap-2 bg-ts-surface border border-ts-border rounded-full px-4 py-1.5">
                <Icon name="ChartBarIcon" size={14} className="text-ts-red" />
                <span className="text-xs font-bold text-ts-muted uppercase tracking-widest">
                  {copy.eyebrow}
                </span>
              </div>
            )}
            {(copy.heading || copy.accent) && (
              <h2 className="font-display text-[clamp(2.5rem,5vw,4rem)] font-black text-ts-fg leading-tight tracking-tight">
                {copy.heading}
                {copy.accent && (
                  <>
                    {" "}
                    <span className="text-gradient-red italic">{copy.accent}</span>
                  </>
                )}
              </h2>
            )}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <div key={stat.id} className={`reveal-hidden reveal-delay-${Math.min(i + 1, 5)}`}>
              <StatItem stat={stat} />
            </div>
          ))}
        </div>

        {/* Bottom CTA strip */}
        <div className="reveal-hidden mt-12 bg-ts-surface border border-ts-border rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-display text-2xl font-bold text-ts-fg">
              Spremni za sledeći projekat?
            </h3>
            <p className="text-ts-muted mt-1">
              Razgovarajte sa našim inženjerskim timom o vašoj infrastrukturi.
            </p>
          </div>
          <a
            href="#contact"
            className="flex-shrink-0 bg-ts-red text-black px-8 py-4 rounded-full font-bold text-sm hover:bg-amber-400 transition-all hover:scale-105 whitespace-nowrap"
          >
            Pošaljite upit
          </a>
        </div>
      </div>
    </section>
  );
}
