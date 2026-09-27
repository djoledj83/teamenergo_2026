import { describe, expect, it } from 'vitest';
import { richText, sanitizeRichText } from './rich-text.js';

/**
 * Rich text is rendered on the public site with dangerouslySetInnerHTML, so
 * whatever survives this function runs in every visitor's browser. These
 * tests are the boundary: each case is something an editor account could
 * store that must not reach a reader intact.
 */

describe('sanitizeRichText', () => {
  it('keeps the formatting the editor actually produces', () => {
    const html =
      '<h2>Naslov</h2><p><strong>Podebljano</strong> i <em>kurziv</em>.</p>' +
      '<ul><li>Prva</li><li>Druga</li></ul>' +
      '<blockquote><p>Citat</p></blockquote>';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it('keeps links and images with their real attributes', () => {
    expect(sanitizeRichText('<a href="https://teamenergo.rs" title="t">x</a>')).toContain(
      'href="https://teamenergo.rs"',
    );
    expect(sanitizeRichText('<img src="/uploads/a.webp" alt="opis" />')).toContain('alt="opis"');
  });

  it('strips script tags and their contents', () => {
    const out = sanitizeRichText('<p>pre</p><script>alert(1)</script><p>post</p>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('pre');
    expect(out).toContain('post');
  });

  it('strips inline event handlers', () => {
    const out = sanitizeRichText('<p onmouseover="steal()">tekst</p>');
    expect(out).not.toContain('onmouseover');
    expect(out).toContain('tekst');
  });

  it('strips javascript: and data: URLs', () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
    // A data: URL can carry an SVG document, and an SVG document can script.
    expect(sanitizeRichText('<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" />')).not.toContain(
      'data:',
    );
  });

  it('strips iframes, objects and embeds', () => {
    for (const tag of [
      '<iframe src="https://evil.example"></iframe>',
      '<object data="x.swf"></object>',
      '<embed src="x.swf" />',
    ]) {
      expect(sanitizeRichText(tag)).toBe('');
    }
  });

  it('strips style attributes, which can load remote resources', () => {
    const out = sanitizeRichText('<p style="background:url(https://evil.example/x)">t</p>');
    expect(out).not.toContain('style');
  });

  it('adds rel=noopener to links that open a new tab', () => {
    const out = sanitizeRichText('<a href="https://x.example" target="_blank">x</a>');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('survives malformed markup without throwing', () => {
    expect(() => sanitizeRichText('<p><strong>unclosed')).not.toThrow();
    expect(() => sanitizeRichText('<<>>')).not.toThrow();
  });
});

describe('richText schema field', () => {
  const field = richText(1000);

  it('sanitises as part of validation, so no route can forget to', () => {
    const parsed = field.parse('<p>ok</p><script>alert(1)</script>');
    expect(parsed).toBe('<p>ok</p>');
  });

  it('still enforces the length limit', () => {
    expect(field.safeParse('a'.repeat(1001)).success).toBe(false);
  });

  it('accepts null and undefined, as the columns are optional', () => {
    expect(field.parse(null)).toBeNull();
    expect(field.parse(undefined)).toBeUndefined();
  });
});
