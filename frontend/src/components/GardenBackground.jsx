import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Html, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { DEFAULT_LOT, LOT_MARGIN } from '../data/lot';
import { planMaskCanvas } from '../data/gardenPlanMask';
import { buildGroundcover } from '../data/groundcoverField';
import { buildGrass, DEFAULT_LAWN_LOOK } from '../data/grassField';
import { useFrame } from '@react-three/fiber';

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
     outline – the yard's own shape ([{x, z, house}] in lot metres, data/lot.js) or null: the part of the lot
               outside it is paved over, the edging follows its sides, house walls get a dark plinth
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
    displacementScale = 2.5,
    lotWidth = DEFAULT_LOT.width,
    lotLength = DEFAULT_LOT.length,
    showGrid = false,
    outline = null,
    gardenPlan = null, // beds + lawn from the AI Designer (dimensions.gardenPlan): beds drawn as mulch
    ground = null,     // DesignContext's { beds, entries }: beds round the plants (hand-made designs) and their groundcover
    groundPlants = [], // [{ x, z, h, s }] lot metres from the back-left corner: grown height / spread (shade under crowns)
    growthStage = 'established',
    lite = false,
    lawnLook = DEFAULT_LAWN_LOOK,   // how long the grass looks (data/grassField.js LAWN_LOOKS)
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
  // The design's planting beds: mulch over the lawn, cut out where the open lawn is (not on a photo,
  // where the real ground is shown)
  const plantMask = gardenPlan?.lawn ? null : ground?.beds?.mask || null;
  const bedMask = useMemo(() => {
    if (isPhoto) return null;
    // An AI plan's beds, else (a hand-made design) the beds round its plants
    const canvas = planMaskCanvas(gardenPlan, lotWidth, lotLength) || plantMask;
    if (!canvas) return null;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.NoColorSpace;   // data, not colour
    return t;
  }, [gardenPlan, lotWidth, lotLength, isPhoto, plantMask]);
  useEffect(() => () => bedMask?.dispose(), [bedMask]);

  // Groundcover over those beds (data/groundcoverField.js), growing with the growth stage. Not on a photo (the photo is
  // the ground). The default depth map is nearly flat (29–38 of 255), so one height fits it.
  const gcKey = ground?.entries?.length ? JSON.stringify(ground.entries) : '';
  const groundcover = useMemo(() => {
    if (isPhoto || !gcKey) return null;
    return buildGroundcover(gardenPlan?.lawn ? gardenPlan : null, lotWidth, lotLength, ground.entries, {
      plants: groundPlants, stage: growthStage, lite, outline, beds: gardenPlan?.lawn ? null : ground.beds,
      heightOf: (p) => p.h || 0, spreadOf: (p) => p.s || 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gcKey stands for ground.entries
  }, [isPhoto, gcKey, gardenPlan, lotWidth, lotLength, groundPlants, growthStage, lite, outline, ground?.beds]);
  useEffect(() => () => groundcover?.dispose(), [groundcover]);
  // (at the default terrain's HIGHEST point, depth 38/255, plus the bed mesh's 1 cm: the mulch never hides it)
  const groundY = displacementScale * (38 / 255 - 0.1) + 0.012;

  // Living grass (data/grassField.js, the same as the AI 3D view): blades on the lawn — the AI plan's lawn, or round
  // the beds of a hand-made design — rooted on the displaced terrain (heightAt reads the depth map the lot mesh is
  // pushed by). Not on their own photo (the photo is the ground).
  const heightAt = useMemo(() => {
    const img = textures?.depthMap?.image;
    if (isPhoto || !img || !(img.width > 4)) return null;
    try {
      const cw = Math.min(256, img.width), ch = Math.min(256, img.height);
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, cw, ch);
      const data = ctx.getImageData(0, 0, cw, ch).data;
      // the lot mesh: UV (x/W, 1 − z/L) with the image's top row at the back; y = scale × (depth − 0.1)
      return (x, z) => {
        const px = Math.min(cw - 1, Math.max(0, Math.floor((x / lotWidth) * cw)));
        const pz = Math.min(ch - 1, Math.max(0, Math.floor((z / lotLength) * ch)));
        return displacementScale * (data[(pz * cw + px) * 4] / 255 - 0.1);
      };
    } catch {
      return null;
    }
  }, [textures, isPhoto, lotWidth, lotLength, displacementScale]);
  const grass = useMemo(() => {
    if (isPhoto || !heightAt) return null;
    const still = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const plan = gardenPlan?.lawn ? gardenPlan : null;
    // a hand-made design: no grass in the beds round its plants (the same beds the mulch is drawn from)
    return buildGrass(plan, lotWidth, lotLength, { outline, lite, still, beds: plan ? null : ground?.beds || null, look: lawnLook, heightAt });
  }, [isPhoto, heightAt, gardenPlan, lotWidth, lotLength, outline, lite, ground?.beds, lawnLook]);
  useEffect(() => () => grass?.dispose(), [grass]);
  useFrame(({ clock }) => grass?.tick(clock.elapsedTime));

  // A shaped yard: paving over the rest of the lot, as a mask on the lot's own (displaced) ground like the
  // beds above — white outside the yard. Canvas (px, py) = lot (x, z) × pixels per metre, top row = the back.
  const shapeKey = outline ? JSON.stringify(outline) : '';
  const pavingMask = useMemo(() => {
    if (!outline) return null;
    const px = Math.min(64, 1024 / Math.max(lotWidth, lotLength));
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(lotWidth * px)); c.height = Math.max(2, Math.round(lotLength * px));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#000000'; ctx.beginPath();
    outline.forEach((p, i) => (i ? ctx.lineTo(p.x * px, p.z * px) : ctx.moveTo(p.x * px, p.z * px)));
    ctx.closePath(); ctx.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shapeKey stands for outline
  }, [shapeKey, lotWidth, lotLength]);
  useEffect(() => () => pavingMask?.dispose(), [pavingMask]);
  const sides = outline ? outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length];
    const ax = a.x - lotWidth / 2, az = a.z - lotLength / 2, bx = b.x - lotWidth / 2, bz = b.z - lotLength / 2;
    return { key: i, house: !!a.house, x: (ax + bx) / 2, z: (az + bz) / 2, len: Math.hypot(bx - ax, bz - az),
      angle: -Math.atan2(bz - az, bx - ax) };
  }).filter(sd => sd.len > 0.05) : null;

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

      {/* ── Planting beds from the AI Designer: the lot's own shape and displacement (so they follow
          the ground), mulch-coloured, the lawn cut out by the mask. Clicks go to the lot below. ── */}
      {bedMask && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow raycast={() => null}>
          <planeGeometry args={[lotWidth, lotLength, segW, segL]} />
          <meshStandardMaterial
            color="#5d4330"
            alphaMap={bedMask}
            alphaTest={0.5}
            displacementMap={textures.depthMap}
            displacementScale={displacementScale}
            displacementBias={-displacementScale * 0.1}
            normalMap={maps.lotNormal}
            normalScale={[0.35, 0.35]}
            roughness={1}
            metalness={0}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-4}
          />
        </mesh>
      )}

      {groundcover && <primitive object={groundcover.group} position={[-lotWidth / 2, groundY, -lotLength / 2]} />}
      {grass?.mesh && <primitive object={grass.mesh} position={[-lotWidth / 2, 0.012, -lotLength / 2]} />}

      {/* ── Plain ground around the lot: duller, flat, not part of the design ── */}
      <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[outerW, outerL]} />
        <meshStandardMaterial map={maps.outer} color="#8e9a84" normalMap={maps.outerNormal}
          normalScale={[0.4, 0.4]} roughness={0.95} metalness={0} />
      </mesh>

      {/* ── A shaped yard: paving over the rest of the lot, edging along the yard's sides, house walls ── */}
      {pavingMask && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow raycast={() => null}>
          <planeGeometry args={[lotWidth, lotLength, segW, segL]} />
          <meshStandardMaterial color="#b9b4aa" alphaMap={pavingMask} alphaTest={0.5}
            displacementMap={textures.depthMap} displacementScale={displacementScale} displacementBias={-displacementScale * 0.1}
            roughness={0.95} metalness={0} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-6} />
        </mesh>
      )}
      {sides && sides.map(sd => (
        <mesh key={`side${sd.key}`} position={[sd.x, sd.house ? 0.2 : edgeY, sd.z]} rotation={[0, sd.angle, 0]} castShadow receiveShadow>
          <boxGeometry args={[sd.len + EDGING.width, sd.house ? 0.45 : EDGING.height, sd.house ? 0.3 : EDGING.width]} />
          <meshStandardMaterial color={sd.house ? '#475569' : EDGING.color} roughness={0.9} />
        </mesh>
      ))}

      {/* ── Lot edging (concrete) ── */}
      {!outline && [
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
