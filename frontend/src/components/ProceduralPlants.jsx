import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ============================================================
   Procedural 3D plant generators — no external GLB files needed.
   Each component accepts: scale, color (optional variant)
   ============================================================ */

// ── Shared Materials ──────────────────────────────────────────
const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4226', roughness: 0.9, metalness: 0.05 });
const leafGreen = new THREE.MeshStandardMaterial({ color: '#2d8a4e', roughness: 0.7, metalness: 0.0, side: THREE.DoubleSide });
const darkGreen = new THREE.MeshStandardMaterial({ color: '#1a5c32', roughness: 0.75, metalness: 0.0, side: THREE.DoubleSide });
const flowerPink = new THREE.MeshStandardMaterial({ color: '#e84393', roughness: 0.5, metalness: 0.05 });
const flowerWhite = new THREE.MeshStandardMaterial({ color: '#ffecd2', roughness: 0.4, metalness: 0.05 });
const flowerOrange = new THREE.MeshStandardMaterial({ color: '#e17055', roughness: 0.45, metalness: 0.05 });
const flowerRed = new THREE.MeshStandardMaterial({ color: '#d63031', roughness: 0.45, metalness: 0.05 });
const yellowGreen = new THREE.MeshStandardMaterial({ color: '#a8d948', roughness: 0.65, metalness: 0.0, side: THREE.DoubleSide });

// ── Coconut Palm ──────────────────────────────────────────────
export function CoconutPalm({ scale = 1, ...props }) {
  const groupRef = useRef();
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        if (child.userData.frond) {
          child.rotation.z = child.userData.baseZ + Math.sin(clock.elapsedTime * 0.8 + i) * 0.04;
        }
      });
    }
  });

  const fronds = useMemo(() => {
    const items = [];
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      items.push({ angle, tilt: 0.6 + Math.random() * 0.4 });
    }
    return items;
  }, []);

  return (
    <group {...props} scale={[scale, scale, scale]}>
      <group ref={groupRef}>
        {/* Trunk */}
        <mesh castShadow position={[0, 1.8, 0]} rotation={[0, 0, 0.08]}>
          <cylinderGeometry args={[0.08, 0.14, 3.6, 8]} />
          <meshStandardMaterial color="#8B6914" roughness={0.95} />
        </mesh>
        {/* Fronds */}
        {fronds.map((f, i) => (
          <group key={i} position={[0, 3.5, 0]} rotation={[f.tilt, f.angle, 0]}
                 userData={{ frond: true, baseZ: 0 }}>
            <mesh castShadow>
              <boxGeometry args={[0.12, 0.02, 2.2]} />
              <primitive object={leafGreen} attach="material" />
            </mesh>
            {[0.4, 0.8, 1.2, 1.6].map((d, j) => (
              <mesh key={j} position={[0.15 * (j % 2 === 0 ? 1 : -1), 0.02, -d]} rotation={[0, 0, (j % 2 === 0 ? 0.4 : -0.4)]} castShadow>
                <boxGeometry args={[0.35, 0.01, 0.08]} />
                <primitive object={leafGreen} attach="material" />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

// ── Bougainvillea ─────────────────────────────────────────────
export function Bougainvillea({ scale = 1, ...props }) {
  const flowers = useMemo(() => {
    const items = [];
    for (let i = 0; i < 30; i++) {
      items.push({
        pos: [(Math.random() - 0.5) * 1.4, 0.5 + Math.random() * 1.2, (Math.random() - 0.5) * 1.4],
        s: 0.06 + Math.random() * 0.08,
      });
    }
    return items;
  }, []);

  return (
    <group {...props} scale={[scale, scale, scale]}>
      {/* Bush body */}
      <mesh castShadow position={[0, 0.8, 0]}>
        <sphereGeometry args={[0.8, 8, 8]} />
        <primitive object={darkGreen} attach="material" />
      </mesh>
      {/* Branches */}
      <mesh castShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 0.6, 6]} />
        <primitive object={trunkMat} attach="material" />
      </mesh>
      {/* Pink flowers */}
      {flowers.map((f, i) => (
        <mesh key={i} position={f.pos} castShadow>
          <sphereGeometry args={[f.s, 5, 5]} />
          <primitive object={flowerPink} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

// ── Bamboo Cluster ────────────────────────────────────────────
export function BambooCluster({ scale = 1, ...props }) {
  const stalks = useMemo(() => {
    const items = [];
    for (let i = 0; i < 5; i++) {
      items.push({
        x: (Math.random() - 0.5) * 0.5,
        z: (Math.random() - 0.5) * 0.5,
        h: 2.5 + Math.random() * 1.5,
      });
    }
    return items;
  }, []);

  return (
    <group {...props} scale={[scale, scale, scale]}>
      {stalks.map((s, i) => (
        <group key={i} position={[s.x, s.h / 2, s.z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.04, 0.05, s.h, 6]} />
            <meshStandardMaterial color="#7ab648" roughness={0.7} />
          </mesh>
          {/* Leaf tufts at top */}
          <mesh position={[0.15, s.h * 0.45, 0]} rotation={[0, 0, 0.8]} castShadow>
            <boxGeometry args={[0.4, 0.01, 0.06]} />
            <primitive object={leafGreen} attach="material" />
          </mesh>
          <mesh position={[-0.12, s.h * 0.42, 0.05]} rotation={[0.2, 0.5, -0.6]} castShadow>
            <boxGeometry args={[0.35, 0.01, 0.05]} />
            <primitive object={leafGreen} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Frangipani ────────────────────────────────────────────────
export function Frangipani({ scale = 1, ...props }) {
  return (
    <group {...props} scale={[scale, scale, scale]}>
      <mesh castShadow position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.06, 0.12, 1.6, 6]} />
        <primitive object={trunkMat} attach="material" />
      </mesh>
      {/* Branches */}
      {[0, 1.2, 2.4, 3.6, 4.8].map((a, i) => (
        <group key={i} position={[0, 1.5, 0]} rotation={[0.5, a, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.03, 0.04, 0.7, 4]} />
            <primitive object={trunkMat} attach="material" />
          </mesh>
          <mesh position={[0, 0.35, 0]} castShadow>
            <sphereGeometry args={[0.15, 6, 6]} />
            <primitive object={leafGreen} attach="material" />
          </mesh>
          {/* Flowers */}
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.07, 5, 5]} />
            <primitive object={flowerWhite} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Bird of Paradise ──────────────────────────────────────────
export function BirdOfParadise({ scale = 1, ...props }) {
  return (
    <group {...props} scale={[scale, scale, scale]}>
      {/* Large leaves */}
      {[0, 0.8, 1.6, 2.4, 3.2].map((a, i) => (
        <group key={i} rotation={[0.3 + i * 0.1, a, 0]} position={[0, 0.2, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.01, 1.4]} />
            <primitive object={leafGreen} attach="material" />
          </mesh>
        </group>
      ))}
      {/* Flower */}
      <mesh position={[0.2, 1.3, 0]} rotation={[0.3, 0, 0.6]} castShadow>
        <coneGeometry args={[0.08, 0.4, 5]} />
        <primitive object={flowerOrange} attach="material" />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.6, 5]} />
        <meshStandardMaterial color="#556b2f" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ── Banana Plant ──────────────────────────────────────────────
export function BananaPlant({ scale = 1, ...props }) {
  return (
    <group {...props} scale={[scale, scale, scale]}>
      <mesh castShadow position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 1.6, 8]} />
        <meshStandardMaterial color="#5d8a3c" roughness={0.8} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} position={[0, 1.5, 0]} rotation={[0.5 + i * 0.12, i * 1.26, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.6, 0.015, 1.6]} />
            <primitive object={leafGreen} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Traveler's Palm ───────────────────────────────────────────
export function TravelersPalm({ scale = 1, ...props }) {
  return (
    <group {...props} scale={[scale, scale, scale]}>
      <mesh castShadow position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.1, 0.15, 2.4, 6]} />
        <primitive object={trunkMat} attach="material" />
      </mesh>
      {/* Fan leaves */}
      {[-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2].map((a, i) => (
        <group key={i} position={[0, 2.3, 0]} rotation={[0, 0, a * 0.4]}>
          <mesh castShadow>
            <boxGeometry args={[0.08, 2.0, 0.01]} />
            <meshStandardMaterial color="#2e7d32" roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Hibiscus ──────────────────────────────────────────────────
export function Hibiscus({ scale = 1, ...props }) {
  const flowers = useMemo(() => {
    const items = [];
    for (let i = 0; i < 8; i++) {
      items.push({
        pos: [(Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8],
      });
    }
    return items;
  }, []);

  return (
    <group {...props} scale={[scale, scale, scale]}>
      <mesh castShadow position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.55, 7, 7]} />
        <primitive object={darkGreen} attach="material" />
      </mesh>
      {flowers.map((f, i) => (
        <mesh key={i} position={f.pos} castShadow>
          <sphereGeometry args={[0.08, 5, 5]} />
          <primitive object={flowerRed} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

// ── Golden Duranta ────────────────────────────────────────────
export function Duranta({ scale = 1, ...props }) {
  return (
    <group {...props} scale={[scale, scale, scale]}>
      <mesh castShadow position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.45, 8, 6]} />
        <primitive object={yellowGreen} attach="material" />
      </mesh>
      <mesh castShadow position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.2, 5]} />
        <primitive object={trunkMat} attach="material" />
      </mesh>
    </group>
  );
}

// ── Santan (Ixora) ────────────────────────────────────────────
export function Santan({ scale = 1, ...props }) {
  const clusters = useMemo(() => {
    const items = [];
    for (let i = 0; i < 6; i++) {
      items.push({
        pos: [(Math.random() - 0.5) * 0.5, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5],
      });
    }
    return items;
  }, []);

  return (
    <group {...props} scale={[scale, scale, scale]}>
      <mesh castShadow position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.4, 7, 6]} />
        <primitive object={darkGreen} attach="material" />
      </mesh>
      {clusters.map((c, i) => (
        <mesh key={i} position={c.pos} castShadow>
          <sphereGeometry args={[0.09, 5, 5]} />
          <primitive object={flowerRed} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

// ── Registry for lookup by model_type ─────────────────────────
export const PLANT_COMPONENTS = {
  coconut_palm: CoconutPalm,
  bougainvillea: Bougainvillea,
  bamboo: BambooCluster,
  frangipani: Frangipani,
  bird_of_paradise: BirdOfParadise,
  banana: BananaPlant,
  travelers_palm: TravelersPalm,
  hibiscus: Hibiscus,
  duranta: Duranta,
  santan: Santan,
};
