/* Download a file from an authenticated API endpoint (CSV exports, PDF job sheets).
   A plain <a href> can't send the Bearer token, so fetch it and save the blob.
   Returns an error message, or null on success. */
export async function downloadWithAuth(url, headers, fallbackName) {
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) return r.status === 403 ? 'Only the office can download this.' : 'Could not prepare the download.';
    const name = /filename="?([^";]+)"?/.exec(r.headers.get('Content-Disposition') || '')?.[1] || fallbackName;
    const href = URL.createObjectURL(await r.blob());
    const a = Object.assign(document.createElement('a'), { href, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
    return null;
  } catch {
    return 'Network error. Please try again.';
  }
}

// Save a Blob made in the browser (e.g. a .glb garden) on the device: phones put it in Downloads / Files
export function saveBlob(blob, fileName) {
  const href = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href, download: fileName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);   // iOS reads it after the click returns
}

// ("Lush Tropical", "before-after", "jpg") → "lush-tropical-garden-before-after.jpg"
export function designFileName(title, suffix, ext) {
  const slug = String(title || 'garden').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'garden';
  return `${slug}${slug.endsWith('garden') ? '' : '-garden'}${suffix ? `-${suffix}` : ''}.${ext}`;
}

// "Lush Tropical" → "lush-tropical-garden.glb"
export const glbFileName = (title) => designFileName(title, '', 'glb');

// "3.4 MB"
export const fileSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
