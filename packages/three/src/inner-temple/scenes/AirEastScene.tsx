import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky, Sparkles } from '@react-three/drei';
import { FogExp2, InstancedMesh, Object3D, MathUtils } from 'three';
import { useThree } from '@react-three/fiber';

const BLADE_COUNT = 4000;
const dummy = new Object3D();

function GrassField() {
  const ref = useRef<InstancedMesh>(null!);

  useMemo(() => {
    // positions set once
  }, []);

  React.useEffect(() => {
    for (let i = 0; i < BLADE_COUNT; i++) {
      dummy.position.set(
        MathUtils.randFloatSpread(30),
        0,
        MathUtils.randFloatSpread(30),
      );
      dummy.scale.setScalar(MathUtils.randFloat(0.4, 1.2));
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      ref.current?.setMatrixAt(i, dummy.matrix);
    }
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < BLADE_COUNT; i += 5) {
      ref.current.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
      dummy.rotation.z = Math.sin(t * 1.5 + dummy.position.x * 0.5) * 0.15;
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, BLADE_COUNT]} castShadow>
      <boxGeometry args={[0.06, 0.8, 0.04]} />
      <meshStandardMaterial color="#4a7a3a" roughness={0.9} />
    </instancedMesh>
  );
}

export function AirEastScene() {
  const { scene } = useThree();
  React.useEffect(() => {
    scene.fog = new FogExp2('#b8d4c0', 0.04);
    return () => { scene.fog = null; };
  }, [scene]);

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[1, 0.4, 0]}
        inclination={0.49}
        azimuth={0.25}
        turbidity={4}
        rayleigh={0.8}
      />
      <ambientLight intensity={1.2} color="#c8e0d0" />
      <directionalLight position={[5, 8, 3]} intensity={1.5} color="#fff8e0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#3a6230" roughness={1} />
      </mesh>
      <GrassField />
      <Sparkles
        count={120}
        scale={20}
        size={2}
        speed={0.4}
        opacity={0.6}
        color="#e0f0e0"
        noise={1}
      />
    </>
  );
}
