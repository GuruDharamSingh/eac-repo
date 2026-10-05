import React, { useRef } from 'react';
import { MeshPortalMaterial, useCursor } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useSceneStore, type Direction } from '../store/sceneStore';
import { Drape } from './Drape';
import { SWIPE_MIN_PX } from './controls/CameraDirector';
import { damp } from 'maath/easing';
import type { ThreeElements } from '@react-three/fiber';

/** drei 10 exports no instance type for the portal; its ref is typed as the element. */
type PortalMaterial = ThreeElements['portalMaterialImpl'];

interface ElementDoorProps {
  direction: Direction;
  color: string;
  position: [number, number, number];
  rotation: [number, number, number];
  children: React.ReactNode;
}

export function ElementDoor({ direction, color, position, rotation, children }: ElementDoorProps) {
  const phase = useSceneStore((s) => s.phase);
  const setPhase = useSceneStore((s) => s.setPhase);
  const returnToRoom = useSceneStore((s) => s.returnToRoom);
  const portalRef = useRef<PortalMaterial>(null!);
  const [hovered, setHovered] = React.useState(false);
  useCursor(hovered);

  const isActive = phase === `scene:${direction}` || phase === `walkingTo:${direction}`;

  useFrame((_state, delta) => {
    if (!portalRef.current) return;
    const target = isActive ? 1 : 0;
    damp(portalRef.current, 'blend', target, 0.3, delta);

    if (phase === `walkingTo:${direction}` && portalRef.current.blend > 0.9) {
      setPhase(`scene:${direction}`);
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    // A swipe that ends on the door is a turn, not a tap (see CameraDirector).
    if (e.delta > SWIPE_MIN_PX / 2) return;
    if (phase === 'templeRoom') {
      setPhase(`walkingTo:${direction}`);
    } else if (phase === `scene:${direction}`) {
      returnToRoom();
    }
  };

  return (
    <group position={position} rotation={rotation}>
      {/* Door arch frame */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[2.2, 3.2, 0.1]} />
        <meshStandardMaterial color="#1a0e06" roughness={0.95} />
      </mesh>

      {/* Portal mesh with nested scene */}
      <mesh
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[2.0, 3.0]} />
        <MeshPortalMaterial ref={portalRef} blur={0} resolution={512}>
          {children}
        </MeshPortalMaterial>
      </mesh>

      {/* Drape overlay (visible when blend is low) */}
      <group position={[0, 0, 0.02]}>
        <Drape color={color} blowStrength={hovered || isActive ? 2.5 : 1.0} />
      </group>
    </group>
  );
}
