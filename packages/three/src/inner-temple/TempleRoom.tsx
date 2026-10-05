import React, { useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { ElementDoor } from './ElementDoor';
import { ZodiacCeiling } from './ZodiacCeiling';
import { CameraDirector } from './controls/CameraDirector';
import { AirEastScene } from './scenes/AirEastScene';
import { FireSouthScene } from './scenes/FireSouthScene';
import { WaterWestScene } from './scenes/WaterWestScene';
import { EarthNorthScene } from './scenes/EarthNorthScene';
import { useSceneStore } from '../store/sceneStore';
import { damp } from 'maath/easing';
import type { PointLight } from 'three';

const HALF = 5; // half-size of the room (10×10)
const WALL_H = 6;

function StoneRoom() {
  const lightRef = useRef<PointLight>(null!);
  const phase = useSceneStore((s) => s.phase);
  const elapsed = useRef(0);

  useFrame((_state, delta) => {
    elapsed.current += delta;
    // Physical light units (three r155+): intensity is candela with
    // inverse-square falloff, so values near 1 light nothing at 3 m.
    const target = phase === 'templeRoom' ? 30 : 10;
    damp(lightRef.current, 'intensity', target, 0.5, delta);
  });

  return (
    <>
      <ambientLight intensity={0.35} color="#806040" />
      <pointLight ref={lightRef} position={[0, 3.5, 0]} intensity={0} color="#ffd090" distance={20} />

      {/* Torch lights at 4 walls */}
      <pointLight position={[HALF - 0.5, 2.5, 0]} intensity={6} color="#ff9030" distance={8} />
      <pointLight position={[-HALF + 0.5, 2.5, 0]} intensity={6} color="#ff9030" distance={8} />
      <pointLight position={[0, 2.5, HALF - 0.5]} intensity={6} color="#ff9030" distance={8} />
      <pointLight position={[0, 2.5, -HALF + 0.5]} intensity={6} color="#ff9030" distance={8} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[HALF * 2, HALF * 2, 8, 8]} />
        <meshStandardMaterial color="#5a4632" roughness={0.95} />
      </mesh>

      {/* 4 walls (inside-facing) */}
      {/* North */}
      <mesh position={[0, WALL_H / 2 - 0.5, -HALF]} rotation={[0, 0, 0]}>
        <planeGeometry args={[HALF * 2, WALL_H]} />
        <meshStandardMaterial color="#4a3a2a" roughness={1} side={2} />
      </mesh>
      {/* South */}
      <mesh position={[0, WALL_H / 2 - 0.5, HALF]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[HALF * 2, WALL_H]} />
        <meshStandardMaterial color="#4a3a2a" roughness={1} side={2} />
      </mesh>
      {/* East */}
      <mesh position={[HALF, WALL_H / 2 - 0.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[HALF * 2, WALL_H]} />
        <meshStandardMaterial color="#4a3a2a" roughness={1} side={2} />
      </mesh>
      {/* West */}
      <mesh position={[-HALF, WALL_H / 2 - 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[HALF * 2, WALL_H]} />
        <meshStandardMaterial color="#4a3a2a" roughness={1} side={2} />
      </mesh>
    </>
  );
}

export function TempleRoom() {
  return (
    <>
      <CameraDirector />
      <StoneRoom />
      <Suspense fallback={null}>
        <ZodiacCeiling />
      </Suspense>

      {/* Air — East (+X wall); green per the developer's door scheme */}
      <ElementDoor
        direction="east"
        color="#2e8b3a"
        position={[HALF, 1.5, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <AirEastScene />
      </ElementDoor>

      {/* Fire — South (+Z wall) */}
      <ElementDoor
        direction="south"
        color="#cc2200"
        position={[0, 1.5, HALF]}
        rotation={[0, Math.PI, 0]}
      >
        <FireSouthScene />
      </ElementDoor>

      {/* Water — West (-X wall) */}
      <ElementDoor
        direction="west"
        color="#004488"
        position={[-HALF, 1.5, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <WaterWestScene />
      </ElementDoor>

      {/* Earth — North (-Z wall) */}
      <ElementDoor
        direction="north"
        color="#111111"
        position={[0, 1.5, -HALF]}
        rotation={[0, 0, 0]}
      >
        <EarthNorthScene />
      </ElementDoor>
    </>
  );
}
