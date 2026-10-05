import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useSceneStore, type Direction } from '../../store/sceneStore';
import { damp3 } from 'maath/easing';
import { Vector3 } from 'three';

const EYE_Y = 1.6;
const DOOR_POSITIONS: Record<Direction, Vector3> = {
  east:  new Vector3(4.5, EYE_Y, 0),
  south: new Vector3(0, EYE_Y, 4.5),
  west:  new Vector3(-4.5, EYE_Y, 0),
  north: new Vector3(0, EYE_Y, -4.5),
};
// Eye height at the centre, facing the east door. The previous viewpoint sat
// 0.1 above-and-behind the origin looking at it, i.e. straight at the floor.
const CAM_ROOM = new Vector3(0, EYE_Y, 0);
const ROOM_LOOK = DOOR_POSITIONS.east;

/** Horizontal travel that counts as a swipe-to-turn (touch or mouse drag). */
export const SWIPE_MIN_PX = 40;

const TURN_KEYS: Record<string, 1 | -1> = {
  ArrowRight: 1, KeyD: 1, KeyE: 1,
  ArrowLeft: -1, KeyA: -1, KeyQ: -1,
};

function dirFromPhase(phase: string): Direction | null {
  const m = phase.match(/^(?:walkingTo|scene):(.+)$/);
  return m ? (m[1] as Direction) : null;
}

export function CameraDirector() {
  const { camera, gl } = useThree();
  const phase = useSceneStore((s) => s.phase);
  const facing = useSceneStore((s) => s.facing);
  const turn = useSceneStore((s) => s.turn);
  const targetPos = useRef(CAM_ROOM.clone());
  const targetLook = useRef(ROOM_LOOK.clone());
  const lookAt = useRef(ROOM_LOOK.clone());

  // The door scene leaves the camera at the canvas default (0,0,5), which is
  // inside the south wall; place it before the first room frame.
  useEffect(() => {
    const look = DOOR_POSITIONS[useSceneStore.getState().facing];
    camera.position.copy(CAM_ROOM);
    camera.lookAt(look);
    lookAt.current.copy(look);
  }, [camera]);

  useEffect(() => {
    if (phase !== 'templeRoom') return;
    const onKey = (e: KeyboardEvent) => {
      const step = TURN_KEYS[e.code];
      if (step) turn(step);
    };
    // Swipe left turns right, as if dragging the room past you.
    const el = gl.domElement;
    let start: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { start = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) turn(dx < 0 ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
    };
  }, [phase, turn, gl]);

  useEffect(() => {
    if (phase === 'templeRoom') {
      targetPos.current.copy(CAM_ROOM);
      targetLook.current.copy(DOOR_POSITIONS[facing]);
    } else {
      const dir = dirFromPhase(phase);
      if (dir) {
        const doorPos = DOOR_POSITIONS[dir];
        targetPos.current.set(doorPos.x * 0.6, EYE_Y, doorPos.z * 0.6);
        targetLook.current.copy(doorPos);
      }
    }
  }, [phase, facing]);

  useFrame((_state, delta) => {
    damp3(camera.position, targetPos.current, 0.3, delta);
    damp3(lookAt.current, targetLook.current, 0.3, delta);
    camera.lookAt(lookAt.current);
  });

  return null;
}
