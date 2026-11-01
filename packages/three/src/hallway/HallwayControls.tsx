import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Vector3 } from 'three';
import { damp, damp3 } from 'maath/easing';
import { readTouchMove } from '../gallery/controls/touch-input';
import { useHallwayStore } from './store';

const WALK_SPEED = 2.6;
const RUN_MULTIPLIER = 2;
const LOOK_SENSITIVITY = 0.0032;
const PITCH_LIMIT = Math.PI / 2 - 0.12;
/** How far crouching lowers the eye: 1.62 m standing to about 1.2 m, a seated visitor's view. */
const CROUCH_DROP = 0.42;

const FORWARD_KEYS = new Set(['KeyW', 'ArrowUp']);
const BACK_KEYS = new Set(['KeyS', 'ArrowDown']);
const LEFT_KEYS = new Set(['KeyA', 'ArrowLeft']);
const RIGHT_KEYS = new Set(['KeyD', 'ArrowRight']);

/**
 * Walking the hall: drag to look, WASD or the thumbstick to move, held inside
 * the corridor. A selected piece glides the camera to stand across from it,
 * and any step taken hands control straight back.
 *
 * While a piece is being carried a drag must place it, not turn the head, so
 * looking pauses — but walking does not, which is what lets a curator carry
 * a work down the hall to the wall it belongs on.
 *
 * Space toggles between standing and crouching; visitors start crouched, at
 * roughly the height of someone seated in the room, and the eye eases between
 * the two. A glide to a piece arrives at whichever height is current.
 */
export function HallwayControls() {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0);
  const position = useRef(new Vector3(0, 1.62, 0));
  const look = useRef(new Vector3());
  const keys = useRef(new Set<string>());
  const dragging = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const wasFocused = useRef(false);
  // How far below standing eye height the camera is right now; eased toward the target.
  const drop = useRef(useHallwayStore.getState().crouching ? CROUCH_DROP : 0);
  const tmp = useRef({ forward: new Vector3(), right: new Vector3(), euler: new Euler(0, 0, 0, 'YXZ') });

  // Step in where the cutaway was looking, facing on down the hall.
  useEffect(() => {
    const { venue, wallS } = useHallwayStore.getState();
    const from = venue!.walkFrom(wallS);
    position.current.set(...from.position);
    position.current.y -= drop.current;
    camera.position.copy(position.current);
    camera.rotation.order = 'YXZ';
    camera.lookAt(...from.lookAt);
    yaw.current = camera.rotation.y;
    pitch.current = camera.rotation.x;
  }, [camera]);

  useEffect(() => {
    const canvas = gl.domElement;
    const typing = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Tab' || event.code === 'Escape' || typing()) return;
      if (event.code === 'Space') {
        const el = document.activeElement;
        // A control reached by keyboard keeps Space for itself.
        if (el instanceof HTMLElement && el !== document.body && el.matches(':focus-visible')) return;
        // Keep the page from scrolling, and a button focused by a click (the
        // Walk toggle, say) from being pressed again by the same key.
        event.preventDefault();
        if (el instanceof HTMLButtonElement) el.blur();
        if (!event.repeat) {
          const { crouching, setCrouching } = useHallwayStore.getState();
          setCrouching(!crouching);
        }
        return;
      }
      keys.current.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.code);
    const onBlur = () => keys.current.clear();
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragging.current = true;
      last.current = { x: event.clientX, y: event.clientY };
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging.current || !last.current) return;
      const dx = event.clientX - last.current.x;
      const dy = event.clientY - last.current.y;
      last.current = { x: event.clientX, y: event.clientY };
      const state = useHallwayStore.getState();
      if (state.drag) return;
      // Looking away from a piece the camera glided to hands control back.
      if (state.focus) useHallwayStore.setState({ focus: null });
      yaw.current -= dx * LOOK_SENSITIVITY;
      pitch.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch.current - dy * LOOK_SENSITIVITY));
    };
    const onUp = () => {
      dragging.current = false;
      last.current = null;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      keys.current.clear();
    };
  }, [gl]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1);
    const { focus, crouching, venue } = useHallwayStore.getState();
    damp(drop, 'current', crouching ? CROUCH_DROP : 0, 0.18, step);
    const eyeY = venue!.eyeY - drop.current;

    const k = keys.current;
    const touch = readTouchMove();
    const fwd = (any(k, FORWARD_KEYS) ? 1 : 0) - (any(k, BACK_KEYS) ? 1 : 0) - touch.y;
    const side = (any(k, RIGHT_KEYS) ? 1 : 0) - (any(k, LEFT_KEYS) ? 1 : 0) + touch.x;
    const moving = Math.abs(fwd) > 0.01 || Math.abs(side) > 0.01;

    if (focus && !moving) {
      wasFocused.current = true;
      const target = new Vector3(focus.position[0], focus.position[1] - drop.current, focus.position[2]);
      damp3(camera.position, target, 0.32, step);
      damp3(look.current, new Vector3(...focus.lookAt), 0.26, step);
      camera.lookAt(look.current);
      position.current.copy(camera.position);
      return;
    }

    if (wasFocused.current) {
      // Hand back from wherever the glide left the camera looking.
      wasFocused.current = false;
      tmp.current.euler.setFromQuaternion(camera.quaternion, 'YXZ');
      yaw.current = tmp.current.euler.y;
      pitch.current = tmp.current.euler.x;
    }
    // A step ends the glide but keeps the selection: a curator walking off to
    // check a sightline still has the piece they were framing.
    if (moving && focus) useHallwayStore.setState({ focus: null });

    if (moving) {
      const speed = WALK_SPEED * (k.has('ShiftLeft') || k.has('ShiftRight') ? RUN_MULTIPLIER : 1);
      const { forward, right } = tmp.current;
      forward.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
      right.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
      const len = Math.min(1, Math.hypot(fwd, side));
      const scale = (speed * step * len) / (Math.hypot(fwd, side) || 1);
      const nx = position.current.x + (forward.x * fwd + right.x * side) * scale;
      const nz = position.current.z + (forward.z * fwd + right.z * side) * scale;
      const [cx, cz] = venue!.clamp(nx, nz);
      position.current.set(cx, eyeY, cz);
    }
    position.current.y = eyeY;

    camera.position.copy(position.current);
    tmp.current.euler.set(pitch.current, yaw.current, 0, 'YXZ');
    camera.quaternion.setFromEuler(tmp.current.euler);
    look.current.copy(camera.position).add(new Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
  });

  return null;
}

function any(pressed: Set<string>, set: Set<string>): boolean {
  for (const code of set) if (pressed.has(code)) return true;
  return false;
}
