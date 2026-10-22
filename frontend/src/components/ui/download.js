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
