/**
 * A garden design as a .glb file (glTF binary, metres, Y up) for the customer's own device: opens in
 * Blender, SketchUp (via an importer), online glTF viewers and AR apps. ThreeGardenCanvas assembles
 * the scene (lot ground, beds and lawn, the plants exactly as drawn); this file writes it.
 *
 * Size: the catalog models keep their textures as WebP, which the exporter can't write, so every
 * texture would become a PNG. Textures that don't need see-through parts (bumps, shine, solid colour)
 * go as JPEG instead and all are capped at MAX_TEXTURE, which keeps a typical garden to a few MB.
 *
 * Plain glTF only: our optimised models store shapes quantized (KHR_mesh_quantization) and the
 * bamboo repeats stalks with GPU instancing (EXT_mesh_gpu_instancing). Exported as-is, the file
 * *requires* those extensions and simple viewers (Windows 3D Viewer…) refuse to open it, so the copy
 * is converted to float shapes and ordinary meshes first (makePortable). Bigger, but opens anywhere.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { MODEL_CREDITS } from './modelCredits';

const MAX_TEXTURE = 1024;
const OPAQUE_MAPS = ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap',
  'specularIntensityMap', 'specularColorMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'sheenColorMap'];

// Pick PNG (keeps transparency) or JPEG (smaller) per texture; returns a function that puts them back
function chooseTextureFormats(root) {
  const needsAlpha = new Map();   // texture → true if any use of it needs see-through parts
  const want = (tex, alpha) => {
    if (tex?.isTexture) needsAlpha.set(tex, needsAlpha.get(tex) || alpha);
  };
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => {
      want(m.map, m.transparent || m.alphaTest > 0 || !!m.alphaMap);
      want(m.alphaMap, true);
      OPAQUE_MAPS.forEach((k) => want(m[k], false));
    });
  });
  const before = new Map();
  needsAlpha.forEach((alpha, tex) => {
    before.set(tex, tex.userData.mimeType);
    tex.userData.mimeType = alpha ? 'image/png' : 'image/jpeg';
  });
  return () => before.forEach((mime, tex) => {
    if (mime === undefined) delete tex.userData.mimeType; else tex.userData.mimeType = mime;
  });
}

// Quantized shapes → plain floats; instanced meshes → one mesh per instance. Works on the export copy
// only (meshes are already clones; shared geometry is converted into new geometry, never changed).
function makePortable(root) {
  const made = new Map();   // original geometry → float copy (keeps each model written once)
  const floatGeometry = (geo) => {
    if (made.has(geo)) return made.get(geo);
    const quantized = Object.values(geo.attributes).some((a) => !(a.array instanceof Float32Array) || a.normalized || a.isInterleavedBufferAttribute);
    let out = geo;
    if (quantized) {
      out = new THREE.BufferGeometry();
      Object.entries(geo.attributes).forEach(([name, a]) => {
        const arr = new Float32Array(a.count * a.itemSize);
        for (let i = 0; i < a.count; i++) {
          for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c);   // getComponent denormalizes
        }
        out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
      });
      if (out.attributes.normal) out.normalizeNormals();   // decompressed normals come out slightly off unit length
      if (geo.index) out.setIndex(geo.index.clone());
      geo.groups.forEach((g) => out.addGroup(g.start, g.count, g.materialIndex));
      out.name = geo.name;
    }
    made.set(geo, out);
    return out;
  };

  const instanced = [];
  root.traverse((obj) => {
    if (obj.isInstancedMesh) instanced.push(obj);
    else if (obj.isMesh && obj.geometry) obj.geometry = floatGeometry(obj.geometry);
  });
  const m = new THREE.Matrix4();
  instanced.forEach((inst) => {
    const group = new THREE.Group();
    group.name = inst.name;
    group.position.copy(inst.position); group.quaternion.copy(inst.quaternion); group.scale.copy(inst.scale);
    const geo = floatGeometry(inst.geometry);
    for (let i = 0; i < inst.count; i++) {
      inst.getMatrixAt(i, m);
      const mesh = new THREE.Mesh(geo, inst.material);
      mesh.applyMatrix4(m);
      group.add(mesh);
    }
    inst.parent.add(group);
    inst.parent.remove(inst);
  });
  return () => made.forEach((out, geo) => { if (out !== geo) out.dispose(); });
}

// Credits for models made by others (CC BY needs them to travel with the model)
export function creditsFor(productNames) {
  const names = new Set(productNames.map((n) => String(n).toLowerCase()));
  return MODEL_CREDITS.filter((c) => names.has(c.product.toLowerCase())).map((c) => ({
    product: c.product, title: c.title, author: c.author, url: c.url, license: c.license.name,
    license_url: c.license.url, changes: c.changes,
  }));
}

/**
 * root: a THREE.Object3D (not added to any scene). Returns a Blob (model/gltf-binary).
 * meta: { title, credits: creditsFor(...) }
 */
export async function exportGlb(root, { title = 'Garden design', credits = [] } = {}) {
  const restore = chooseTextureFormats(root);
  const cleanUp = makePortable(root);
  try {
    const exporter = new GLTFExporter();
    exporter.register((writer) => ({
      afterParse() {
        const copyright = credits.length
          ? `Garden design by Garden Studio. 3D models: ${credits.map((c) => `"${c.title}" by ${c.author} (${c.license}, ${c.url})`).join('; ')}. Other models: Garden Studio.`
          : 'Garden design and 3D models: Garden Studio.';
        writer.json.asset.copyright = copyright;
        writer.json.asset.extras = {
          title, units: 'metres', made_with: 'Garden Studio AI garden designer',
          exported_at: new Date().toISOString(), model_credits: credits,
        };
      },
    }));
    const glb = await exporter.parseAsync(root, { binary: true, onlyVisible: true, maxTextureSize: MAX_TEXTURE });
    return new Blob([glb], { type: 'model/gltf-binary' });
  } finally {
    restore();
    cleanUp();
  }
}
