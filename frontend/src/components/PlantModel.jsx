import { useGLTF } from '@react-three/drei';
import { useEffect } from 'react';

function PlantModel({ url, scale = 1 }) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              mat.side = THREE.DoubleSide;
            });
          } else {
            child.material.side = THREE.DoubleSide;
          }
        }
        if (child.geometry) {
          child.geometry.computeBoundingBox();
          child.geometry.computeBoundingSphere();
        }
      }
    });
  }, [scene]);

  return (
    <primitive
      object={scene}
      scale={[scale, scale, scale]}
      rotation={[0, 0, 0]} // keep upright
    />
  );
}

export default PlantModel;