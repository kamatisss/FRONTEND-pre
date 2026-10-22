import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// Catalog models are Meshopt-compressed (see scripts/optimize-models.md)
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/*
 * Product photo from a 3D model: an off-screen studio shot (three-quarter view, soft daylight,
 * contact shadow, light gradient backdrop) so every catalog item has a matching picture even
 * when nobody has photographed it. Returns a JPEG Blob.
 */
export async function renderModelThumbnail(modelUrl, { size = 800 } = {}) {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(modelUrl);
  const model = gltf.scene;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // Stand the model on the ground, centred
    const box = new THREE.Box3().setFromObject(model);
    const dims = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    model.position.set(-centre.x, -box.min.y, -centre.z);
    scene.add(model);

    const radius = Math.max(dims.length() / 2, 0.01);
    const span = Math.max(dims.x, dims.z, dims.y);

    // Daylight: sky/ground fill, a warm key light casting the shadow, a cool rim from behind
    scene.add(new THREE.HemisphereLight('#ffffff', '#b9c9b2', 1.5));
    const key = new THREE.DirectionalLight('#fff4e5', 2.6);
    key.position.set(span * 1.2, span * 2, span * 1.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const s = span * 1.5;
    Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.01, far: span * 6 });
    key.shadow.radius = 6;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#dfeaff', 0.9);
    rim.position.set(-span, span, -span * 1.5);
    scene.add(rim);

    // Shadow catcher: invisible floor that only shows the model's shadow
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(span * 6, span * 6), new THREE.ShadowMaterial({ opacity: 0.22 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Three-quarter view framing the whole model (tall palms and low rocks alike)
    const fov = 30;
    const camera = new THREE.PerspectiveCamera(fov, 1, radius / 100, radius * 50);
    const distance = (radius / Math.sin(THREE.MathUtils.degToRad(fov / 2))) * 1.08;
    const target = new THREE.Vector3(0, dims.y * 0.48, 0);
    camera.position.copy(target).add(new THREE.Vector3(0.62, 0.36, 1).normalize().multiplyScalar(distance));
    camera.lookAt(target);

    renderer.render(scene, camera);

    // Backdrop: soft studio gradient, then the transparent render on top
    const out = document.createElement('canvas');
    out.width = out.height = size;
    const ctx = out.getContext('2d');
    const bg = ctx.createRadialGradient(size / 2, size * 0.42, size * 0.05, size / 2, size / 2, size * 0.75);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(1, '#e8f0ea');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(renderer.domElement, 0, 0, size, size);

    floor.geometry.dispose();
    floor.material.dispose();
    return await new Promise((resolve, reject) =>
      out.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode the image.'))), 'image/jpeg', 0.9));
  } finally {
    model.traverse(o => {
      if (!o.isMesh) return;
      o.geometry?.dispose();
      [].concat(o.material || []).forEach(m => {
        Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); });
        m.dispose();
      });
    });
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
