/**
 * Works out what a file actually is, from its bytes.
 *
 * The browser's Content-Type and the filename extension are both supplied by
 * whoever is uploading, so neither is evidence of anything. Everything here
 * reads the file itself.
 *
 * The awkward case is Word. A .docx IS a ZIP archive — same PK\x03\x04
 * signature as any other zip — so "block zip files, allow Word documents"
 * cannot be decided from the signature alone. Rejecting the zip magic would
 * reject Word too; accepting .docx by extension would let any renamed archive
 * straight through. The only honest answer is to open the archive and check
 * it contains what an Office Open XML word document must contain.
 */

export type MediaKind = 'image' | 'document';

export interface SniffResult {
  kind: MediaKind;
  mimeType: string;
  extension: string;
}

const PDF_SIGNATURE = Buffer.from('%PDF-');
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** An OLE2 compound file: legacy .doc, but also .xls and .msi. */
const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

function startsWith(buffer: Buffer, signature: Buffer): boolean {
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);
}

/** Stop after this many entries — enough to see what an Office file is. */
const MAX_ENTRIES_SCANNED = 64;

/**
 * Reads the entry names out of a zip archive.
 *
 * Only the NAMES are readable without decompressing: each local file header
 * stores its own filename in the clear, while the content is deflated. An
 * earlier version of this check scanned the raw bytes for "wordprocessingml"
 * and failed on every real document, because that string lives inside the
 * compressed content of [Content_Types].xml where no byte scan can see it.
 *
 * Walking the headers needs each entry's compressed size to find the next
 * one. When general-purpose bit 3 is set the sizes live in a trailing data
 * descriptor instead, and the walk cannot continue — so it stops and returns
 * what it has, which is still the first entry's name.
 */
function zipEntryNames(buffer: Buffer): string[] {
  const names: string[] = [];
  let offset = 0;

  while (names.length < MAX_ENTRIES_SCANNED && offset + 30 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;

    const flags = buffer.readUInt16LE(offset + 6);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);

    const nameStart = offset + 30;
    if (nameStart + nameLength > buffer.length) break;
    names.push(buffer.subarray(nameStart, nameStart + nameLength).toString('latin1'));

    // Bit 3: sizes are unknown here and written after the data.
    if ((flags & 0x08) !== 0) break;

    offset = nameStart + nameLength + extraLength + compressedSize;
  }

  return names;
}

/**
 * Whether a zip archive is an Office Open XML word document.
 *
 * Decided by what it contains rather than what it claims: a .docx carries
 * `word/document.xml`. A spreadsheet carries `xl/`, a presentation `ppt/`,
 * and a holiday photo archive carries neither — all three are refused.
 *
 * This is looking for a reason to ACCEPT, so the failure modes are the right
 * way round: a false negative rejects a genuine document, which is annoying
 * and recoverable, while a false positive would require building an archive
 * that really does contain a Word document part.
 */
function looksLikeDocx(buffer: Buffer): boolean {
  const names = zipEntryNames(buffer);
  if (names.length === 0) return false;
  if (names.some((name) => name.startsWith('xl/') || name.startsWith('ppt/'))) return false;
  return names.some((name) => name === 'word/document.xml' || name.startsWith('word/'));
}

/**
 * Identifies a document, or returns null when the bytes are not one of the
 * formats we accept. Images are not handled here — sharp decides those by
 * decoding them, which is a stronger check than any signature.
 */
export function sniffDocument(buffer: Buffer): SniffResult | null {
  if (startsWith(buffer, PDF_SIGNATURE)) {
    return { kind: 'document', mimeType: 'application/pdf', extension: 'pdf' };
  }

  if (startsWith(buffer, ZIP_SIGNATURE) && looksLikeDocx(buffer)) {
    return {
      kind: 'document',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
    };
  }

  return null;
}

/**
 * Why a rejected file was rejected.
 *
 * "Format nije podržan" for a .zip that the user believes is a Word document
 * is a dead end. Naming what the bytes actually are gives them something to
 * act on.
 */
export function describeRejection(buffer: Buffer): string {
  if (startsWith(buffer, ZIP_SIGNATURE)) {
    return (
      'Fajl je ZIP arhiva. Word dokumenti (.docx) jesu ZIP arhive, ali ova ne ' +
      'sadrži Word sadržaj — ako ste preimenovali arhivu u .docx, otpremite ' +
      'pravi dokument.'
    );
  }
  if (startsWith(buffer, OLE_SIGNATURE)) {
    return (
      'Stari Word format (.doc) nije podržan jer se po sadržaju ne razlikuje ' +
      'od .xls ili .msi instalacije. Sačuvajte dokument kao .docx ili .pdf.'
    );
  }
  if (startsWith(buffer, Buffer.from('MZ'))) {
    return 'Izvršni fajlovi (.exe) se ne mogu otpremiti.';
  }
  return 'Dozvoljene su slike, PDF i Word (.docx) dokumenti.';
}
