import type { Metadata } from "next";

/**
 * The <title> and meta description for one page or content item.
 *
 * Two problems, both of which made the SEO fields in the admin worth less
 * than they looked.
 *
 * The first: the SEO naslov and SEO opis on services, references and news
 * have been in the admin — and in the database — since those collections
 * were built, and nothing read them. Each detail page assembled its metadata
 * from the item's title and summary and ignored both columns, so the fields
 * saved cleanly, showed the copy back on reload, and changed nothing in a
 * search result.
 *
 * The second: the root layout sets a title template, `%s | Teamenergo`. That
 * is right for a title derived from the content — "Telekomunikacije" should
 * read "Telekomunikacije | Teamenergo" in the tab. It is wrong for a title
 * somebody typed into a field labelled SEO naslov: that is meant to be the
 * exact line in the search result, it has about sixty characters to work in,
 * and people write the brand into it themselves. Appending the template gave
 * "Optičke mreže | Teamenergo | Teamenergo".
 *
 * So a typed SEO title is `absolute` — used verbatim — and a derived one
 * still goes through the template. The fallbacks mean an item with both
 * fields blank, which is all of them today, produces exactly the metadata it
 * produced before.
 *
 * `undefined` rather than null for the description: Next omits the tag for
 * undefined and emits an empty one for null.
 */
export function seoMetadata(
  source: { seoTitle?: string | null; seoDescription?: string | null } | null | undefined,
  fallback: { title: string; description?: string | null },
): Metadata {
  const seoTitle = text(source?.seoTitle);
  const description = text(source?.seoDescription) ?? text(fallback.description);

  return {
    title: seoTitle ? { absolute: seoTitle } : fallback.title,
    ...(description ? { description } : {}),
  };
}

const text = (value: string | null | undefined) =>
  value?.trim() ? value.trim() : undefined;
