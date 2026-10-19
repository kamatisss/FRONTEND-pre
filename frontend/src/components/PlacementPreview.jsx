import { useRef, useEffect, useCallback, Suspense } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { ErrorBoundary } from 'react-error-boundary';
import * as THREE from 'three';
import { useDesign } from '../context/DesignContext';
import { PLANT_COMPONENTS } from './ProceduralPlants';
import { HARDSCAPE_COMPONENTS } from './ProceduralHardscape';
import NormalizedModel from './NormalizedModel';
import ModelPlaceholder from './ModelPlaceholder';
import { resolveModelUrl } from '../data/modelCatalog';

const ALL_COMPONENTS = { ...PLANT_COMPONENTS, ...HARDSCAPE_COMPONENTS };

// Terrain boundaries (matches GardenBackground TERRAIN_SIZE / 2)
const TERRAIN_HALF = 12;

/**
 * PlacementPreview — renders a semi-transparent ghost of the selected asset
 * that follows the mouse via raycasting against the terrain mesh.
 */
export default function PlacementPreview({ terrainRef }) {
  const { state, dispatch } = useDesign();
  const { camera, gl, raycaster, scene } = useThree();

  const groupRef = useRef();
  const targetPos = useRef(new THREE.Vector3(0, 0, 0));
  const currentPos = useRef(new THREE.Vector3(0, 0, 0));
  const isValid = useRef(true);
  const mouse = useRef(new THREE.Vector2());

  const { previewObject, placementMode } = state;

  useFrame(() => {
    if (!groupRef.current) return;

    // Ghost any material not yet converted. Checked every frame because the .glb
    // mounts asynchronously (after the Suspense placeholder). NormalizedModel's
    // per-instance materials are modified in place; shared ones (procedural
    // module-level materials) are cloned first so other users aren't affected.
    groupRef.current.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      if (mats.every((m) => m.userData.isPreviewGhost)) return;
      const ghosts = mats.map((m) => {
        const mat = m.userData.instanceOwned ? m : m.clone();
        mat.transparent = true;
        mat.opacity = 0.6;
        mat.depthWrite = false;
        mat.userData.isPreviewGhost = true;
        return mat;
      });
      child.material = Array.isArray(child.material) ? ghosts : ghosts[0];
    });

    // Smoothly lerp position toward target
    currentPos.current.lerp(targetPos.current, 0.15);
    groupRef.current.position.copy(currentPos.current);
  });

  // ── Pointer move handler — raycast against terrain ─────────
  const handlePointerMove = useCallback((e) => {
    if (placementMode === 'idle') return;
    if (!terrainRef?.current) return;

    // Compute normalized mouse coordinates
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse.current, camera);

    const intersects = raycaster.intersectObject(terrainRef.current, true);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      const face = intersects[0].face;

      // Check if within terrain bounds
      const withinBounds =
        Math.abs(point.x) <= TERRAIN_HALF &&
        Math.abs(point.z) <= TERRAIN_HALF;

      // Check if surface is roughly upward-facing
      // R3F plane geometry has a local normal of [0, 0, 1]. Since the mesh is rotated -90deg on X,
      // the world "up" corresponds to the local Z axis.
      const validSurface = !face || face.normal.z > 0.3;
      const valid = withinBounds && validSurface;

      isValid.current = valid;
      targetPos.current.set(point.x, point.y, point.z);

      dispatch({
        type: 'UPDATE_PREVIEW_POSITION',
        payload: {
          position: { x: point.x, y: point.y, z: point.z },
          valid,
        },
      });
    } else {
      isValid.current = false;
      dispatch({
        type: 'UPDATE_PREVIEW_POSITION',
        payload: {
          position: previewObject?.position || { x: 0, y: 0, z: 0 },
          valid: false,
        },
      });
    }
  }, [placementMode, terrainRef, gl, camera, raycaster, dispatch, previewObject?.position]);

  // ── Attach/detach pointer listener ─────────────────────────
  // pointerdown too: on touch screens there is no hover, so a tap moves the ghost
  // to that spot first and the click that follows places it there (tap-to-place)
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerMove);
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerMove);
    };
  }, [gl, handlePointerMove]);

  // ── Don't render if no preview ─────────────────────────────
  if (!previewObject || placementMode === 'idle') return null;

  // Same model lookup as PlacedObject, so the ghost matches what gets placed
  const productMatch = state.products.find(p => p.id === previewObject.productId);
  const modelUrl = resolveModelUrl(
    previewObject.model_file || productMatch?.model_file || previewObject.modelPath || previewObject.modelType
  );
  const category = previewObject.category || productMatch?.category;
  const Component = ALL_COMPONENTS[previewObject.modelType];
  const objScale = previewObject.scale?.x || previewObject.scale || 0.8;
  const rot = [
    previewObject.rotation?.x || 0,
    previewObject.rotation?.y || 0,
    previewObject.rotation?.z || 0,
  ];

  const ringColor = state.previewValid ? '#10b981' : '#ef4444';
  const ringOpacity = state.previewValid ? 0.7 : 0.8;

  return (
    <group
      ref={groupRef}
      rotation={rot}
      scale={[objScale, objScale, objScale]}
    >
      {/* The 3D model */}
      {modelUrl ? (
        <ErrorBoundary
          resetKeys={[modelUrl]}
          fallback={<ModelPlaceholder category={category} label="3D Model Unavailable" />}
        >
          <Suspense fallback={<ModelPlaceholder category={category} />}>
            <NormalizedModel
              url={modelUrl}
              category={category}
              realWorldSize={productMatch?.real_world_size || previewObject.real_world_size}
            />
          </Suspense>
        </ErrorBoundary>
      ) : Component ? (
        <group position={[0, -0.05, 0]}>
          <Component scale={1} />
        </group>
      ) : (
        <mesh castShadow>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshStandardMaterial color="#8B6914" roughness={0.8} transparent opacity={0.6} />
        </mesh>
      )}

      {/* Placement validity ring — pulsing */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.65, 32]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={ringOpacity}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner glow disc */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
