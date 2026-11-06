import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Html, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { DEFAULT_LOT, LOT_MARGIN } from '../data/lot';

// Grass texture tile size in metres: the lawn keeps real-world scale at any lot size
const GRASS_TILE_M = 6;   // mirrored tiling hides the photo's seams (plain repeat showed a checkerboard)
const EDGING = { width: 0.12, height: 0.2, color: '#d8d4ca' };

/* ═══════════════════════════════════════════════════════════════════════
   GARDEN BACKGROUND — Displacement Terrain with Grass Normal Map
   ─────────────────────────────────────────────────────────────────────
   Props:
     originalImageUrl   – the uploaded garden photo (used as color map)
     depthMapUrl        – MiDaS grayscale depth map (drives displacement)
     normalMapUrl       – MiDaS normal map from backend (optional)
     displacementScale  – how far vertices push up/down (default 2.5)
     onTerrainClick(e)  – fired with the raw R3F event on every click
     onPlaceItem([x,y,z]) – fired with world-space coords for item placement
     lotWidth / lotLength – the customer's lot in metres (centred on the origin, +z = front /
                            house side). Drawn at true size with an edging and labels, inside a
                            strip of plain ground; the ref is the group of both (placement
                            raycasts hit the surround too, so the ghost can turn red outside).
   ═══════════════════════════════════════════════════════════════════════ */

const GardenBackground = forwardRef(function GardenBackground(
  {
    originalImageUrl,
    depthMapUrl,
    normalMapUrl,
    rockMaskUrl,
    grassMaskUrl,
    displacementScale = 2.5,
    lotWidth = DEFAULT_LOT.width,
    lotLength = DEFAULT_LOT.length,
    showGrid = false,
    onTerrainClick,   // legacy: raw event (used by GardenDesigner to confirm placement)
    onPlaceItem,      // new: receives [x, y, z] world coords for item drop
  },
  ref
) {
  const [textures, setTextures] = useState(null);
  const meshRef = useRef();
  const groupRef = useRef();

  // Number of grass-normal tile repetitions across the surface.
  // Higher = smaller, more realistic grass blades.
  const GRASS_NORMAL_REPEAT = 8;

  // Expose the ground (lot + surround) to the parent for raycasting. No dependency list on
  // purpose: the group only exists once the textures have loaded, so refresh on every render.
  useImperativeHandle(ref, () => groupRef.current);

  // ── Texture Loading ────────────────────────────────────────────────
  useEffect(() => {
    const colorUrl = originalImageUrl || '/default_garden.jpg';
    const depthUrl = depthMapUrl || '/default_depth.png';

    const loader = new THREE.TextureLoader();

    /**
     * Safely load a texture. Resolves with a tiny fallback canvas if the
     * URL is missing or fails — so the component never crashes on a bad URL.
     */
    const loadTex = (url, fallbackRGB, repeat = 1) =>
      new Promise(resolve => {
        if (!url) {
          const c = document.createElement('canvas');
          c.width = c.height = 4;
          c.getContext('2d').fillStyle = `rgb(${fallbackRGB.join(',')})`;
          c.getContext('2d').fillRect(0, 0, 4, 4);
          resolve(new THREE.CanvasTexture(c));
          return;
        }
        loader.load(
          url,
          tex => {
            tex.anisotropy = 8;
            // Seamless tiling for the grass normal map
            if (repeat > 1) {
              tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
              tex.repeat.set(repeat, repeat);
            } else {
              tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
            }
            resolve(tex);
          },
          undefined,
          () => {
            // Graceful fallback — never block rendering on a missing texture
            const c = document.createElement('canvas');
            c.width = c.height = 4;
            resolve(new THREE.CanvasTexture(c));
          }
        );
      });

    Promise.all([
      loadTex(colorUrl, [100, 130, 80]),         // color map
      loadTex(depthUrl,      [128, 128, 128]),         // MiDaS depth (displacement)
      loadTex(normalMapUrl,     [128, 128, 255]),         // MiDaS normal from backend
      loadTex('/textures/grass_normal.jpg', [128, 128, 255], GRASS_NORMAL_REPEAT), // seamless grass detail
      loadTex('/default_garden.jpg', [100, 130, 80]),   // plain lawn for the surround (and tiled lot)
    ]).then(([colorMap, depthMap, backendNormal, grassNormal, lawn]) => {
      // ── Color space corrections ──────────────────────────────────
      // Photographic / display textures → sRGB
      colorMap.colorSpace = THREE.SRGBColorSpace;
      lawn.colorSpace = THREE.SRGBColorSpace;

      // Data textures (depth, normals) must stay linear to avoid banding
      depthMap.colorSpace    = THREE.LinearSRGBColorSpace;
      backendNormal.colorSpace = THREE.LinearSRGBColorSpace;
      grassNormal.colorSpace   = THREE.LinearSRGBColorSpace;

      // ── Filtering ────────────────────────────────────────────────
      // Smooth mipmapping on depth prevents jagged stepped edges
      depthMap.generateMipmaps = true;
      depthMap.minFilter = THREE.LinearMipmapLinearFilter;
      depthMap.magFilter = THREE.LinearFilter;

      // Grass normal looks best with high-quality anisotropic filtering
      grassNormal.generateMipmaps = true;
      grassNormal.minFilter = THREE.LinearMipmapLinearFilter;
      grassNormal.magFilter = THREE.LinearFilter;

      setTextures({ colorMap, depthMap, backendNormal, grassNormal, lawn });
    });
  }, [originalImageUrl, depthMapUrl, normalMapUrl]);

  const isPhoto = !!originalImageUrl;
  const outerW = lotWidth + LOT_MARGIN * 2, outerL = lotLength + LOT_MARGIN * 2;
  const maps = useMemo(() => {
    if (!textures) return null;
    const tile = (tex, w, l) => {
      const t = tex.clone();
      t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
      t.repeat.set(w / GRASS_TILE_M, l / GRASS_TILE_M);
      t.needsUpdate = true;
      return t;
    };
    const grass = (w, l) => {
      const t = textures.grassNormal.clone();
      t.repeat.set(Math.max(2, w / 3), Math.max(2, l / 3));
      t.needsUpdate = true;
      return t;
    };
    return {
      // A customer's photo is stretched over the lot (it IS the lot); the default lawn is tiled
      lot: isPhoto ? textures.colorMap : tile(textures.lawn, lotWidth, lotLength),
      lotNormal: grass(lotWidth, lotLength),
      outer: tile(textures.lawn, outerW, outerL),
      outerNormal: grass(outerW, outerL),
    };
  }, [textures, isPhoto, lotWidth, lotLength, outerW, outerL]);
  useEffect(() => () => {
    if (!maps) return;
    [maps.lotNormal, maps.outer, maps.outerNormal].forEach(t => t.dispose());
    if (!isPhoto) maps.lot.dispose();
  }, [maps, isPhoto]);

  // Enough vertices for smooth displacement without wasting them on small lots
  const segW = Math.min(256, Math.max(32, Math.round(lotWidth * 8)));
  const segL = Math.min(256, Math.max(32, Math.round(lotLength * 8)));

  // ── Pointer / Click Handler ────────────────────────────────────────
  /**
   * onPointerDown is used instead of onClick for snappier response.
   *
   * Two callbacks are supported:
   *  • onTerrainClick(event)   — raw R3F event (backward-compatible with
   *                              GardenDesigner's placement-confirm flow)
   *  • onPlaceItem([x, y, z]) — convenience callback with world coords
   */
  const handlePointerDown = useCallback(
    (event) => {
      // Prevent the event from bubbling up to OrbitControls / Canvas
      event.stopPropagation();

      // Fire the legacy raw-event callback (used to confirm placement mode)
      if (onTerrainClick) onTerrainClick(event);

      // Fire the new placement callback with the exact 3D intersection point
      if (onPlaceItem && event.point) {
        const { x, y, z } = event.point;
        onPlaceItem([x, y, z]);
      }
    },
    [onTerrainClick, onPlaceItem]
  );

  // ── Loading state ─────────────────────────────────────────────────
  if (!textures || !maps) {
    return (
      <Html center>
        <div
          style={{
            color: 'white',
            padding: '12px 24px',
            background: 'rgba(0,0,0,0.65)',
            borderRadius: '8px',
            fontFamily: 'system-ui, sans-serif',
            backdropFilter: 'blur(6px)',
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          Generating 3D Terrain…
        </div>
      </Html>
    );
  }

  const hw = lotWidth / 2, hl = lotLength / 2;
  const edgeY = EDGING.height / 2 - 0.04;
  const label = {
    padding: '3px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.92)', color: '#065F46',
    fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
    boxShadow: '0 1px 4px rgba(0,0,0,0.18)', pointerEvents: 'none', userSelect: 'none',
  };

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* ── The customer's lot: true size, displaced by the depth map ── */}
      <mesh
        ref={meshRef}
        receiveShadow
        castShadow
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
        userData={{ isLot: true }}
      >
        <planeGeometry args={[lotWidth, lotLength, segW, segL]} />
        <meshStandardMaterial
          map={maps.lot}
          // Displacement (physical vertex push from MiDaS); bias keeps flat ground near y = 0
          displacementMap={textures.depthMap}
          displacementScale={displacementScale}
          displacementBias={-displacementScale * 0.1}
          // Fine grass blade detail (a single normalMap slot: the grass one reads best)
          normalMap={maps.lotNormal}
          normalScale={[0.6, 0.6]}
          roughness={0.85}
          metalness={0.0}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* ── Plain ground around the lot: duller, flat, not part of the design ── */}
      <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[outerW, outerL]} />
        <meshStandardMaterial map={maps.outer} color="#8e9a84" normalMap={maps.outerNormal}
          normalScale={[0.4, 0.4]} roughness={0.95} metalness={0} />
      </mesh>

      {/* ── Lot edging (concrete) ── */}
      {[
        [0, hl, lotWidth + EDGING.width, EDGING.width],    // front (house side)
        [0, -hl, lotWidth + EDGING.width, EDGING.width],   // back
        [-hw, 0, EDGING.width, lotLength],                  // left
        [hw, 0, EDGING.width, lotLength],                   // right
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, edgeY, z]} castShadow receiveShadow>
          <boxGeometry args={[w, EDGING.height, d]} />
          <meshStandardMaterial color={EDGING.color} roughness={0.9} />
        </mesh>
      ))}

      {/* ── Optional 1 m grid (5 m lines stronger), just above the grass ── */}
      {showGrid && (
        <Grid position={[0, 0.17, 0]} args={[lotWidth, lotLength]} cellSize={1} cellThickness={0.7}
          cellColor="#f0fdf4" sectionSize={5} sectionThickness={1.3} sectionColor="#bbf7d0"
          fadeDistance={400} fadeStrength={0} infiniteGrid={false} followCamera={false} />
      )}

      {/* ── Measurements and the house side ── */}
      <Html position={[0, 0.05, hl + 1.1]} center zIndexRange={[5, 0]}>
        <div style={label}>{lotWidth} m · Front (house side)</div>
      </Html>
      <Html position={[hw + 1.1, 0.05, 0]} center zIndexRange={[5, 0]}>
        <div style={label}>{lotLength} m</div>
      </Html>

      {/* ── Shadow-catching ground far beneath ── */}
      <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[Math.max(100, outerW * 3), Math.max(100, outerL * 3)]} />
        <meshStandardMaterial
          color="#0d0d1a"
          roughness={1}
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  );
});

export default GardenBackground;
