import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

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
   ═══════════════════════════════════════════════════════════════════════ */

const GardenBackground = forwardRef(function GardenBackground(
  {
    originalImageUrl,
    depthMapUrl,
    normalMapUrl,
    rockMaskUrl,
    grassMaskUrl,
    displacementScale = 2.5,
    onTerrainClick,   // legacy: raw event (used by GardenDesigner to confirm placement)
    onPlaceItem,      // new: receives [x, y, z] world coords for item drop
  },
  ref
) {
  const [textures, setTextures] = useState(null);
  const meshRef = useRef();

  // Physical world dimensions of the terrain plane (must match GardenDesigner constants)
  const TERRAIN_WIDTH  = 24;
  const TERRAIN_HEIGHT = 24;

  // Number of grass-normal tile repetitions across the surface.
  // Higher = smaller, more realistic grass blades.
  const GRASS_NORMAL_REPEAT = 8;

  // Expose terrain mesh to parent (used by PlacementPreview for raycasting)
  useImperativeHandle(ref, () => meshRef.current, []);

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
    ]).then(([colorMap, depthMap, backendNormal, grassNormal]) => {
      // ── Color space corrections ──────────────────────────────────
      // Photographic / display textures → sRGB
      colorMap.colorSpace = THREE.SRGBColorSpace;

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

      setTextures({ colorMap, depthMap, backendNormal, grassNormal });
    });
  }, [originalImageUrl, depthMapUrl, normalMapUrl]);

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
  if (!textures) {
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

  return (
    <group position={[0, 0, 0]}>
      {/* ── Main terrain surface ─────────────────────────────────── */}
      <mesh
        ref={meshRef}
        receiveShadow
        castShadow
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
      >
        {/*
          256×256 segments → 66,049 vertices.
          Each vertex can be pushed independently by the displacement map,
          giving smooth hills and dips instead of a blocky staircase.
        */}
        <planeGeometry args={[TERRAIN_WIDTH, TERRAIN_HEIGHT, 256, 256]} />

        <meshStandardMaterial
          // ── Color ────────────────────────────────────────────────
          map={textures.colorMap}

          // ── Displacement (physical vertex push from MiDaS) ───────
          displacementMap={textures.depthMap}
          displacementScale={displacementScale}
          // Bias pulls the base slightly down so flat ground sits at y=0
          displacementBias={-displacementScale * 0.1}

          // ── Normal maps (layered detail) ─────────────────────────
          // The backend normal map provides large-scale shape information.
          // The grass normal map adds fine micro-surface detail (blade texture).
          // Three.js meshStandardMaterial accepts a single normalMap slot, so
          // we choose the grass normal for maximum visual pop. If you want to
          // blend both, a custom ShaderMaterial would be required.
          normalMap={textures.grassNormal}
          normalScale={[0.6, 0.6]}  // tune 0–1: higher = deeper grass grooves

          // ── Surface properties ───────────────────────────────────
          roughness={0.85}   // matte — not shiny plastic
          metalness={0.0}    // grass/soil is never metallic

          side={THREE.FrontSide}
        />
      </mesh>

      {/* ── Shadow-catching ground beneath terrain ───────────────── */}
      <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
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
