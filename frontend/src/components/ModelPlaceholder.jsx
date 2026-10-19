import { Html } from '@react-three/drei';

/* Simple category-shaped stand-in, shown while a .glb loads or when it fails / is missing */
export default function ModelPlaceholder({ category, label }) {
  const color = label ? '#ef4444' : '#9ca3af';
  return (
    <group>
      {category === 'plant' ? (
        <mesh position={[0, 0.6, 0]} castShadow>
          <coneGeometry args={[0.4, 1.2, 8]} />
          <meshStandardMaterial color={label ? color : '#16a34a'} wireframe={!!label} />
        </mesh>
      ) : category === 'hardscape' ? (
        <mesh position={[0, 0.3, 0]} castShadow>
          <dodecahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial color={label ? color : '#78716c'} wireframe={!!label} />
        </mesh>
      ) : (
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={label ? color : '#a16207'} wireframe={!!label} />
        </mesh>
      )}
      {label && (
        <Html center position={[0, 1.4, 0]}>
          <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap shadow-lg">
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}
