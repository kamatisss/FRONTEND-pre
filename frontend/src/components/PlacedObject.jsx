import { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TransformControls, Html, ContactShadows } from '@react-three/drei';
import { useDesign } from '../context/DesignContext';
import * as THREE from 'three';
import NormalizedModel from './NormalizedModel';

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

  // Refs for rotate dragging
  const rotateDragStartX = useRef(0);
  const rotateStartRotY = useRef(0);
  const hasRotated = useRef(false);

  const isSelected = state.selectedItemId === item.id;
  const isPlacing = state.placementMode !== 'idle';

  // --- Scale Logic ---
  const rawScale = item.scale?.x ?? item.scale ?? 1;
  const objScale = Number.isFinite(rawScale) ? rawScale : 1;

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

  // --- Backend Path Logic ---
  // When a design is loaded from the backend, the placed items may only have modelType 
  // (which is just the name/category) and productId. We need to look up the actual model_file 
  // from our live inventory catalog (state.products).
  const productMatch = state.products.find(p => p.id === item.productId);
  const rawUrl = item.model_file || (productMatch && productMatch.model_file) || item.modelPath || item.modelType;
  
  const modelUrl = rawUrl
    ? (rawUrl.startsWith('http') ? rawUrl : `${import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000'}${rawUrl}`)
    : null;

  // ── Hover emissive effect ──────────────────────────────────────
  useFrame(() => {
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
        // Clamp to terrain bounds
        const x = THREE.MathUtils.clamp(intersection.current.x, -12, 12);
        const z = THREE.MathUtils.clamp(intersection.current.z, -12, 12);

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
  }, [isPlacing, dispatch, item.id, item.position, gl, camera, raycaster, orbitControlsRef]);

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

  // ── Delete handler via floating button ─────────────────────────
  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    dispatch({ type: 'REMOVE_ITEM', payload: item.id });
  }, [dispatch, item.id]);

  // ── Rotate handler via floating button (Drag to rotate or Click to snap) ──
  const handleRotatePointerDown = useCallback((e) => {
    e.stopPropagation();
    rotateDragStartX.current = e.clientX;
    rotateStartRotY.current = item.rotation?.y ?? 0;
    hasRotated.current = false;

    const onPointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - rotateDragStartX.current;
      
      // Threshold to detect drag vs click
      if (!hasRotated.current && Math.abs(deltaX) > 4) {
        hasRotated.current = true;
      }
      
      if (hasRotated.current) {
        dispatch({
          type: 'UPDATE_ITEM',
          payload: {
            id: item.id,
            updates: {
              rotation: {
                x: item.rotation?.x ?? 0,
                y: rotateStartRotY.current + (deltaX * 0.01),
                z: item.rotation?.z ?? 0,
              }
            }
          }
        });
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      
      // If no drag occurred, snap 45 degrees
      if (!hasRotated.current) {
        dispatch({
          type: 'UPDATE_ITEM',
          payload: {
            id: item.id,
            updates: {
              rotation: {
                x: item.rotation?.x ?? 0,
                y: rotateStartRotY.current + Math.PI / 4,
                z: item.rotation?.z ?? 0,
              }
            }
          }
        });
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [dispatch, item.id, item.rotation]);

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
        <NormalizedModel
          url={modelUrl}
          category={item.category}
          realWorldSize={productMatch?.real_world_size || item.real_world_size}
        />
      ) : (
        /* Fallback: red wireframe box */
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ef4444" wireframe />
          <Html center position={[0, 1.2, 0]}>
            <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap shadow-lg">
              Missing 3D Model
            </div>
          </Html>
        </mesh>
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

      {/* Floating action buttons when selected (not while dragging) */}
      {isSelected && !isPlacing && !isDragging && (
        <Html position={[0, 2.4, 0]} center distanceFactor={10}>
          <div className="flex gap-1.5 items-center bg-white/95 dark:bg-slate-800/95 px-3 py-2 rounded-full shadow-xl backdrop-blur-md border border-gray-100 dark:border-slate-700 ring-1 ring-black/5">
            {/* Re-place / Move button */}
            <button
              onClick={(e) => { e.stopPropagation(); dispatch({ type: 'START_EDITING', payload: item.id }); }}
              className="p-1.5 rounded-full transition-all active:scale-95 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              title="Move Object"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 9l4-4 4 4M19 15l-4 4-4-4M9 5v14M15 19V5" />
              </svg>
            </button>

            <div className="w-px h-5 bg-gray-200 dark:bg-slate-600 mx-0.5" />

            {/* Rotate button */}
            <button
              onPointerDown={handleRotatePointerDown}
              className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-full text-blue-500 transition-transform cursor-ew-resize hover:scale-110 active:scale-95"
              title="Drag to Rotate smoothly, Click to snap 45°"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            <div className="w-px h-5 bg-gray-200 dark:bg-slate-600 mx-0.5" />

            {/* Delete button */}
            <button
              onClick={handleDelete}
              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-full text-red-500 transition-all active:scale-95"
              title="Delete (Del)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        </Html>
      )}
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