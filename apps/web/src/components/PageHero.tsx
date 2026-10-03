import Icon from "@/components/ui/AppIcon";
import RichText from "@/components/RichText";

/**
 * Top of every section page.
 *
 * Also carries the padding that clears the fixed header — the homepage gets
 * that from its own full-bleed hero, every other page gets it from here, so
 * no page has to remember it.
 */
export default function PageHero({
  eyebrow,
  title,
  accent,
  lead,
  iconName = "SparklesIcon",
}: {
  eyebrow?: string;
  title: string;
  /** Rendered after the title in the red italic treatment. */
  accent?: string;
  /**
   * The page's introduction, as sanitised HTML from the admin editor.
   *
   * The prop existed and nothing ever passed it, so every page had a slot for
   * an intro and no way to write one. It now comes from page_translation.
   */
  lead?: string | null;
  /** Heroicon name, resolved at runtime by AppIcon. */
  iconName?: string;
}) {
  return (
    <section className="pt-36 pb-16 px-6 border-b border-ts-border">
      <div className="max-w-7xl mx-auto space-y-5">
        {eyebrow && (
          <div className="inline-flex items-center gap-2 bg-ts-surface border border-ts-border rounded-full px-4 py-1.5">
            <Icon name={iconName} size={14} className="text-ts-red" />
            <span className="text-xs font-bold text-ts-muted uppercase tracking-widest">
              {eyebrow}
            </span>
          </div>
        )}

        <h1 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-black text-ts-fg leading-tight tracking-tight">
          {title}
          {accent && (
            <>
              {" "}
              <span className="text-gradient-red italic">{accent}</span>
            </>
          )}
        </h1>

        <RichText html={lead} variant="lead" className="max-w-3xl" />
      </div>
    </section>
  );
}
