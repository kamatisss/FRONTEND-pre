import { MEDIA_BASE_URL as MEDIA_ROOT } from '../config';
// A product's picture URL: the uploaded photo (or one rendered from its 3D model) first,
// else its image link. Relative paths are served by the backend media server.
const MEDIA_BASE_URL = MEDIA_ROOT;

export function productImage(product) {
  const raw = product?.thumbnail || product?.image_url;
  if (!raw) return null;
  if (/^https?:\/\//.test(raw)) return raw;
  return `${MEDIA_BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
}
