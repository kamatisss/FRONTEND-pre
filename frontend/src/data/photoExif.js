/*
 * The lens a photo was taken with, from its EXIF: FocalLengthIn35mmFilm (tag 0xA405), which phones
 * write. The photo overlay uses it to place the camera (data/photoPose.js). Anything unreadable
 * (not a JPEG, no EXIF, a screenshot, an edited copy) gives null and the overlay assumes a typical
 * phone lens instead. Reads only the start of the file.
 */
const HEAD_BYTES = 256 * 1024;

export async function readFocal35(file) {
  try {
    const buf = await file.slice(0, HEAD_BYTES).arrayBuffer();
    return focal35FromJpeg(new DataView(buf));
  } catch {
    return null;
  }
}

export function focal35FromJpeg(view) {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;   // JPEG start of image
  let at = 2;
  while (at + 4 <= view.byteLength) {
    const marker = view.getUint16(at);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null;    // lost, or image data reached
    const size = view.getUint16(at + 2);
    if (marker === 0xffe1 && at + 10 <= view.byteLength && view.getUint32(at + 4) === 0x45786966) {   // "Exif"
      return fromTiff(view, at + 10, Math.min(view.byteLength, at + 2 + size));
    }
    at += 2 + size;
  }
  return null;
}

function fromTiff(view, base, end) {
  const order = view.getUint16(base);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const le = order === 0x4949;
  const u16 = (o) => (o + 2 <= end ? view.getUint16(o, le) : null);
  const u32 = (o) => (o + 4 <= end ? view.getUint32(o, le) : null);
  const findTag = (ifd, tag) => {
    const n = u16(ifd);
    if (n == null) return null;
    for (let i = 0; i < n; i++) {
      const entry = ifd + 2 + i * 12;
      if (u16(entry) === tag) return entry;
    }
    return null;
  };
  const ifd0 = u32(base + 4);
  if (ifd0 == null) return null;
  const exifPointer = findTag(base + ifd0, 0x8769);
  const exifOffset = exifPointer != null ? u32(exifPointer + 8) : null;
  if (exifOffset == null) return null;
  const entry = findTag(base + exifOffset, 0xa405);
  const value = entry != null ? u16(entry + 8) : null;   // SHORT, stored in the entry itself
  return value >= 10 && value <= 300 ? value : null;     // 0 means "unknown"
}
