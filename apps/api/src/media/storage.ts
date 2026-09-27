import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import { env } from '../env.js';
import { HttpError } from '../errors.js';
import { logger } from '../logger.js';
import { describeRejection, sniffDocument, type MediaKind } from './sniff.js';

/**
 * Image ingestion.
 *
 * Two rules drive everything here:
 *
 *  1. The uploaded filename is never used. It is attacker-controlled and the
 *     source of every path-traversal bug in every upload feature ever written.
 *     A UUID is generated instead and the original is kept only as a label.
 *
 *  2. The declared Content-Type is never trusted either. The bytes are decoded
 *     by sharp, and a file that does not decode as an image is rejected — so
 *     a script renamed to .jpg cannot get in.
 */

/** Formats sharp can decode and we are willing to store. */
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'gif', 'tiff', 'svg']);

/** Widths generated for responsive rendering. Larger ones are skipped. */
const VARIANT_WIDTHS = [400, 800, 1600] as const;

export interface StoredVariant {
  width: number;
  path: string;
}

export interface StoredImage {
  filename: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  variants: StoredVariant[];
}

/** A document has no dimensions and no renditions; the shape is shared so
 *  callers store both the same way. */
export type StoredFile = StoredImage & { kind: MediaKind };

/**
 * Resolves a path inside the upload directory, refusing anything that escapes
 * it. Defence in depth — callers already pass generated names.
 */
export function resolveUploadPath(relativePath: string): string {
  const root = resolve(env.UPLOAD_DIR);
  const target = resolve(root, normalize(relativePath));
  if (target !== root && !target.startsWith(root + sep)) {
    throw HttpError.badRequest('Neispravna putanja fajla');
  }
  return target;
}

async function writeInsideUploads(relativePath: string, data: Buffer): Promise<void> {
  const target = resolveUploadPath(relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
}

/** Groups uploads by year/month so no single directory grows without bound. */
function folderForToday(): string {
  const now = new Date();
  return join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
}

/**
 * `_originalName` is accepted but deliberately unused: keeping it in the
 * signature documents that the caller's filename is known and discarded
 * rather than forgotten. It is stored separately as a display label only.
 */
export async function storeImage(buffer: Buffer, _originalName: string): Promise<StoredImage> {
  const maxBytes = env.MAX_IMAGE_MB * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw HttpError.badRequest(`Slika je veća od ${env.MAX_IMAGE_MB} MB`);
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw HttpError.badRequest('Fajl nije prepoznat kao slika');
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw HttpError.badRequest('Format slike nije podržan');
  }

  const id = randomUUID();
  const folder = folderForToday();

  // SVG is markup, not raster data: it can carry scripts, so it is stored
  // as-is and never rasterised or re-encoded, and callers should serve it
  // with a restrictive Content-Security-Policy.
  if (metadata.format === 'svg') {
    const filename = `${id}.svg`;
    const relativePath = join(folder, filename);
    await writeInsideUploads(relativePath, buffer);
    return {
      filename,
      path: relativePath.split(sep).join('/'),
      mimeType: 'image/svg+xml',
      sizeBytes: buffer.length,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      variants: [],
    };
  }

  // Re-encoding to WebP also strips EXIF, which routinely carries GPS
  // coordinates from site photographs taken on a phone.
  const original = await sharp(buffer).rotate().webp({ quality: 88 }).toBuffer();
  const originalMeta = await sharp(original).metadata();

  const filename = `${id}.webp`;
  const relativePath = join(folder, filename);
  await writeInsideUploads(relativePath, original);

  const variants: StoredVariant[] = [];
  const sourceWidth = originalMeta.width ?? 0;

  for (const width of VARIANT_WIDTHS) {
    // Never upscale — a 400px logo gains nothing from a 1600px "variant".
    if (sourceWidth <= width) continue;
    const variantName = `${id}-${width}.webp`;
    const variantPath = join(folder, variantName);
    const resized = await sharp(original).resize({ width }).webp({ quality: 82 }).toBuffer();
    await writeInsideUploads(variantPath, resized);
    variants.push({ width, path: variantPath.split(sep).join('/') });
  }

  return {
    filename,
    path: relativePath.split(sep).join('/'),
    mimeType: 'image/webp',
    sizeBytes: original.length,
    width: originalMeta.width ?? null,
    height: originalMeta.height ?? null,
    variants,
  };
}

/**
 * Stores a PDF or Word document.
 *
 * Kept byte-for-byte: unlike an image there is nothing safe to re-encode, and
 * rewriting a document would change the file the client uploaded. Safety is
 * therefore entirely at the two ends — the bytes are identified before the
 * file is written, and it is served as a download rather than rendered.
 *
 * The extension comes from what the bytes turned out to be, not from the
 * uploaded filename, so a mislabelled file is stored under its real type.
 */
export async function storeDocument(buffer: Buffer, _originalName: string): Promise<StoredFile> {
  const maxBytes = env.MAX_DOCUMENT_MB * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw HttpError.badRequest(`Dokument je veći od ${env.MAX_DOCUMENT_MB} MB`);
  }

  const sniffed = sniffDocument(buffer);
  if (!sniffed) throw HttpError.badRequest(describeRejection(buffer));

  const filename = `${randomUUID()}.${sniffed.extension}`;
  const relativePath = join(folderForToday(), filename);
  await writeInsideUploads(relativePath, buffer);

  return {
    kind: 'document',
    filename,
    path: relativePath.split(sep).join('/'),
    mimeType: sniffed.mimeType,
    sizeBytes: buffer.length,
    width: null,
    height: null,
    variants: [],
  };
}

/**
 * Routes an upload to the right pipeline.
 *
 * Images are tried first, because sharp decoding the bytes is a stronger
 * check than any signature match: a file that decodes as an image is one.
 * Anything sharp cannot read is offered to the document sniffer, and what
 * neither accepts is rejected with a reason naming what it appeared to be.
 */
export async function storeUpload(buffer: Buffer, originalName: string): Promise<StoredFile> {
  let isImage = false;
  try {
    const metadata = await sharp(buffer).metadata();
    isImage = Boolean(metadata.format && ALLOWED_FORMATS.has(metadata.format));
  } catch {
    isImage = false;
  }

  if (isImage) {
    const stored = await storeImage(buffer, originalName);
    return { ...stored, kind: 'image' };
  }

  return storeDocument(buffer, originalName);
}

/**
 * Deletes a stored image and its variants.
 *
 * A missing file is not an error: the database row is the source of truth, and
 * refusing to delete it because the file already vanished would leave a
 * permanently undeletable record.
 */
export async function deleteStoredImage(
  path: string,
  variants: readonly StoredVariant[],
): Promise<void> {
  for (const candidate of [path, ...variants.map((v) => v.path)]) {
    try {
      await unlink(resolveUploadPath(candidate));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        logger.warn({ err: error, path: candidate }, 'failed to delete media file');
      }
    }
  }
}

export async function ensureUploadDir(): Promise<void> {
  await mkdir(resolve(env.UPLOAD_DIR), { recursive: true });
}
