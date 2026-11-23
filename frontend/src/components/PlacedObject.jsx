import { useRef, useState, useEffect, useLayoutEffect, useCallback, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TransformControls, Html, ContactShadows } from '@react-three/drei';
import { placedScale, stageSize, stageSpread, plantVariation, matureWhen, isFullyGrown, DEFAULT_GROWTH_STAGE, GROW_MS, growEase, growMotionOk } from '../data/modelSizing';
import PlantHeightCard from './PlantHeightCard';
import { crowdingNotes } from '../data/crowding';
import { growthNote } from '../data/plantGrowth';
import { ErrorBoundary } from 'react-error-boundary';
import { useDesign } from '../context/DesignContext';
import { lotOf, clampToLot } from '../data/lot';
import * as THREE from 'three';
import NormalizedModel from './NormalizedModel';
import ModelPlaceholder from './ModelPlaceholder';
import { resolveModelUrl } from '../data/modelCatalog';

/* ═══════════════════════════════════════════════════════════════════════
   PLACED OBJECT — Interactive 3D item with direct drag + TransformControls
   ─────────────────────────────────────────────────────────────────────
   Features:
     • Click to select → shows TransformControls gizmo for precision
     • Direct click-and-drag on any object to slide it along the ground
     • Hover → emissive green glow on all meshes
     • Delete / Backspace removes the selected object
   ═══════════════════════════════════════════════════════════════════════ */

// Emissive highlight color for hover effect
const HOVER_EMISSIVE = new THREE.Color(0x22c55e);
const SELECT_EMISSIVE = new THREE.Color(0x10b981);
const NO_EMISSIVE = new THREE.Color(0x000000);

// Ground plane for raycasting drag (Y = 0)
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export default function PlacedObject({ item, orbitControlsRef }) {
  const { state, dispatch } = useDesign();
  const { camera, gl, raycaster } = useThree();
  const transformRef = useRef();
  const groupRef = useRef();
  const modelGroupRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStarted = useRef(false);
  const pointerDownPos = useRef(new THREE.Vector2());
  const mouse = useRef(new THREE.Vector2());
  const intersection = useRef(new THREE.Vector3());


  const isSelected = state.selectedItemId === item.id;
  const isPlacing = state.placementMode !== 'idle';

  // --- Scale Logic ---
  // Old saves carry the former 80% default; placedScale shows them at real size
  const objScale = placedScale(item.scale?.x ?? item.scale ?? 1);

  // --- Position & Rotation Logic ---
  const pos = [
    item.position?.x ?? 0,
    item.position?.y ?? 0,
    item.position?.z ?? 0,
  ];

  const rot = [
    item.rotation?.x ?? 0,
    item.rotation?.y ?? 0,
    item.rotation?.z ?? 0,
  ];

  // --- Model Path Logic ---
  // When a design is loaded from the backend, the placed items may only have modelType
  // (which is just the name/category) and productId. We need to look up the actual model_file
  // from our live inventory catalog (state.products). Catalog models resolve to the
  // frontend's public/models folder; only custom uploads hit backend media.
  const productMatch = state.products.find(p => p.id === item.productId);
  const rawUrl = item.model_file || (productMatch && productMatch.model_file) || item.modelPath || item.modelType;
  const modelUrl = resolveModelUrl(rawUrl);
  const category = item.category || productMatch?.category;

  // ── Height label (plants): ground-to-top measuring line + growth in metres ──
  // The model is scaled so its top is exactly at real_world_size (established height, ~2 years)
  // in this group's own units; the group's scale makes the shown height realH × objScale.
  const sizeSource = productMatch || item;
  const establishedH = Number(sizeSource.real_world_size) || 0;
  const plantingH = Number(productMatch?.planting_height) || 0;
  const matureH = Number(productMatch?.mature_height) || 0;
  const stage = state.growthStage ?? DEFAULT_GROWTH_STAGE;   // years after planting (0 = at planting)
  // Drawn (and measured) at the Studio's growth stage; non-plants keep their size. Each plant is its own
  // size within ±8% of the catalog's, fixed by its id, like real nursery stock (data/modelSizing.plantVariation)
  const vary = plantVariation(item.id, category);
  const realH = (Number(stageSize(sizeSource, stage, category)) || 0) * vary.h;
  const spreadNow = stageSpread(productMatch || item, stage, category) * vary.w;

  // Crowding: this plant's crown grows into a neighbour's at the year on the slider (data/crowding.js):
  // an amber ring round its crown and a note on its card. Advice only.
  // (no useMemo: the React Compiler memoizes this component)
  const crowdNotes = (() => {
    if (category !== 'plant') return [];
    const list = state.placedItems.map((it) => {
      const product = state.products.find((p) => p.id === it.productId);
      return { key: it.id, x: it.position?.x, z: it.position?.z, product,
        vary: plantVariation(it.id, it.category || product?.category), scale: placedScale(it.scale?.x ?? it.scale ?? 1) };
    });
    return crowdingNotes(list, stage).get(item.id) || [];
  })();

  // ── Growing between stages: the new size is drawn at once, so this group starts at the old size
  //    (as a share of the new one) and eases to 1 (data/modelSizing GROW_MS) ──
  const growRef = useRef();
  const grow = useRef(null);
  const drawn = useRef({ stage, h: realH, w: spreadNow });
  useLayoutEffect(() => {
    const was = drawn.current;
    drawn.current = { stage, h: realH, w: spreadNow };
    if (was.stage === stage || !(was.h > 0) || !(realH > 0) || category !== 'plant' || !growMotionOk()) {
      grow.current = null;
      growRef.current?.scale.set(1, 1, 1);
      return;
    }
    const fy = was.h / realH;
    const fx = was.w > 0 && spreadNow > 0 ? was.w / spreadNow : fy;   // no widths on record: width follows height
    grow.current = { fx, fy, t0: performance.now() };
    growRef.current?.scale.set(fx, fy, fx);
  }, [stage, realH, spreadNow, category]);

  // ── Hover emissive effect ──────────────────────────────────────
  useFrame(() => {
    const g = grow.current;
    if (g && growRef.current) {
      const t = (performance.now() - g.t0) / GROW_MS;
      const k = growEase(t);
      growRef.current.scale.set(g.fx + (1 - g.fx) * k, g.fy + (1 - g.fy) * k, g.fx + (1 - g.fx) * k);
      if (t >= 1) grow.current = null;
    }
    if (!modelGroupRef.current) return;

    const targetEmissive = isSelected
      ? SELECT_EMISSIVE
      : hovered
        ? HOVER_EMISSIVE
        : NO_EMISSIVE;

    const targetIntensity = isSelected ? 0.15 : hovered ? 0.1 : 0;

    modelGroupRef.current.traverse((child) => {
      if (child.isMesh && child.material) {
        if (child.material.emissive) {
          child.material.emissive.lerp(targetEmissive, 0.12);
          child.material.emissiveIntensity = THREE.MathUtils.lerp(
            child.material.emissiveIntensity ?? 0,
            targetIntensity,
            0.12
          );
        }
      }
    });
  });

  // ── Direct drag handlers ──────────────────────────────────────
  const handlePointerDown = useCallback((e) => {
    if (isPlacing) return;
    e.stopPropagation();

    // Record where the pointer went down
    pointerDownPos.current.set(e.clientX, e.clientY);
    dragStarted.current = false;

    // Select this item
    dispatch({ type: 'SELECT_ITEM', payload: item.id });

    // Start listening for drag
    const canvas = gl.domElement;

    const onPointerMove = (moveEvent) => {
      const dx = moveEvent.clientX - pointerDownPos.current.x;
      const dy = moveEvent.clientY - pointerDownPos.current.y;

      // Only start dragging after a small threshold to differentiate from clicks
      if (!dragStarted.current && Math.sqrt(dx * dx + dy * dy) < 5) return;

      if (!dragStarted.current) {
        dragStarted.current = true;
        setIsDragging(true);
        if (orbitControlsRef?.current) orbitControlsRef.current.enabled = false;
        canvas.style.cursor = 'grabbing';
      }

      // Raycast against ground plane
      const rect = canvas.getBoundingClientRect();
      mouse.current.x = ((moveEvent.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((moveEvent.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse.current, camera);
      if (raycaster.ray.intersectPlane(GROUND_PLANE, intersection.current)) {
        // Items stay inside the customer's lot
        const { x, z } = clampToLot(intersection.current.x, intersection.current.z, lotOf(state.dimensions));

        // Update position in state (keep original Y)
        dispatch({
          type: 'UPDATE_ITEM',
          payload: {
            id: item.id,
            updates: {
              position: { x, y: item.position?.y ?? 0, z },
            },
          },
        });
      }
    };

    const onPointerUp = () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);

      if (dragStarted.current) {
        setIsDragging(false);
        if (orbitControlsRef?.current) orbitControlsRef.current.enabled = true;
        canvas.style.cursor = 'default';
      }
      dragStarted.current = false;
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
  }, [isPlacing, dispatch, item.id, item.position, gl, camera, raycaster, orbitControlsRef, state.dimensions]);

  // ── Disable OrbitControls while dragging TransformControls ─────
  useEffect(() => {
    const controls = transformRef.current;
    if (!controls || !orbitControlsRef?.current) return;

    const onDragChanged = (event) => {
      orbitControlsRef.current.enabled = !event.value;

      // Sync position back on drag end
      if (!event.value && groupRef.current) {
        const p = groupRef.current.position;
        const r = groupRef.current.rotation;

        dispatch({
          type: 'UPDATE_ITEM',
          payload: {
            id: item.id,
            updates: {
              position: { x: p.x, y: p.y, z: p.z },
              rotation: { x: r.x, y: r.y, z: r.z },
            },
          },
        });
      }
    };

    controls.addEventListener('dragging-changed', onDragChanged);
    return () => controls.removeEventListener('dragging-changed', onDragChanged);
  }, [isSelected, orbitControlsRef, dispatch, item.id]);

  // ── Click to select ────────────────────────────────────────────
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (isPlacing) return;
    dispatch({ type: 'SELECT_ITEM', payload: item.id });
  }, [isPlacing, dispatch, item.id]);

  // Delete, Turn and Move for the selected item live in the Studio's panel (StudioItemPanel)

  const showHeight = category === 'plant' && realH > 0 && !isPlacing && !isDragging && (hovered || isSelected);
  const tick = 0.32 / objScale;      // tick marks keep the same real size whatever the item's scale
  const lineW = 0.025 / objScale;

  // ── The renderable model content ──────────────────────────────
  const modelContent = (
    <group
      ref={modelGroupRef}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!isPlacing) {
          setHovered(true);
          document.body.style.cursor = isDragging ? 'grabbing' : 'grab';
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        if (!isDragging) document.body.style.cursor = 'default';
      }}
    >
      {modelUrl ? (
        /* Per-object boundary: a failed .glb shows a placeholder instead of crashing the canvas */
        <ErrorBoundary
          resetKeys={[modelUrl]}
          onError={(err) => console.error('Failed to load 3D model:', modelUrl, err)}
          fallback={<ModelPlaceholder category={category} label="3D Model Unavailable" />}
        >
          <Suspense fallback={<ModelPlaceholder category={category} />}>
            <group ref={growRef}>
              <NormalizedModel
                url={modelUrl}
                category={category}
                realWorldSize={realH || undefined}
                targetWidth={spreadNow}
                stage={stage}
                establishedSize={establishedH ? establishedH * vary.h : undefined}
                sway={category === 'plant'}
              />
            </group>
          </Suspense>
        </ErrorBoundary>
      ) : (
        <ModelPlaceholder category={category} label="Missing 3D Model" />
      )}

      {/* Grounding shadow */}
      <ContactShadows
        position={[0, 0.01, 0]}
        scale={4 * objScale}
        blur={2.5}
        far={1}
        opacity={0.5}
        color="#222"
      />

      {/* Crowding: an amber ring round the crown at this year (the group's scale applies, so no objScale) */}
      {crowdNotes.length > 0 && spreadNow > 0 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} renderOrder={997}>
          <ringGeometry args={[spreadNow / 2 - 0.06 / objScale, spreadNow / 2, 48]} />
          <meshBasicMaterial color="#F59E0B" transparent opacity={0.8} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Selection / hover ring on the floor */}
      {(isSelected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.5, 0.58, 32]} />
          <meshBasicMaterial
            color={isDragging ? '#3b82f6' : isSelected ? '#10b981' : '#34d399'}
            transparent
            opacity={isDragging ? 0.9 : isSelected ? 0.85 : 0.45}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Height: a measuring line from the ground to the top, drawn over the leaves */}
      {showHeight && (
        <group renderOrder={999}>
          <mesh position={[0, realH / 2, 0]} renderOrder={999}>
            <cylinderGeometry args={[lineW, lineW, realH, 6]} />
            <meshBasicMaterial color="#ffffff" depthTest={false} transparent opacity={0.95} />
          </mesh>
          {[0.02, realH].map(y => (
            <mesh key={y} position={[0, y, 0]} renderOrder={999}>
              <boxGeometry args={[tick, lineW * 2, lineW * 2]} />
              <meshBasicMaterial color="#ffffff" depthTest={false} transparent opacity={0.95} />
            </mesh>
          ))}
          {!isSelected && (
          <Html position={[0, realH, 0]} zIndexRange={[18, 10]} style={{ pointerEvents: 'none' }}>
            {/* Pointing at it: a short label beside the top. Selected: its details are in the panel (StudioItemPanel) */}
            <PlantHeightCard compact name={productMatch?.name || item.name} shown={realH * objScale} stage={stage}
              heights={{ planting: plantingH, established: establishedH, mature: matureH }}
              wide={spreadNow}
              matureWhen={matureWhen(productMatch)} grown={!!productMatch && isFullyGrown(productMatch, stage)}
              notes={crowdNotes}
              growthNote={growthNote(modelUrl, stage)}
              style={{ transform: 'translate(14px, -25%)' }} />
          </Html>
          )}
        </group>
      )}

      {/* The selected item's Move / Turn / Remove are in the Studio's panel (StudioItemPanel), not floating here */}
    </group>
  );

  // ── Wrap selected items in TransformControls for precision ─────
  if (isSelected && !isPlacing && !isDragging) {
    return (
      <TransformControls
        ref={transformRef}
        mode="translate"
        showY={false}
        size={0.6}
        space="world"
      >
        <group 
          ref={groupRef}
          position={pos}
          rotation={rot}
          scale={[objScale, objScale, objScale]}
        >
          {modelContent}
        </group>
      </TransformControls>
    );
  }

  // ── Non-selected or dragging items: plain group ───────────────
  return (
    <group
      ref={groupRef}
      position={pos}
      rotation={rot}
      scale={[objScale, objScale, objScale]}
    >
      {modelContent}
    </group>
  );
}