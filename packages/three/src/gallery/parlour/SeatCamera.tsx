import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { damp3 } from 'maath/easing';
import type { ParlourSeat } from './layout';

const LOOK_SENSITIVITY = 0.0032;
/** How far a seated visitor can turn their head before they would be standing. */
const YAW_LIMIT = 1.1;
const PITCH_LIMIT = 0.55;
const UP = new Vector3(0, 1, 0);

/**
 * A seated camera. It eases between seats and always faces the painting, and a
 * drag turns the head within reason — enough to take in the doors and the
 * room, not enough to end up staring at the ceiling.
 */
export function SeatCamera({ seat, lookAt }: { seat: ParlourSeat; lookAt: [number, number, number] }) {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0);
  const placed = useRef(false);
  const eye = useRef(new Vector3());
  const target = useRef(new Vector3());
  const dir = useRef(new Vector3());
  const right = useRef(new Vector3());
  const point = useRef(new Vector3());

  // Each seat opens looking straight at the work.
  useEffect(() => {
    yaw.current = 0;
    pitch.current = 0;
  }, [seat.id]);

  useEffect(() => {
    const canvas = gl.domElement;
    let last: { x: number; y: number } | null = null;

    const onDown = (event: PointerEvent) => {
      last = { x: event.clientX, y: event.clientY };
    };
    const onMove = (event: PointerEvent) => {
      if (!last) return;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      last = { x: event.clientX, y: event.clientY };
      yaw.current = Math.max(-YAW_LIMIT, Math.min(YAW_LIMIT, yaw.current - dx * LOOK_SENSITIVITY));
      pitch.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch.current - dy * LOOK_SENSITIVITY));
    };
    const onUp = () => {
      last = null;
    };

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1);
    eye.current.set(...seat.position);
    target.current.set(...lookAt);

    // Arrive in the room already seated; glide only between seats.
    if (!placed.current) {
      camera.position.copy(eye.current);
      placed.current = true;
    } else {
      damp3(camera.position, eye.current, 0.5, step);
    }

    dir.current.subVectors(target.current, camera.position).normalize();
    dir.current.applyAxisAngle(UP, yaw.current);
    right.current.crossVectors(dir.current, UP).normalize();
    dir.current.applyAxisAngle(right.current, pitch.current);
    camera.lookAt(point.current.copy(camera.position).add(dir.current));
  });

  return null;
}
