import { describe, expect, it, vi } from 'vitest';

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-to-pass-validation';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-long-enough-to-pass';

/**
 * How an album is shaped for the public site.
 *
 * The rule under test: a gallery item's only translated field is its caption,
 * and a caption is optional. Images are added to an album in bulk and
 * captioned later, if at all — so an item with no translation row is the
 * normal case, not a broken one, and it has to survive the flattening.
 *
 * This is the same rule media already has (see flattenMedia). Routing items
 * through flattenEntity instead dropped every uncaptioned photo: the album
 * list reported the right item count and the album page then rendered empty.
 */

const album = {
  id: 'alb_1',
  coverImageId: 'med_1',
  sortOrder: 0,
  isPublished: true,
  translations: [
    { id: 'at_sr', locale: 'sr', slug: 'radovi-2025', title: 'Radovi 2025', description: null },
    { id: 'at_en', locale: 'en', slug: 'works-2025', title: 'Works 2025', description: null },
  ],
  coverImage: {
    id: 'med_1',
    path: '2026/01/cover.webp',
    width: 1600,
    height: 1200,
    variants: null,
    translations: [],
  },
  items: [
    {
      // Freshly added in bulk: no caption in any language.
      id: 'item_1',
      galleryAlbumId: 'alb_1',
      mediaId: 'med_1',
      sortOrder: 0,
      translations: [],
      media: {
        id: 'med_1',
        path: '2026/01/one.webp',
        width: 1600,
        height: 1200,
        variants: null,
        translations: [],
      },
    },
    {
      // Captioned in Serbian only.
      id: 'item_2',
      galleryAlbumId: 'alb_1',
      mediaId: 'med_2',
      sortOrder: 1,
      translations: [{ id: 'it_sr', locale: 'sr', caption: 'Trafostanica' }],
      media: {
        id: 'med_2',
        path: '2026/01/two.webp',
        width: 1600,
        height: 1200,
        variants: [{ width: 800, path: '2026/01/two-800.webp' }],
        translations: [{ locale: 'sr', alt: 'Trafostanica u izgradnji', caption: null }],
      },
    },
  ],
};

const findFirst = vi.fn(async () => album);

vi.mock('../db.js', () => ({
  prisma: { galleryAlbum: { findFirst: (...args: unknown[]) => findFirst(...(args as [])) } },
  disconnectDb: vi.fn(),
}));

const { getGalleryAlbumBySlug } = await import('./queries.js');

describe('getGalleryAlbumBySlug', () => {
  it('keeps an item that has no caption in any language', async () => {
    const result = await getGalleryAlbumBySlug('radovi-2025', 'sr');

    expect(result?.items).toHaveLength(2);
    expect(result?.items[0]).toMatchObject({ id: 'item_1', caption: null });
    expect(result?.items[0]?.media?.path).toBe('2026/01/one.webp');
  });

  it('resolves the caption for the requested language', async () => {
    const result = await getGalleryAlbumBySlug('radovi-2025', 'sr');
    expect(result?.items[1]?.caption).toBe('Trafostanica');
  });

  it('falls back to Serbian copy for a language that has none', async () => {
    // Same reason the rest of the site falls back: a visitor should see the
    // Serbian caption rather than a blank line.
    const result = await getGalleryAlbumBySlug('works-2025', 'en');
    expect(result?.items[1]?.caption).toBe('Trafostanica');
    expect(result?.items).toHaveLength(2);
  });

  it('carries the media through untouched by the caption', async () => {
    const result = await getGalleryAlbumBySlug('works-2025', 'en');
    const second = result?.items[1];

    expect(second?.media).toMatchObject({ id: 'med_2', width: 1600, height: 1200 });
    // Media alt has its own per-language row and its own fallback.
    expect(second?.media?.alt).toBe('Trafostanica u izgradnji');
  });

  it('keeps the album order the query asked for', async () => {
    const result = await getGalleryAlbumBySlug('radovi-2025', 'sr');
    expect(result?.items.map((item) => item.id)).toEqual(['item_1', 'item_2']);
  });

  it('returns null when no album matches', async () => {
    findFirst.mockResolvedValueOnce(null as unknown as typeof album);
    expect(await getGalleryAlbumBySlug('nepostojeci', 'sr')).toBeNull();
  });
});
