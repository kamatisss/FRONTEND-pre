/**
 * What a picked file really is, read from its first bytes, so a renamed file can't fool it, plus the
 * picker filters every upload uses. Mirrors BACKEND apps/library/file_checks.py, which checks again: these
 * only spare people a slow upload that would be refused anyway.
 *
 * Picker filters (`accept`) are only a hint: "All files" in the dialog and drag-and-drop both get round
 * them, so every handler still calls a check below.
 */

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
export const DOCUMENT_ACCEPT = '.pdf,application/pdf,image/jpeg,image/png,image/webp';

// Phones and tablets don't know the .glb type: filtering the picker to .glb there greys out real models
// too. So the 3D model picker is filtered on computers only (the file is checked after it's picked anyway).
const touchDevice = typeof navigator !== 'undefined' && (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));   // iPadOS reports itself as a Mac
export const MODEL_ACCEPT = touchDevice ? undefined : '.glb,model/gltf-binary';

const extOf = (name) => (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
const mb = (bytes) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** 'jpeg' | 'png' | 'webp' | 'pdf' | 'heic' | 'glb' | 'gif' | 'other' */
export async function sniff(file) {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const text = (from, to) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && text(1, 4) === 'PNG') return 'png';
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'webp';
  if (text(0, 5) === '%PDF-') return 'pdf';
  if (text(4, 8) === 'ftyp' && /^(heic|heix|mif1|msf1|hevc|heim|heis)$/.test(text(8, 12))) return 'heic';
  if (text(0, 4) === 'glTF') return 'glb';
  if (text(0, 3) === 'GIF') return 'gif';
  return 'other';
}

function notAPhoto(kind, file) {
  if (kind === 'heic') return 'This is an iPhone HEIC photo. Choose it from the Photos app (it’s converted for you), or use a JPG.';
  if (kind === 'pdf') return 'This is a PDF, not a photo. Upload a JPG, PNG or WebP image.';
  if (kind === 'gif') return 'GIF images aren’t supported. Upload a JPG, PNG or WebP image.';
  const ext = extOf(file.name);
  return `Only photos can be uploaded (JPG, PNG or WebP)${ext ? `. This is a .${ext} file.` : '.'}`;
}

/** null if `file` is a real JPG/PNG/WebP photo under the size limit, else what's wrong, in one sentence. */
export async function photoProblem(file, maxMB = 15) {
  if (!file) return 'Choose a photo.';
  const kind = await sniff(file);
  if (!['jpeg', 'png', 'webp'].includes(kind)) return notAPhoto(kind, file);
  if (file.size > maxMB * 1024 * 1024) return `This photo is ${mb(file.size)}; the limit is ${maxMB} MB. Use a smaller one.`;
  return null;
}

/** null if `file` is a real PDF or photo (business credentials), with a name that matches what it is. */
export async function documentProblem(file, maxMB = 10) {
  if (!file) return 'Choose a file.';
  const kind = await sniff(file);
  const namedPdf = extOf(file.name) === 'pdf';
  if (kind === 'pdf') {
    if (!namedPdf) return 'This file is a PDF but its name says otherwise. Rename it to end in .pdf.';
  } else if (['jpeg', 'png', 'webp'].includes(kind)) {
    if (namedPdf) return 'This file is a photo but its name ends in .pdf. Rename it (e.g. .jpg).';
  } else {
    return 'Only a PDF or a photo (JPG, PNG or WebP) of the document can be uploaded.';
  }
  if (file.size > maxMB * 1024 * 1024) return `This file is ${mb(file.size)}; the limit is ${maxMB} MB.`;
  return null;
}
