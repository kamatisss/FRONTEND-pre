/**
 * Shrink a .glb in the browser before it's uploaded (Inventory → 3D model → Upload from device).
 *
 * The same two passes as scripts/optimize-models.md, so staff never run them by hand:
 *   1. Geometry: clean-up (dedup, instance, join, weld, prune…) + Meshopt compression. No simplify,
 *      so thin leaves stay intact.
 *   2. Textures: PNG/JPEG → WebP, at most 1024 px. Normal / roughness / occlusion maps get higher quality.
 *      Any texture that fails, or isn't smaller as WebP, is kept as it was.
 * The 3D Studio decodes Meshopt and WebP (ThreeGardenCanvas.jsx, modelThumbnail.js).
 *
 * Loaded on demand (dynamic import) so the ~300 KB of glTF-Transform + meshoptimizer code only downloads
 * when someone actually uploads a model.
 */

const MAX_TEXTURE = 1024;

async function toWebP(bytes, mimeType, quality) {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }),
    { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const scale = Math.min(1, MAX_TEXTURE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
  let blob;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  } else {
    const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  }
  bitmap.close?.();
  // Browsers without WebP encoding (older Safari) hand back a PNG instead: not useful, keep the original
  return blob && blob.type === 'image/webp' ? new Uint8Array(await blob.arrayBuffer()) : null;
}

/**
 * @param {File} file  a .glb
 * @param {(step: 'loading'|'shapes'|'textures'|'packing') => void} [onStep]
 * @returns {Promise<{ file: File, before: number, after: number, textures: number }>}
 *   `file` is the smaller of the original and the compressed version.
 * Throws an Error with a plain message when the model can't be read (e.g. Draco-compressed).
 */
export async function compressModel(file, onStep) {
  onStep?.('loading');
  const [{ WebIO, Logger }, { ALL_EXTENSIONS, EXTTextureWebP }, fn, { MeshoptDecoder, MeshoptEncoder }] = await Promise.all([
    import('@gltf-transform/core'), import('@gltf-transform/extensions'),
    import('@gltf-transform/functions'), import('meshoptimizer'),
  ]);
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new WebIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

  const input = new Uint8Array(await file.arrayBuffer());
  let doc;
  try {
    doc = await io.readBinary(input);
  } catch (err) {
    const text = String(err?.message || err);
    throw new Error(/draco/i.test(text)
      ? 'This model uses Draco compression, which the 3D Studio can’t open. In Blender, export it again with “Compression” turned off.'
      : 'This model couldn’t be read. Export it again as glTF Binary (.glb).');
  }

  onStep?.('shapes');
  await doc.transform(
    fn.dedup(), fn.instance({ min: 5 }), fn.flatten(), fn.join(), fn.weld(), fn.resample(), fn.prune(),
    fn.sparse({ ratio: 0.2 }),
  );

  onStep?.('textures');
  const dataMaps = new Set();
  for (const mat of doc.getRoot().listMaterials()) {
    for (const t of [mat.getNormalTexture(), mat.getMetallicRoughnessTexture(), mat.getOcclusionTexture()]) if (t) dataMaps.add(t);
  }
  let textures = 0;
  for (const tex of doc.getRoot().listTextures()) {
    const image = tex.getImage();
    const mime = tex.getMimeType();
    if (!image || !/^image\/(png|jpeg)$/.test(mime)) continue;
    try {
      const webp = await toWebP(image, mime, dataMaps.has(tex) ? 0.92 : 0.82);
      if (webp && webp.byteLength < image.byteLength) {
        tex.setImage(webp).setMimeType('image/webp');
        if (tex.getURI()) tex.setURI(tex.getURI().replace(/\.(png|jpe?g)$/i, '.webp'));
        textures++;
      }
    } catch { /* keep this texture as it was */ }
  }
  if (textures) doc.createExtension(EXTTextureWebP).setRequired(true);

  onStep?.('packing');
  await doc.transform(fn.meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const output = await io.writeBinary(doc);

  const smaller = output.byteLength < input.byteLength;
  return {
    file: smaller ? new File([output], file.name, { type: 'model/gltf-binary' }) : file,
    before: input.byteLength,
    after: Math.min(output.byteLength, input.byteLength),
    textures: smaller ? textures : 0,
  };
}

/**
 * A firm one-line "no" for a file that isn't a .glb, plus (for other 3D formats) how to convert it, shown
 * behind a "How to convert it" toggle. null when the name ends in .glb.
 * @returns {null | { message: string, howTo: string | null }}
 */
export function formatAdvice(fileName) {
  const ext = (fileName.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  if (ext === 'glb') return null;
  const exportStep = 'File → Export → glTF 2.0, and set Format to “glTF Binary (.glb)”';
  const message = `Only .glb 3D models can be uploaded${ext ? `. This is a .${ext} file` : ''}.`;
  if (ext === 'gltf') return { message, howTo: `A .gltf keeps its textures in separate files. Open it in Blender (free), then ${exportStep}.` };
  if (ext === 'blend') return { message, howTo: `Open it in Blender, then ${exportStep}.` };
  if (['fbx', 'obj', 'dae', 'stl', '3ds', 'ply', 'max', 'c4d', 'skp', 'usdz', 'usd'].includes(ext)) {
    return { message, howTo: `Import it into Blender (free) with File → Import, then ${exportStep}.` };
  }
  if (ext === 'zip') return { message, howTo: `Unzip it and upload the .glb inside. If there’s a .gltf or .fbx instead, convert it in Blender: ${exportStep}.` };
  return { message: `${message.slice(0, -1)}${ext ? ', not a 3D model.' : '.'}`, howTo: null };
}
