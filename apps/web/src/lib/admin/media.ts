/**
 * The media library's shape, as the admin screens see it.
 *
 * This lives here rather than inside a component because four screens and two
 * dialogs share it: a type and a URL builder are not a React component's
 * business, and importing them from one meant pulling a whole modal into
 * modules that only wanted to render a thumbnail.
 */

export interface MediaItem {
  id: string;
  path: string;
  originalName: string;
  width: number | null;
  height: number | null;
  translations: Array<{ locale: string; alt: string | null }>;
}

/** Public URL for a stored file. Paths are relative to the uploads root. */
export function mediaSrc(path: string): string {
  return `/uploads/${path}`;
}

/**
 * Best available alt text, in the admin's own language order.
 *
 * Falls back to the original filename: in a picker the point is telling two
 * thumbnails apart, and "DSC_0421.jpg" does that where an empty string does
 * not. Public pages use their own resolved alt and never this.
 */
export function mediaAlt(media: Pick<MediaItem, 'translations' | 'originalName'>): string {
  const translated = media.translations.find((row) => row.alt?.trim())?.alt;
  return translated?.trim() ?? media.originalName;
}
