# Optimizing 3D models

The catalog models in `public/models/` are compressed to load fast (101 MB → 19 MB, no
visible difference). Originals are kept in `models-original/` (not deployed).

Do this for every new `.glb` you add to the catalog. It takes two steps: geometry, then textures.

## One-time setup (in any empty folder outside the project)

```bash
npm init -y
npm install @gltf-transform/cli@4.2.1 @gltf-transform/core@4.2.1 @gltf-transform/extensions@4.2.1 meshoptimizer sharp@0.34.3
```

Copy `scripts/optimize-textures.mjs` from this project into that folder.

## Optimize a model

```bash
# 1. Geometry: Meshopt compression. --simplify false keeps thin leaves intact.
#    (Textures are skipped here; the CLI's texture step fails on Windows with this sharp version.)
npx gltf-transform optimize original.glb geo.glb --compress meshopt --texture-compress false --simplify false

# 2. Textures: WebP, max 1024 px. Any texture that fails or doesn't get smaller is kept as is.
node optimize-textures.mjs geo.glb final.glb
```

Put `final.glb` in `public/models/<category>/`, keep the original in `models-original/`,
and add the file name to `src/data/modelCatalog.js`.

## Notes

- Loaders must have the Meshopt decoder: drei's `useGLTF` does by default, and
  `ThreeGardenCanvas` sets it explicitly. A new `GLTFLoader` elsewhere needs
  `.setMeshoptDecoder(MeshoptDecoder)` too.
- Compare before/after visually before replacing a model.
- Models uploaded through the Inventory Dashboard are served as uploaded (not compressed).
