// Texture pass: PNG/JPEG → WebP (max 1024 px) on already geometry-compressed models.
// Per-texture: if a texture fails to convert, or WebP isn't smaller, the original is kept.
// Usage: node webp.mjs <in.glb> <out.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const [src, dst] = process.argv.slice(2);
const doc = await io.read(src);

// Which material slots each texture feeds: data maps (normal, roughness, AO) get higher quality
const dataSlots = new Set();
for (const mat of doc.getRoot().listMaterials()) {
  for (const t of [mat.getNormalTexture(), mat.getMetallicRoughnessTexture(), mat.getOcclusionTexture()]) {
    if (t) dataSlots.add(t);
  }
}

let converted = 0, kept = 0;
for (const tex of doc.getRoot().listTextures()) {
  const original = tex.getImage();
  try {
    const out = await sharp(original)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: dataSlots.has(tex) ? 92 : 82, alphaQuality: 90 })
      .toBuffer();
    if (out.length < original.byteLength) {
      tex.setImage(new Uint8Array(out)).setMimeType('image/webp');
      if (tex.getURI()) tex.setURI(tex.getURI().replace(/\.(png|jpe?g)$/i, '.webp'));
      converted++;
    } else kept++;
  } catch {
    kept++;
  }
}
if (converted) doc.createExtension(EXTTextureWebP).setRequired(true);
await io.write(dst, doc);
console.log(`${src.split('/').slice(-2).join('/')}: ${converted} textures → WebP, ${kept} kept`);
