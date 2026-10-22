// Shrink a phone photo before uploading it from the field: longest side ≤ 1600 px, JPEG ~80 %.
// A 4–10 MB camera photo becomes ~250–500 KB, so it goes through on weak mobile data.
// The camera's rotation is kept (createImageBitmap reads EXIF orientation). The server still
// re-encodes and strips all metadata (GPS) — this only saves the crew's data and time.

const MAX_SIDE = 1600;
const QUALITY = 0.8;
const SMALL_ENOUGH = 600 * 1024;   // already-small JPEGs are sent as they are

export async function compressImage(file) {
  if (!file || !/^image\//.test(file.type) || file.type === 'image/gif') return file;
  if (file.type === 'image/jpeg' && file.size <= SMALL_ENOUGH) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file;   // never make it bigger
    return new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;   // an unusual format the browser can't decode: let the server deal with it
  }
}
