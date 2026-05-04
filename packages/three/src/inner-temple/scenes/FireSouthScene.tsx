import React from 'react';
import { Sky, Sparkles } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { FogExp2 } from 'three';

export function FireSouthScene() {
  const { scene } = useThree();
  React.useEffect(() => {
    scene.fog = new FogExp2('#e8c080', 0.01);
    return () => { scene.fog = null; };
  }, [scene]);

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[0, 1, 0]}
        inclination={0.0}
        azimuth={0.5}
        turbidity={10}
        rayleigh={0.5}
        mieCoefficient={0.03}
        mieDirectionalG={0.9}
      />
      <ambientLight intensity={2.5} color="#ffe0a0" />
      <directionalLight position={[0, 10, 0]} intensity={4} color="#fff5d0" />

      {/* Desert ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
        <planeGeometry args={[80, 80, 20, 20]} />
        <meshStandardMaterial color="#c8a060" roughness={1} />
      </mesh>

      {/* Heat haze particles */}
      <Sparkles
        count={60}
        scale={[15, 3, 15]}
        size={3}
        speed={0.2}
        opacity={0.15}
        color="#ffe090"
        noise={0.5}
      />

      {/* Sand dune silhouettes */}
      {[[-8, 0, -12], [10, 0, -18], [-4, 0, -24]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y as number - 0.2, z]}>
          <sphereGeometry args={[3 + i, 8, 4]} />
          <meshStandardMaterial color="#b89050" roughness={1} />
        </mesh>
      ))}
    </>
  );
}
