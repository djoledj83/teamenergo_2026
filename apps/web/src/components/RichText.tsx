/**
 * Renders HTML written in the admin's rich-text editor.
 *
 * Six places used to inject that HTML, each with its own idea of how to style
 * it: three asked for `prose` and three hand-rolled `[&>p]:mb-4`. The
 * hand-rolled ones styled paragraphs and nothing else, so a heading or a
 * bullet list written in the editor arrived on the page as unformatted text —
 * Tailwind's preflight resets headings to inherit and strips list markers, and
 * only `prose` puts them back.
 *
 * One component means one answer to "how does admin HTML look", and a seventh
 * call site cannot get it wrong.
 *
 * The HTML is sanitised by the API on write (apps/api/src/content/rich-text.ts)
 * rather than here, so the database holds clean markup and every consumer is
 * safe without having to remember this.
 */

const VARIANTS = {
  /** Body copy on a detail page: the full article measure and rhythm. */
  article: 'prose max-w-none',
  /**
   * Short intro copy in a hero, a contact panel or a page block. Larger and
   * lighter than article text, matching the lead paragraphs around it, but
   * still a real prose context so headings and lists work.
   */
  lead: 'prose max-w-none prose-p:text-lg prose-p:font-light',
} as const;

export default function RichText({
  html,
  variant = 'article',
  className,
}: {
  html: string | null | undefined;
  variant?: keyof typeof VARIANTS;
  /** Layout only — width, spacing. Typography belongs to the variant. */
  className?: string;
}) {
  if (!html?.trim()) return null;

  return (
    <div
      className={[VARIANTS[variant], className].filter(Boolean).join(' ')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
