import { useMemo } from 'react';
import * as THREE from 'three';

/* ============================================================
   Procedural 3D hardscape / furniture generators
   ============================================================ */

const stoneMat = new THREE.MeshStandardMaterial({ color: '#8a8a7a', roughness: 0.92, metalness: 0.02 });
const woodMat = new THREE.MeshStandardMaterial({ color: '#8B6914', roughness: 0.85, metalness: 0.0 });
const metalMat = new THREE.MeshStandardMaterial({ color: '#4a4a4a', roughness: 0.4, metalness: 0.7 });

// ── River Stones ──────────────────────────────────────────────
export function RiverStones({ scale = 1, ...props }) {
  const stones = useMemo(() => {
    const items = [];
    for (let i = 0; i < 7; i++) {
      items.push({
        pos: [(Math.random() - 0.5) * 0.6, Math.random() * 0.05, (Math.random() - 0.5) * 0.6],
        s: [0.08 + Math.random() * 0.1, 0.05 + Math.random() * 0.06, 0.08 + Math.random() * 0.1],
        r: [Math.random(), Math.random(), Math.random()],
      });
    }
    return items;
  }, []);

  return (
    <group {...props} scale={[scale, scale, scale]}>
      {stones.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={s.r} castShadow receiveShadow>
          <sphereGeometry args={[1, 6, 5]} />
          <primitive object={stoneMat} attach="material" />
          <group scale={s.s} />
        </mesh>
      ))}
    </group>
  );
}

// ── Stepping Path ─────────────────────────────────────────────
export function SteppingPath({ scale = 1, ...props }) {
  const tiles = useMemo(() => {
    const items = [];
    for (let i = 0; i < 5; i++) {
      items.push({
        pos: [(Math.random() - 0.5) * 0.3, 0.02, i * 0.5 - 1],
        rot: [0, Math.random() * 0.3, 0],
      });
    }
    return items;
  }, []);

  return (
    <group {...props} scale={[scale, scale, scale]}>
      {tiles.map((t, i) => (
        <mesh key={i} position={t.pos} rotation={t.rot} castShadow receiveShadow>
          <boxGeometry args={[0.4, 0.04, 0.35]} />
          <meshStandardMaterial color="#9e9e87" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ── Garden Bench ──────────────────────────────────────────────
export function GardenBench({ scale = 1, ...props }) {
  return (
    <group {...props} scale={[scale, scale, scale]}>
      {/* Seat */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.05, 0.35]} />
        <primitive object={woodMat} attach="material" />
      </mesh>
      {/* Back rest */}
      <mesh position={[0, 0.55, -0.15]} castShadow>
        <boxGeometry args={[1.0, 0.35, 0.03]} />
        <primitive object={woodMat} attach="material" />
      </mesh>
      {/* Legs */}
      {[[-0.4, 0.17, 0.1], [0.4, 0.17, 0.1], [-0.4, 0.17, -0.1], [0.4, 0.17, -0.1]].map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <boxGeometry args={[0.04, 0.35, 0.04]} />
          <primitive object={woodMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

// ── Trellis Arch ──────────────────────────────────────────────
export function TrellisArch({ scale = 1, ...props }) {
  return (
    <group {...props} scale={[scale, scale, scale]}>
      {/* Left pillar */}
      <mesh position={[-0.5, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 2.0, 6]} />
        <primitive object={metalMat} attach="material" />
      </mesh>
      {/* Right pillar */}
      <mesh position={[0.5, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 2.0, 6]} />
        <primitive object={metalMat} attach="material" />
      </mesh>
      {/* Arch top (half torus approximation) */}
      <mesh position={[0, 2.0, 0]} rotation={[0, 0, 0]} castShadow>
        <torusGeometry args={[0.5, 0.025, 8, 12, Math.PI]} />
        <primitive object={metalMat} attach="material" />
      </mesh>
      {/* Cross bars */}
      {[0.4, 0.8, 1.2, 1.6].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} castShadow>
          <boxGeometry args={[1.0, 0.015, 0.015]} />
          <primitive object={metalMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

// ── Solar Light ───────────────────────────────────────────────
export function SolarLight({ scale = 1, ...props }) {
  return (
    <group {...props} scale={[scale, scale, scale]}>
      {/* Post */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.025, 0.8, 6]} />
        <primitive object={metalMat} attach="material" />
      </mesh>
      {/* Light housing */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#fff8dc" emissive="#fff3b0" emissiveIntensity={0.8} roughness={0.3} />
      </mesh>
      {/* Solar panel cap */}
      <mesh position={[0, 0.92, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.015, 6]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Point light */}
      <pointLight position={[0, 0.85, 0]} intensity={0.4} distance={3} color="#fff3b0" />
    </group>
  );
}

// ── Registry ──────────────────────────────────────────────────
export const HARDSCAPE_COMPONENTS = {
  river_stones: RiverStones,
  stepping_path: SteppingPath,
  garden_bench: GardenBench,
  trellis_arch: TrellisArch,
  solar_light: SolarLight,
};
