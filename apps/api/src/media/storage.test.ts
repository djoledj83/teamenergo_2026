import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';

const uploadDir = mkdtempSync(join(tmpdir(), 'teamenergo-uploads-'));

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-to-pass-validation';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-long-enough-to-pass';
process.env.UPLOAD_DIR = uploadDir;
process.env.MAX_IMAGE_MB = '5';
process.env.MAX_DOCUMENT_MB = '10';

const { deleteStoredImage, resolveUploadPath, storeImage, storeUpload } = await import(
  './storage.js'
);

async function makeImage(width: number, height = width, format: 'png' | 'jpeg' = 'png') {
  const image = sharp({
    create: { width, height, channels: 3, background: { r: 20, g: 120, b: 200 } },
  });
  return format === 'png' ? image.png().toBuffer() : image.jpeg().toBuffer();
}

afterAll(() => {
  // The temp directory is disposable; leaving it is harmless.
});

describe('resolveUploadPath', () => {
  it('resolves a normal path inside the upload directory', () => {
    expect(resolveUploadPath('2026/09/a.webp')).toBe(join(uploadDir, '2026/09/a.webp'));
  });

  it('refuses to escape the upload directory', () => {
    // The classic upload bug. Nothing should ever reach here with a relative
    // path, but the check is the reason that stays true.
    expect(() => resolveUploadPath('../../etc/passwd')).toThrow();
    expect(() => resolveUploadPath('2026/../../../secret')).toThrow();
    expect(() => resolveUploadPath('/etc/passwd')).toThrow();
  });
});

describe('storeImage', () => {
  it('stores an image and reports its dimensions', async () => {
    const stored = await storeImage(await makeImage(200, 100), 'photo.png');
    expect(stored.width).toBe(200);
    expect(stored.height).toBe(100);
    expect(existsSync(join(uploadDir, stored.path))).toBe(true);
  });

  it('ignores the uploaded filename entirely', async () => {
    const stored = await storeImage(await makeImage(100), '../../evil.png');
    expect(stored.filename).not.toContain('evil');
    expect(stored.filename).not.toContain('..');
    expect(stored.path).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]+\.webp$/);
  });

  it('converts to WebP regardless of input format', async () => {
    const stored = await storeImage(await makeImage(300, 300, 'jpeg'), 'photo.jpg');
    expect(stored.mimeType).toBe('image/webp');
    expect(stored.filename.endsWith('.webp')).toBe(true);
  });

  it('rejects bytes that are not an image, whatever they are named', async () => {
    const script = Buffer.from('<?php system($_GET["c"]); ?>', 'utf8');
    await expect(storeImage(script, 'innocent.jpg')).rejects.toThrow();
  });

  it('rejects an empty file', async () => {
    await expect(storeImage(Buffer.alloc(0), 'empty.png')).rejects.toThrow();
  });

  it('enforces the size limit', async () => {
    const tooBig = Buffer.alloc(6 * 1024 * 1024, 1);
    await expect(storeImage(tooBig, 'big.png')).rejects.toThrow(/5 MB/);
  });

  it('generates only the variants smaller than the source', async () => {
    const stored = await storeImage(await makeImage(1000, 1000), 'medium.png');
    // Source is 1000px: 400 and 800 are useful, 1600 would be an upscale.
    expect(stored.variants.map((v) => v.width)).toEqual([400, 800]);
    for (const variant of stored.variants) {
      expect(existsSync(join(uploadDir, variant.path))).toBe(true);
    }
  });

  it('generates no variants for an image smaller than every breakpoint', async () => {
    const stored = await storeImage(await makeImage(120), 'logo.png');
    expect(stored.variants).toEqual([]);
  });

  it('actually resizes the variants', async () => {
    const stored = await storeImage(await makeImage(1200, 600), 'wide.png');
    const variant = stored.variants.find((v) => v.width === 400);
    expect(variant).toBeDefined();
    const meta = await sharp(readFileSync(join(uploadDir, variant!.path))).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(200); // aspect ratio preserved
  });

  it('strips EXIF, so GPS coordinates in site photos are not published', async () => {
    const withExif = await sharp({
      create: { width: 500, height: 500, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .withMetadata({ exif: { IFD0: { Copyright: 'Teamenergo', Software: 'test' } } })
      .jpeg()
      .toBuffer();

    // Confirm the fixture really carries EXIF before asserting it is gone.
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const stored = await storeImage(withExif, 'site.jpg');
    const output = await sharp(readFileSync(join(uploadDir, stored.path))).metadata();
    expect(output.exif).toBeUndefined();
  });

  it('keeps SVG as-is rather than rasterising it', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>',
    );
    const stored = await storeImage(svg, 'logo.svg');
    expect(stored.mimeType).toBe('image/svg+xml');
    expect(stored.variants).toEqual([]);
  });

  it('groups uploads into year/month folders', async () => {
    const stored = await storeImage(await makeImage(100), 'x.png');
    const now = new Date();
    const expected = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(stored.path.startsWith(expected)).toBe(true);
  });
});

describe('deleteStoredImage', () => {
  it('removes the original and every variant', async () => {
    const stored = await storeImage(await makeImage(1000, 1000), 'doomed.png');
    const paths = [stored.path, ...stored.variants.map((v) => v.path)];
    expect(paths.every((p) => existsSync(join(uploadDir, p)))).toBe(true);

    await deleteStoredImage(stored.path, stored.variants);
    expect(paths.some((p) => existsSync(join(uploadDir, p)))).toBe(false);
  });

  it('does not throw when the file is already gone', async () => {
    // Otherwise a record whose file vanished could never be deleted.
    await expect(deleteStoredImage('2026/01/missing.webp', [])).resolves.toBeUndefined();
  });
});

/**
 * storeUpload is the routing decision: real bytes in, the right pipeline
 * chosen. The sniffer is tested on its own in sniff.test.ts; these cases
 * check that images still reach sharp, documents skip it, and everything
 * else is refused before anything is written to disk.
 */
describe('storeUpload', () => {
  it('sends a real image through the image pipeline', async () => {
    const stored = await storeUpload(await makeImage(120), 'photo.png');
    expect(stored.kind).toBe('image');
    expect(stored.mimeType).toBe('image/webp');
    expect(stored.width).toBe(120);
    expect(existsSync(resolveUploadPath(stored.path))).toBe(true);
  });

  it('stores a PDF byte-for-byte, without dimensions or variants', async () => {
    const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('content here')]);
    const stored = await storeUpload(pdf, 'ponuda.pdf');

    expect(stored.kind).toBe('document');
    expect(stored.mimeType).toBe('application/pdf');
    expect(stored.width).toBeNull();
    expect(stored.variants).toEqual([]);
    // Unlike an image, the file is not re-encoded.
    expect(readFileSync(resolveUploadPath(stored.path))).toEqual(pdf);
  });

  it('names the stored file after what the bytes are, not the upload name', async () => {
    const pdf = Buffer.from('%PDF-1.4\nx');
    const stored = await storeUpload(pdf, 'definitely-a-photo.jpg');
    expect(stored.path.endsWith('.pdf')).toBe(true);
  });

  it('refuses an executable', async () => {
    await expect(storeUpload(Buffer.from('MZ\x90\x00\x03'), 'setup.exe')).rejects.toThrow();
  });

  it('refuses a zip even when it is named .docx', async () => {
    const zip = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.alloc(40),
    ]);
    await expect(storeUpload(zip, 'report.docx')).rejects.toThrow();
  });

  it('enforces the image limit separately from the document limit', async () => {
    // MAX_IMAGE_MB is 5 here; a PNG of random noise resists compression.
    const noise = Buffer.alloc(3000 * 3000 * 3);
    for (let i = 0; i < noise.length; i += 1) noise[i] = (i * 7919) % 256;
    const huge = await sharp(noise, { raw: { width: 3000, height: 3000, channels: 3 } })
      .png({ compressionLevel: 0 })
      .toBuffer();

    expect(huge.length).toBeGreaterThan(5 * 1024 * 1024);
    await expect(storeUpload(huge, 'huge.png')).rejects.toThrow(/5 MB/);
  });
});
