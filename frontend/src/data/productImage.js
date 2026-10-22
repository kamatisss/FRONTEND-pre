// A product's picture URL: the uploaded photo (or one rendered from its 3D model) first,
// else its image link. Relative paths are served by the backend media server.
const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000';

export function productImage(product) {
  const raw = product?.thumbnail || product?.image_url;
  if (!raw) return null;
  if (/^https?:\/\//.test(raw)) return raw;
  return `${MEDIA_BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
}
