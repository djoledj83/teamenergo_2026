"use client";

import { useEffect, useRef } from "react";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { mediaUrl, type ClientEntry, type TestimonialEntry } from "@/lib/api/public";

/** "Ime · Uloga · Kompanija", skipping whatever is missing. */
function attribution(entry: TestimonialEntry): string {
  return [entry.role, entry.company].filter(Boolean).join(" · ");
}

export default function TestimonialSection({
  testimonials,
  clients,
}: {
  testimonials: TestimonialEntry[];
  clients: ClientEntry[];
}) {
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
  }, [testimonials.length, clients.length]);

  const [lead, ...rest] = testimonials;

  // The section carries two independent collections; it only disappears when
  // both are empty.
  if (!lead && clients.length === 0) return null;

  return (
    <section
      id="about"
      ref={sectionRef}
      className="py-32 px-6"
      style={{ background: "linear-gradient(180deg, #0B0F14 0%, #0C1219 100%)" }}>

      <div className="max-w-7xl mx-auto space-y-20">
        {/* Header */}
        <div className="reveal-hidden text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-ts-surface border border-ts-border rounded-full px-4 py-1.5">
            <Icon name="StarIcon" size={14} className="text-ts-red" variant="solid" />
            <span className="text-xs font-bold text-ts-muted uppercase tracking-widest">
              Šta nas izdvaja
            </span>
          </div>
        </div>

        {/* Lead testimonial */}
        {lead && (
          <div className="reveal-hidden bg-ts-surface border border-ts-border rounded-[40px] overflow-hidden">
            <div className={mediaUrl(lead.avatar) ? "grid lg:grid-cols-5" : ""}>
              {/* Portrait */}
              {mediaUrl(lead.avatar) && (
                <div className="lg:col-span-2 relative h-72 lg:h-auto">
                  <AppImage
                    src={mediaUrl(lead.avatar) as string}
                    alt={lead.avatar?.alt ?? lead.name}
                    fill
                    className="object-cover object-top w-full h-full" />

                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-ts-surface hidden lg:block" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ts-surface to-transparent lg:hidden" />
                </div>
              )}

              {/* Quote */}
              <div className="lg:col-span-3 p-10 lg:p-14 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Icon key={s} name="StarIcon" size={16} variant="solid" className="text-ts-red" />
                    ))}
                  </div>
                  <blockquote className="font-display text-xl lg:text-2xl font-medium text-ts-fg leading-relaxed italic">
                    &ldquo;{lead.quote}&rdquo;
                  </blockquote>
                </div>

                <div className="mt-10 pt-8 border-t border-ts-border">
                  <div className="flex items-center gap-4">
                    {mediaUrl(lead.avatar) && (
                      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                        <AppImage
                          src={mediaUrl(lead.avatar) as string}
                          alt={lead.avatar?.alt ?? lead.name}
                          width={48}
                          height={48}
                          className="object-cover w-full h-full" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-ts-fg">{lead.name}</p>
                      {attribution(lead) && (
                        <p className="text-sm text-ts-muted">{attribution(lead)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Remaining testimonials — compact */}
        {rest.map((entry, i) => (
          <div
            key={entry.id}
            className={`reveal-hidden reveal-delay-${Math.min(i + 2, 5)} bg-ts-surface-2 border border-ts-border rounded-3xl p-8 lg:p-10`}>
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <div className="flex gap-1 flex-shrink-0">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Icon key={s} name="StarIcon" size={14} variant="solid" className="text-ts-accent" />
                ))}
              </div>
              <div className="flex-1">
                <p className="text-ts-fg text-lg italic leading-relaxed font-display">
                  &ldquo;{entry.quote}&rdquo;
                </p>
                <div className="mt-6 flex items-center gap-4">
                  {mediaUrl(entry.avatar) && (
                    <div className="w-10 h-10 rounded-full overflow-hidden">
                      <AppImage
                        src={mediaUrl(entry.avatar) as string}
                        alt={entry.avatar?.alt ?? entry.name}
                        width={40}
                        height={40}
                        className="object-cover w-full h-full" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-ts-fg text-sm">{entry.name}</p>
                    {attribution(entry) && (
                      <p className="text-xs text-ts-muted">{attribution(entry)}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Clients */}
        {clients.length > 0 && (
          <div className="reveal-hidden reveal-delay-3 space-y-6">
            <p className="text-center text-xs font-bold text-ts-muted uppercase tracking-widest">
              Sarađujemo sa
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              {clients.map((client) => (
                <ClientPill key={client.id} client={client} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>);

}

function ClientPill({ client }: { client: ClientEntry }) {
  const logo = mediaUrl(client.logo);

  const inner = logo ? (
    <AppImage
      src={logo}
      alt={client.logo?.alt ?? client.name}
      width={120}
      height={40}
      className="object-contain h-10 w-auto" />
  ) : (
    client.name
  );

  const className =
    "px-6 py-3 bg-ts-surface border border-ts-border rounded-full text-sm font-semibold text-ts-muted hover:text-ts-fg hover:border-ts-accent/40 transition-all flex items-center";

  return client.websiteUrl ? (
    <a href={client.websiteUrl} target="_blank" rel="noopener noreferrer" className={className}>
      {inner}
    </a>
  ) : (
    <div className={`${className} cursor-default`}>{inner}</div>
  );
}
