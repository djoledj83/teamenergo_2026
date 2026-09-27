"use client";

import { useEffect, useRef } from "react";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { Link } from "@/i18n/navigation";
import { mediaUrl, type ServiceSummary } from "@/lib/api/public";

/**
 * Bento rhythm.
 *
 * The original layout hardcoded five cards at fixed spans. The number of
 * services is now whatever the admin has published, so the spans repeat on a
 * five-card cycle instead: wide, narrow, narrow, wide, full. Any count lands
 * on a balanced grid.
 */
const SPANS = [
  "lg:col-span-2",
  "",
  "",
  "lg:col-span-2",
  "md:col-span-2 lg:col-span-3",
];

const spanFor = (index: number) => SPANS[index % SPANS.length] ?? "";
const isWide = (index: number) => index % SPANS.length === 4;

export default function ServicesSection({ services }: { services: ServiceSummary[] }) {
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
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [services.length]);

  // Nothing published yet — render nothing rather than sample content.
  if (services.length === 0) return null;

  return (
    <section id="services" ref={sectionRef} className="py-32 px-6">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Header */}
        <div className="reveal-hidden flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-ts-surface border border-ts-border rounded-full px-4 py-1.5">
              <Icon name="WrenchScrewdriverIcon" size={14} className="text-ts-red" />
              <span className="text-xs font-bold text-ts-muted uppercase tracking-widest">
                Naše usluge
              </span>
            </div>
            <h2 className="font-display text-[clamp(2.5rem,5vw,4rem)] font-black text-ts-fg leading-tight tracking-tight">
              Šta gradimo i{" "}
              <span className="text-gradient-red italic">napajamo.</span>
            </h2>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-auto">
          {services.map((service, i) => (
            <ServiceCard
              key={service.id}
              service={service}
              wide={isWide(i)}
              className={`${spanFor(i)} reveal-hidden reveal-delay-${Math.min(i + 1, 5)}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceCard({
  service,
  className = "",
  wide = false,
}: {
  service: ServiceSummary;
  className?: string;
  wide?: boolean;
}) {
  const accent = service.accent === "amber" ? "amber" : "blue";
  const image = mediaUrl(service.image);

  return (
    <Link
      href={`/usluge/${service.slug}`}
      className={`service-card group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-red rounded-2xl ${className}`}>
      <div className={`${wide ? "flex flex-col md:flex-row" : "flex flex-col"} h-full`}>
        {/* Image — omitted entirely when the service has none, so the card
            closes up rather than showing an empty placeholder box. */}
        {image && (
          <div
            className={`project-img-wrap flex-shrink-0 ${
              wide ? "md:w-2/5 h-56 md:h-auto" : "h-52"
            } m-4 mb-0 rounded-xl overflow-hidden`}>
            <AppImage
              src={image}
              alt={service.image?.alt ?? service.title}
              fill
              className="object-cover w-full h-full" />
          </div>
        )}

        {/* Content */}
        <div className="p-6 flex flex-col justify-between flex-1 relative z-10">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              {service.category ? (
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                    accent === "amber" ? "bg-amber-500/10 text-ts-red" : "bg-blue-500/10 text-ts-blue"
                  }`}>
                  {service.category}
                </span>
              ) : (
                <span />
              )}
              {service.iconName && (
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    accent === "amber" ? "bg-amber-500/15 text-ts-red" : "bg-blue-500/15 text-ts-blue"
                  }`}>
                  <Icon name={service.iconName} size={18} />
                </div>
              )}
            </div>

            <h3 className="font-display text-xl font-bold text-ts-fg leading-tight">
              {service.title}
            </h3>
            {service.summary && (
              <p className="text-ts-muted text-sm leading-relaxed line-clamp-3">
                {service.summary}
              </p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-ts-border flex items-center justify-between">
            <div className="flex gap-6">
              {service.stats.map((s) => (
                <div key={s.id}>
                  <p className="font-display text-lg font-black text-ts-fg">{s.value}</p>
                  <p className="text-[10px] text-ts-muted font-semibold uppercase tracking-wider">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
            <div className="w-9 h-9 rounded-full border border-ts-border flex items-center justify-center text-ts-muted group-hover:bg-ts-red group-hover:border-ts-red group-hover:text-black transition-all">
              <Icon name="ArrowRightIcon" size={14} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
