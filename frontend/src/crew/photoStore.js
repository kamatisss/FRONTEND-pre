/*
 * Photos taken with no signal (PWA phase 3), kept on the phone until they are sent.
 * The outbox (outbox.js) holds the small description in localStorage; the picture itself is too big
 * for that, so it lives here in IndexedDB under the same id. Every call fails soft: if this phone
 * won't store anything (private mode, storage full) putPhoto answers false and the caller keeps the
 * photo in memory instead.
 */
const DB_NAME = 'gs-crew';
const STORE = 'photos';

let opening = null;
function db() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((e) => { opening = null; throw e; });
  }
  return opening;
}

async function run(mode, fn) {
  const conn = await db();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Keep a photo under this id. Resolves true when it is safely stored. */
export async function putPhoto(id, blob) {
  try { await run('readwrite', (s) => s.put(blob, id)); return true; } catch { return false; }
}

/** The stored photo, or null. */
export async function getPhoto(id) {
  try { return (await run('readonly', (s) => s.get(id))) || null; } catch { return null; }
}

export async function removePhoto(id) {
  try { await run('readwrite', (s) => s.delete(id)); } catch { /* nothing to remove */ }
}

export async function clearPhotos() {
  try { await run('readwrite', (s) => s.clear()); } catch { /* nothing kept */ }
}
