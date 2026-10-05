import { downloadUrl, type MediaRef } from "@/lib/api/public";

/**
 * What a reader needs to know before tapping a download: where it goes, what
 * kind of file it is, and how big.
 *
 * Shared by the footer and the document pages. It was written in the footer,
 * and the moment a certificate got a page of its own the same three facts
 * were needed in a second place — along with the one non-obvious part, that a
 * row may have a badge and no file, which is how `doc.file!.path` once took a
 * whole page down.
 */

/** "1,4 MB" — Serbian decimal comma, and KB below a megabyte. */
export function fileSize(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function extensionOf(path: string): string {
  const ext = path.split(".").pop();
  return ext && ext.length <= 4 ? ext.toUpperCase() : "FAJL";
}

export interface Download {
  href: string;
  extension: string;
  size: string | null;
}

/**
 * The download for a document, or null when it has none.
 *
 * Returns a value rather than letting each caller assert `file!`: a filter
 * narrows nothing for the compiler, so the `!` that follows one is a claim
 * nobody checks.
 */
export function downloadFor(
  document: { label: string; file: MediaRef | null },
): Download | null {
  if (!document.file) return null;
  const extension = extensionOf(document.file.path);
  return {
    href: downloadUrl(document.file, `${document.label}.${extension.toLowerCase()}`)!,
    extension,
    size: fileSize(document.file.sizeBytes),
  };
}
