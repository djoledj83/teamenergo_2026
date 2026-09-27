"use client";

import { useEffect, useRef } from "react";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { mediaUrl, type ProjectSummary } from "@/lib/api/public";

export default function ProjectsSection({ projects }: { projects: ProjectSummary[] }) {
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
  }, [projects.length]);

  // No featured projects published — the section disappears rather than
  // showing placeholders.
  if (projects.length === 0) return null;

  return (
    <section id="projects" ref={sectionRef} className="py-32 px-6">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Header */}
        <div className="reveal-hidden flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-ts-surface border border-ts-border rounded-full px-4 py-1.5">
              <Icon name="MapPinIcon" size={14} className="text-ts-red" />
              <span className="text-xs font-bold text-ts-muted uppercase tracking-widest">
                Najznačajniji projekti
              </span>
            </div>
            <h2 className="font-display text-[clamp(2.5rem,5vw,4rem)] font-black text-ts-fg leading-tight tracking-tight">
              Reference iz{" "}
              <span className="text-gradient-red italic">prakse.</span>
            </h2>
          </div>
        </div>

        {/* Projects */}
        <div className="space-y-8">
          {projects.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              reverse={i % 2 !== 0}
              className={`reveal-hidden reveal-delay-${Math.min(i + 1, 5)}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectCard({
  project,
  reverse,
  className = "",
}: {
  project: ProjectSummary;
  reverse: boolean;
  className?: string;
}) {
  const image = mediaUrl(project.coverImage);
  const tagClass =
    project.accent === "amber"
      ? "bg-amber-500/80 text-black"
      : project.accent === "red"
        ? "bg-ts-red text-white"
        : "bg-blue-500/80 text-white";

  return (
    <div
      className={`group bg-ts-surface border border-ts-border rounded-[32px] overflow-hidden hover:border-ts-red/30 transition-all duration-400 ${className}`}>
      <div className={`flex flex-col ${reverse ? "lg:flex-row-reverse" : "lg:flex-row"} h-full`}>
        {/* Image */}
        {image && (
          <div className="lg:w-[45%] h-64 lg:h-auto flex-shrink-0 project-img-wrap relative">
            <AppImage
              src={image}
              alt={project.coverImage?.alt ?? project.title}
              fill
              className="object-cover w-full h-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-ts-bg/60 via-transparent to-transparent" />
            {project.tag && (
              <div className="absolute top-4 left-4">
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${tagClass}`}>
                  {project.tag}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-8 lg:p-12 flex flex-col justify-between">
          <div className="space-y-4">
            {(project.location || project.year) && (
              <div className="flex items-center gap-2 text-ts-muted text-sm">
                <Icon name="MapPinIcon" size={14} />
                <span>
                  {[project.location, project.year].filter(Boolean).join(" · ")}
                </span>
              </div>
            )}
            <h3 className="font-display text-2xl lg:text-3xl font-bold text-ts-fg leading-tight">
              {project.title}
            </h3>
            {project.summary && (
              <p className="text-ts-muted leading-relaxed">{project.summary}</p>
            )}
          </div>

          {/* Metrics */}
          {project.metrics.length > 0 && (
            <div className="mt-8 pt-6 border-t border-ts-border">
              <div className="grid grid-cols-3 gap-6">
                {project.metrics.map((m) => (
                  <div key={m.id}>
                    <p className="font-display text-xl font-black text-ts-fg">{m.value}</p>
                    <p className="text-[10px] text-ts-muted font-semibold uppercase tracking-wider mt-0.5">
                      {m.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
