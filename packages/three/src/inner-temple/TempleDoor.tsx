import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSceneStore } from '../store/sceneStore';
import { damp } from 'maath/easing';
import type { Group } from 'three';

export function TempleDoor() {
  const setPhase = useSceneStore((s) => s.setPhase);
  const [opening, setOpening] = useState(false);
  const doorRef = useRef<Group>(null!);
  const targetRot = useRef(0);
  const lightRef = useRef<number>(0);

  const handleClick = () => {
    setOpening(true);
    targetRot.current = -Math.PI / 2;
  };

  useFrame((_state, delta) => {
    if (!opening) return;
    damp(doorRef.current.rotation, 'y', targetRot.current, 0.4, delta);
    lightRef.current = Math.min(lightRef.current + delta * 0.5, 1);
    if (Math.abs(doorRef.current.rotation.y - targetRot.current) < 0.01) {
      setPhase('templeRoom');
    }
  });

  return (
    <group>
      <ambientLight intensity={0.4} color="#c0a060" />
      <directionalLight position={[0, 3, 4]} intensity={1.5} color="#ffe8c0" />
      <pointLight position={[0, 2, 3]} intensity={lightRef.current * 4} color="#ffe0a0" />

      {/* Door frame */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2.4, 3.4, 0.1]} />
        <meshStandardMaterial color="#4a3010" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Door panel — pivots from left edge */}
      <group ref={doorRef} position={[-1, 0, 0.06]}>
        <mesh position={[1, 0, 0]}>
          <boxGeometry args={[2, 3, 0.08]} />
          <meshStandardMaterial color="#6a3820" roughness={0.8} />
        </mesh>
        {/* Door handle */}
        <mesh position={[1.6, 0, 0.05]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color="#b08050" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>

      {/* Click target overlay */}
      {!opening && (
        <mesh
          position={[0, 0, 0.2]}
          onClick={handleClick}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'default')}
        >
          <planeGeometry args={[2.2, 3.2]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </group>
  );
}
