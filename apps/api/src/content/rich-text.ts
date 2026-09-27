import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';

/**
 * Rich text arrives as HTML from the admin's editor and is rendered on the
 * public site with dangerouslySetInnerHTML. Without sanitising, an editor
 * account could store a <script> tag that then runs for every visitor —
 * stored XSS, persisting until someone notices.
 *
 * "Only signed-in admins can write it" is not sufficient protection. The
 * project has an EDITOR role alongside OWNER, so not every author is fully
 * trusted, and a single stolen editor session would otherwise be enough to
 * put script on every page of the public site indefinitely.
 *
 * Sanitising on WRITE rather than on read means the database holds clean
 * HTML: every consumer — the website, a future mobile client, an export —
 * gets safe markup without having to remember to sanitise it again.
 */

/** What the editor can actually produce, and nothing more. */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr', 'span', 'div',
];

const options: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    // TipTap marks alignment and similar with classes; the class itself is
    // inert, and allowing it avoids stripping the editor's own formatting.
    '*': ['class'],
  },
  // No javascript:, no data: — data: URLs can carry an SVG with script in it.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  // An untrusted link should not get scripting access to the opener window.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        ...(attribs.target === '_blank' ? { rel: 'noopener noreferrer' } : {}),
      },
    }),
  },
  // style is omitted from allowedAttributes entirely: CSS can load external
  // resources and, in older engines, execute. Formatting belongs to classes.
  disallowedTagsMode: 'discard',
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, options);
}

/**
 * Zod field for a rich-text column.
 *
 * The transform runs as part of validation, so every route that accepts rich
 * text is covered by construction — there is no separate step for a new
 * collection's author to forget.
 */
export const richText = (max: number) =>
  z
    .string()
    .max(max)
    .transform(sanitizeRichText)
    .nullable()
    .optional();
