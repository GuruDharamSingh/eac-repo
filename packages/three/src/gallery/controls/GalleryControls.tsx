import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Vector3 } from 'three';
import { damp3 } from 'maath/easing';
import { useGalleryStore } from '../store';
import { clampToRoom, EYE_Y } from '../room';
import { HALL, type RoomDesign } from '../designs';
import { readTouchMove } from './touch-input';

const WALK_SPEED = 3.4;
const RUN_MULTIPLIER = 1.9;
const LOOK_SENSITIVITY = 0.0032;
const PITCH_LIMIT = Math.PI / 2 - 0.12;
/** Below this the camera is treated as having arrived. */
const ARRIVAL_EPSILON = 0.08;

const FORWARD_KEYS = new Set(['KeyW', 'ArrowUp']);
const BACK_KEYS = new Set(['KeyS', 'ArrowDown']);
const LEFT_KEYS = new Set(['KeyA', 'ArrowLeft']);
const RIGHT_KEYS = new Set(['KeyD', 'ArrowRight']);

export interface GalleryControlsProps {
  /** The room being walked — its walls are what the visitor collides with. */
  design?: RoomDesign;
  /** Where the visitor is standing when the room opens. Defaults to the design's. */
  start?: [number, number, number];
}

/**
 * Two ways around the room, sharing one camera.
 *
 * Free walk is drag-to-look and WASD, which is what a desktop visitor expects.
 * Click-to-approach eases the camera to a viewpoint in front of whatever was
 * clicked — it is how you get a piece square in front of you without fighting
 * the controls, and on a phone, where a walk control is close to unusable, it
 * is the whole of the navigation.
 *
 * Handing control back is the part worth care: when the visitor leaves a
 * piece, yaw and pitch are read back off the camera so free look resumes from
 * where they are actually looking instead of snapping to a stale heading.
 */
export function GalleryControls({ design = HALL, start }: GalleryControlsProps) {
  const origin = start ?? ([design.start[0], EYE_Y, design.start[2]] as [number, number, number]);
  const { camera, gl } = useThree();
  const focus = useGalleryStore((s) => s.focus);
  const arrive = useGalleryStore((s) => s.arrive);

  const yaw = useRef(0);
  const pitch = useRef(0);
  const position = useRef(new Vector3(...origin));
  const lookTarget = useRef(new Vector3(0, EYE_Y, 0));
  const keys = useRef(new Set<string>());
  const dragging = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const wasFocused = useRef(false);

  // Position the camera before the first frame so the room never appears at
  // the origin for a moment.
  useEffect(() => {
    camera.position.copy(position.current);
    camera.rotation.order = 'YXZ';
    camera.lookAt(0, EYE_Y, 0);
    yaw.current = camera.rotation.y;
    pitch.current = camera.rotation.x;
    lookTarget.current.set(0, EYE_Y, 0);
  }, [camera]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onKeyDown = (event: KeyboardEvent) => {
      // Never swallow the keys a visitor needs for the page around the canvas.
      if (event.code === 'Tab' || event.code === 'Escape') return;
      keys.current.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.code);
    // A visitor who alt-tabs mid-stride should not come back still walking.
    const onBlur = () => keys.current.clear();

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragging.current = true;
      lastPointer.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging.current || !lastPointer.current) return;
      const dx = event.clientX - lastPointer.current.x;
      const dy = event.clientY - lastPointer.current.y;
      lastPointer.current = { x: event.clientX, y: event.clientY };

      yaw.current -= dx * LOOK_SENSITIVITY;
      pitch.current = Math.max(
        -PITCH_LIMIT,
        Math.min(PITCH_LIMIT, pitch.current - dy * LOOK_SENSITIVITY),
      );
    };

    const endDrag = () => {
      dragging.current = false;
      lastPointer.current = null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      keys.current.clear();
    };
  }, [gl]);

  useFrame((_state, delta) => {
    // A backgrounded tab resumes with a huge delta; without a cap the visitor
    // is launched across the room on the first frame back.
    const step = Math.min(delta, 0.1);

    if (focus) {
      wasFocused.current = true;

      const target = new Vector3(...focus.position);
      damp3(camera.position, target, 0.28, step);
      damp3(lookTarget.current, new Vector3(...focus.lookAt), 0.28, step);
      camera.lookAt(lookTarget.current);
      position.current.copy(camera.position);

      if (camera.position.distanceTo(target) < ARRIVAL_EPSILON) arrive();
      return;
    }

    if (wasFocused.current) {
      // Resume free look from wherever the approach left the camera pointing.
      const euler = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      yaw.current = euler.y;
      pitch.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, euler.x));
      wasFocused.current = false;
    }

    const pressed = keys.current;
    let forward = 0;
    let strafe = 0;
    for (const code of pressed) {
      if (FORWARD_KEYS.has(code)) forward += 1;
      else if (BACK_KEYS.has(code)) forward -= 1;
      else if (LEFT_KEYS.has(code)) strafe -= 1;
      else if (RIGHT_KEYS.has(code)) strafe += 1;
    }

    // The thumbstick is analogue and adds to the keys rather than replacing
    // them, so a tablet with a keyboard attached can use either.
    const touch = readTouchMove();
    forward -= touch.y;
    strafe += touch.x;

    const magnitude = Math.hypot(forward, strafe);
    if (magnitude > 0.001) {
      const running = pressed.has('ShiftLeft') || pressed.has('ShiftRight');
      // Normalise the direction, then scale by how far the stick was actually
      // pushed — a key is all-or-nothing, a thumbstick is not.
      const throttle = Math.min(1, magnitude) / magnitude;
      const speed = WALK_SPEED * step * (running ? RUN_MULTIPLIER : 1) * throttle;

      const sin = Math.sin(yaw.current);
      const cos = Math.cos(yaw.current);

      // Forward is -Z in the camera's own frame.
      const nextX = position.current.x + (-sin * forward + cos * strafe) * speed;
      const nextZ = position.current.z + (-cos * forward - sin * strafe) * speed;

      const [clampedX, clampedZ] = clampToRoom(nextX, nextZ, design);
      position.current.set(clampedX, EYE_Y, clampedZ);
    }

    camera.position.copy(position.current);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch.current, yaw.current, 0);
  });

  return null;
}
