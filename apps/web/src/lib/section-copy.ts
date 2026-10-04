import type { PageBlock } from "@/lib/api/public";

/**
 * The eyebrow and heading above a home-page section, editable in the admin.
 *
 * These were written into the components in Serbian, which made them both
 * uneditable and wrong on the English site — /en showed "Šta gradimo i
 * napajamo." like everywhere else. Each section now reads its own page block
 * on the home page, and keeps its original text for when there is no block.
 *
 * The fallback is what makes this safe to deploy ahead of the seed: until the
 * rows exist the page reads exactly as it did. But it applies to a *missing
 * block*, not to a blank field. Once the row is there the admin is the only
 * authority — clearing the subheading removes the red accent and leaves it
 * removed, rather than quietly restoring a Serbian phrase nobody typed. A
 * field that springs back when you empty it reads as a bug, and there would
 * be nothing on screen to say otherwise.
 *
 * A block's `subheading` carries the accent — the few words set in red italic
 * at the end of the heading — which is the same mapping ContactSection
 * already uses, rather than a seventh column nobody else would want.
 */
export interface SectionCopy {
  eyebrow: string | undefined;
  heading: string | undefined;
  accent: string | undefined;
}

const text = (value: string | null | undefined) =>
  value?.trim() ? value.trim() : undefined;

export function sectionCopy(
  block: PageBlock | null | undefined,
  defaults: { eyebrow: string; heading?: string; accent?: string },
): SectionCopy {
  if (!block) {
    return {
      eyebrow: defaults.eyebrow,
      heading: defaults.heading,
      accent: defaults.accent,
    };
  }

  return {
    eyebrow: text(block.eyebrow),
    heading: text(block.heading),
    accent: text(block.subheading),
  };
}
