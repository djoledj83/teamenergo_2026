import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { describeRejection, sniffDocument } from './sniff.js';

/**
 * These tests exist because "allow Word, block zip" is not a distinction the
 * file signature can make — a .docx IS a zip. Each case below is a file
 * somebody could plausibly upload, and the assertion is which side of that
 * line it falls on.
 */

/** A minimal zip containing the given entries, built the way a real one is:
 *  names stored in the clear, contents deflated. */
function zipWith(entries: Array<[name: string, content: string]>): Buffer {
  const parts: Buffer[] = [];

  for (const [entryName, content] of entries) {
    const name = Buffer.from(entryName, 'latin1');
    const data = deflateRawSync(Buffer.from(content, 'latin1'));

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0, 6); // flags — sizes known, no data descriptor
    header.writeUInt16LE(8, 8); // deflate
    header.writeUInt32LE(0, 14); // crc (not validated here)
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(content.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);

    parts.push(header, name, data);
  }

  return Buffer.concat(parts);
}

/** What a real .docx looks like from the outside: the content types part,
 *  then the word/ tree. The schema string lives inside compressed content and
 *  is deliberately NOT relied on. */
const docx = () =>
  zipWith([
    ['[Content_Types].xml', '<?xml version="1.0"?><Types/>'],
    ['_rels/.rels', '<Relationships/>'],
    ['word/document.xml', '<w:document><w:body/></w:document>'],
  ]);

describe('sniffDocument', () => {
  it('accepts a PDF', () => {
    const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64)]);
    expect(sniffDocument(pdf)).toEqual({
      kind: 'document',
      mimeType: 'application/pdf',
      extension: 'pdf',
    });
  });

  it('accepts a Word document', () => {
    const result = sniffDocument(docx());
    expect(result?.extension).toBe('docx');
    expect(result?.mimeType).toContain('wordprocessingml');
  });

  // The case the whole module exists for.
  it('rejects a plain zip, which carries the same signature as Word', () => {
    const archive = zipWith([['holiday-photos/IMG_001.jpg', 'binary-ish'], ['notes.txt', 'hello']]);
    expect(sniffDocument(archive)).toBeNull();
  });

  it('rejects a spreadsheet, which is also Office XML in a zip', () => {
    const xlsx = zipWith([
      ['[Content_Types].xml', '<Types/>'],
      ['xl/workbook.xml', '<workbook/>'],
    ]);
    expect(sniffDocument(xlsx)).toBeNull();
  });

  it('rejects an executable', () => {
    expect(sniffDocument(Buffer.from('MZ\x90\x00\x03\x00\x00\x00'))).toBeNull();
  });

  it('rejects a legacy .doc, which shares its container with .xls and .msi', () => {
    const ole = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(64),
    ]);
    expect(sniffDocument(ole)).toBeNull();
  });

  it('rejects a file that merely claims to be a PDF further in', () => {
    expect(sniffDocument(Buffer.from('GIF89a %PDF- trailing'))).toBeNull();
  });

  it('handles an empty or truncated file without throwing', () => {
    expect(() => sniffDocument(Buffer.alloc(0))).not.toThrow();
    expect(sniffDocument(Buffer.alloc(0))).toBeNull();
    expect(sniffDocument(Buffer.from('%PD'))).toBeNull();
  });
});

describe('describeRejection', () => {
  it('explains the zip case specifically, since it is the confusing one', () => {
    const message = describeRejection(zipWith([['stuff/thing.bin', 'x']]));
    expect(message).toContain('ZIP');
    expect(message).toContain('.docx');
  });

  it('tells a .doc user what to do instead', () => {
    const ole = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(8),
    ]);
    expect(describeRejection(ole)).toContain('.docx');
  });

  it('names executables plainly', () => {
    expect(describeRejection(Buffer.from('MZ\x90\x00'))).toContain('.exe');
  });

  it('falls back to listing what is allowed', () => {
    expect(describeRejection(Buffer.from('random bytes'))).toContain('PDF');
  });
});
