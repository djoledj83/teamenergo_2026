import { describe, expect, it } from 'vitest';
import {
  flattenEntity,
  flattenList,
  flattenMedia,
  missingLocales,
  pickTranslation,
  translationCreateData,
} from './translations.js';

interface Copy {
  id: string;
  locale: string;
  title: string;
  summary: string;
}

const sr: Copy = { id: 't1', locale: 'sr', title: 'Energetika', summary: 'Opis' };
const en: Copy = { id: 't2', locale: 'en', title: 'Energy', summary: 'Summary' };

describe('pickTranslation', () => {
  it('returns the requested locale', () => {
    expect(pickTranslation([sr, en], 'en')?.title).toBe('Energy');
  });

  it('falls back to the default locale when the requested one is missing', () => {
    // An editor may publish before translating; a visitor should see Serbian
    // rather than an empty page.
    expect(pickTranslation([sr], 'en')?.title).toBe('Energetika');
  });

  it('returns undefined when neither exists', () => {
    expect(pickTranslation([], 'en')).toBeUndefined();
  });

  it('honours a non-default fallback', () => {
    expect(pickTranslation([en], 'sr', 'en')?.title).toBe('Energy');
  });
});

describe('flattenEntity', () => {
  const service = {
    id: 'svc_1',
    iconName: 'BoltIcon',
    sortOrder: 2,
    isPublished: true,
    translations: [sr, en],
  };

  it('merges copy onto the base row', () => {
    const result = flattenEntity(service, 'sr');
    expect(result).toMatchObject({
      id: 'svc_1',
      iconName: 'BoltIcon',
      sortOrder: 2,
      title: 'Energetika',
      summary: 'Opis',
    });
  });

  it('removes the translations array so components never see the split', () => {
    const result = flattenEntity(service, 'sr') as Record<string, unknown>;
    expect(result.translations).toBeUndefined();
  });

  it('keeps the entity id, not the translation id', () => {
    const result = flattenEntity(service, 'en') as Record<string, unknown>;
    expect(result.id).toBe('svc_1');
  });

  it('does not leak the locale field into the response', () => {
    const result = flattenEntity(service, 'en') as Record<string, unknown>;
    expect(result.locale).toBeUndefined();
  });

  it('returns null when there is no usable copy', () => {
    expect(flattenEntity({ ...service, translations: [] as Copy[] }, 'sr')).toBeNull();
  });

  it('exposes translated fields on the returned type, not just at runtime', () => {
    // Guards the generic signature: if T stops being inferred from the
    // argument, `title` vanishes from the return type and this stops
    // compiling even though the runtime behaviour is unchanged.
    const result = flattenEntity(service, 'sr');
    if (!result) throw new Error('expected a translation');
    const title: string = result.title;
    const summary: string = result.summary;
    const iconName: string = result.iconName;
    expect({ title, summary, iconName }).toEqual({
      title: 'Energetika',
      summary: 'Opis',
      iconName: 'BoltIcon',
    });
  });
});

describe('flattenList', () => {
  const items: Array<{ id: string; sortOrder: number; translations: Copy[] }> = [
    { id: 'a', sortOrder: 0, translations: [sr, en] },
    { id: 'b', sortOrder: 1, translations: [] },
    { id: 'c', sortOrder: 2, translations: [sr] },
  ];

  it('drops entities with no copy in any language', () => {
    const result = flattenList(items, 'en');
    expect(result.map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('preserves the incoming order', () => {
    const result = flattenList(items, 'sr');
    expect(result.map((item) => item.sortOrder)).toEqual([0, 2]);
  });

  it('applies the fallback per entity, not per list', () => {
    const result = flattenList(items, 'en');
    expect(result[0]?.title).toBe('Energy');      // has English
    expect(result[1]?.title).toBe('Energetika');  // falls back to Serbian
  });

  it('handles an empty list', () => {
    expect(flattenList<{ id: string }, Copy>([], 'sr')).toEqual([]);
  });
});

describe('missingLocales', () => {
  it('reports languages still to be filled in', () => {
    expect(missingLocales([sr], ['sr', 'en'])).toEqual(['en']);
  });

  it('returns nothing when complete', () => {
    expect(missingLocales([sr, en], ['sr', 'en'])).toEqual([]);
  });

  it('reports everything when nothing is translated', () => {
    expect(missingLocales([], ['sr', 'en'])).toEqual(['sr', 'en']);
  });
});

describe('translationCreateData', () => {
  it('builds a nested createMany payload with the locale attached', () => {
    const result = translationCreateData({
      sr: { title: 'Energetika' },
      en: { title: 'Energy' },
    });
    expect(result).toEqual({
      createMany: {
        data: [
          { title: 'Energetika', locale: 'sr' },
          { title: 'Energy', locale: 'en' },
        ],
      },
    });
  });

  it('skips languages the editor left blank', () => {
    const result = translationCreateData({ sr: { title: 'Energetika' }, en: undefined });
    expect(result?.createMany.data).toHaveLength(1);
    expect(result?.createMany.data[0]?.locale).toBe('sr');
  });

  it('returns undefined when nothing was supplied, so Prisma gets no empty write', () => {
    expect(translationCreateData({})).toBeUndefined();
  });
});

/**
 * Media is flattened differently from content, and the difference is the
 * whole point.
 *
 * An uploaded image has no translation rows until somebody types alt text
 * into the library. Routing it through flattenEntity meant it was discarded
 * — file on disk, row in the database, attached to the right service, and
 * invisible on every page. These cases fail against that behaviour.
 */
describe('flattenMedia', () => {
  const untranslated = {
    id: 'med_1',
    path: '2026/09/photo.webp',
    width: 1600,
    height: 900,
    translations: [] as Array<{ locale: string; alt: string | null; caption: string | null }>,
  };

  it('keeps an image that has no translations at all', () => {
    const result = flattenMedia(untranslated, 'sr');
    expect(result).not.toBeNull();
    expect(result?.path).toBe('2026/09/photo.webp');
    expect(result?.width).toBe(1600);
  });

  it('reports missing alt text as absent, not as a missing image', () => {
    const result = flattenMedia(untranslated, 'sr');
    expect(result?.alt).toBeNull();
    expect(result?.caption).toBeNull();
  });

  it('uses the requested language when it exists', () => {
    const media = {
      ...untranslated,
      translations: [
        { locale: 'sr', alt: 'Dalekovod', caption: 'Beograd' },
        { locale: 'en', alt: 'Power line', caption: 'Belgrade' },
      ],
    };
    expect(flattenMedia(media, 'en')?.alt).toBe('Power line');
    expect(flattenMedia(media, 'sr')?.alt).toBe('Dalekovod');
  });

  it('falls back to the default language rather than dropping the image', () => {
    const media = {
      ...untranslated,
      translations: [{ locale: 'sr', alt: 'Samo srpski', caption: null }],
    };
    expect(flattenMedia(media, 'en')?.alt).toBe('Samo srpski');
  });

  it('still returns null for no media at all', () => {
    expect(flattenMedia(null, 'sr')).toBeNull();
  });

  it('contrasts with flattenEntity, which correctly discards untranslated content', () => {
    // Content without a title in any language is not publishable; an image
    // without alt text still is. Two rules, deliberately.
    expect(flattenEntity(untranslated, 'sr')).toBeNull();
    expect(pickTranslation(untranslated.translations, 'sr')).toBeUndefined();
  });
});
