import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useSceneStore, type Direction } from '../../store/sceneStore';
import { damp3 } from 'maath/easing';
import { Vector3 } from 'three';

const ROOM_CENTER = new Vector3(0, 0, 0);
const DOOR_POSITIONS: Record<Direction, Vector3> = {
  east:  new Vector3(4.5, 0, 0),
  south: new Vector3(0, 0, 4.5),
  west:  new Vector3(-4.5, 0, 0),
  north: new Vector3(0, 0, -4.5),
};
const CAM_ROOM = new Vector3(0, 1.5, 0.1);

function dirFromPhase(phase: string): Direction | null {
  const m = phase.match(/^(?:walkingTo|scene):(.+)$/);
  return m ? (m[1] as Direction) : null;
}

export function CameraDirector() {
  const { camera } = useThree();
  const phase = useSceneStore((s) => s.phase);
  const targetPos = useRef(new Vector3(0, 1.5, 5));
  const targetLook = useRef(new Vector3(0, 1.5, 0));
  const lookAt = useRef(new Vector3());

  useEffect(() => {
    if (phase === 'templeRoom') {
      targetPos.current.copy(CAM_ROOM);
      targetLook.current.copy(ROOM_CENTER);
    } else {
      const dir = dirFromPhase(phase);
      if (dir) {
        const doorPos = DOOR_POSITIONS[dir];
        targetPos.current.set(doorPos.x * 0.6, 1.5, doorPos.z * 0.6);
        targetLook.current.copy(doorPos);
      }
    }
  }, [phase]);

  useFrame((_state, delta) => {
    damp3(camera.position, targetPos.current, 0.3, delta);
    damp3(lookAt.current, targetLook.current, 0.3, delta);
    camera.lookAt(lookAt.current);
  });

  return null;
}
