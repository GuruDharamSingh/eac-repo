import { useEffect, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PerspectiveCamera, Vector3, type Camera, type Object3D } from 'three';
import { damp3 } from 'maath/easing';
import { HALL_HEIGHT, type WallFace } from './layout';
import { useHallwayStore, type ViewMode } from './store';

/** Field of view per mode: narrower for the cutaway, so a wall fills the frame. */
const FOV: Record<ViewMode, number> = { overview: 42, wall: 40, walk: 64 };
/** Metres along the route per pixel of horizontal drag in the cutaway. */
const SWIPE = 0.018;
const KEY_SPEED = 6;
const ARRIVED = 0.15;

/**
 * Hides a wall (and whatever hangs on it) whenever the camera is behind it —
 * the cutaway that lets the hall be seen from outside, as in a dollhouse.
 * Walking, nothing is hidden: from inside every wall is in front of you.
 */
export function cutawayHidden(face: WallFace, camera: Camera, mode: ViewMode): boolean {
  if (mode === 'walk') return false;
  const dx = camera.position.x - face.centre[0];
  const dz = camera.position.z - face.centre[1];
  return dx * face.normal[0] + dz * face.normal[1] < -0.05;
}

/** Applies `cutawayHidden` to an object every frame. */
export function useCutaway(face: WallFace | undefined, object: RefObject<Object3D | null>) {
  useFrame(({ camera }) => {
    if (!face || !object.current) return;
    object.current.visible = !cutawayHidden(face, camera, useHallwayStore.getState().viewMode);
  });
}

/** Hides ceiling fittings once the camera is above the roofline. */
export function useAboveRoofHidden(object: RefObject<Object3D | null>) {
  useFrame(({ camera }) => {
    if (object.current) object.current.visible = camera.position.y < HALL_HEIGHT;
  });
}

/**
 * The camera outside the hall: flown to the overview or the cutaway, then
 * held. Overview hands over to orbit controls once it arrives; the cutaway
 * slides along the route under a horizontal drag, the wheel, or A/D.
 */
export function ViewRig() {
  const { camera, gl } = useThree();
  const mode = useHallwayStore((s) => s.viewMode);
  const drag = useHallwayStore((s) => s.drag);
  const pressing = useHallwayStore((s) => s.pressing);
  const venue = useHallwayStore((s) => s.venue)!;
  const look = useRef(new Vector3(...venue.overview.target));
  const goal = useRef({ position: new Vector3(), lookAt: new Vector3() });
  const [orbiting, setOrbiting] = useState(false);
  const keys = useRef(new Set<string>());

  // Every change of mode is a flight; orbiting resumes only on arrival.
  useEffect(() => {
    setOrbiting(false);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = mode === 'wall' ? (venue.wallFov ?? FOV.wall) : FOV[mode];
      camera.updateProjectionMatrix();
    }
  }, [mode, camera, venue]);

  useEffect(() => {
    if (mode !== 'wall') return;
    const canvas = gl.domElement;
    let last: number | null = null;
    const down = (e: PointerEvent) => {
      if (e.button === 0) last = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (last == null) return;
      const dx = e.clientX - last;
      last = e.clientX;
      const s = useHallwayStore.getState();
      if (s.drag || s.pressing) return;
      // Grab-the-world: dragging left brings what is to the right into view.
      // Looking at the left wall, screen right is forward along the route.
      const sign = s.wallSide === 'L' ? 1 : -1;
      slide(-dx * SWIPE * sign);
    };
    const up = () => {
      last = null;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useHallwayStore.getState();
      const sign = s.wallSide === 'L' ? 1 : -1;
      slide((e.deltaY + e.deltaX) * 0.01 * sign);
    };
    const keyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      keys.current.add(e.code);
    };
    const keyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      canvas.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      keys.current.clear();
    };
  }, [mode, gl]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1);
    const state = useHallwayStore.getState();
    if (state.viewMode === 'walk') return;

    if (state.viewMode === 'wall') {
      const k = keys.current;
      const right = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      if (right) slide(right * KEY_SPEED * step * (state.wallSide === 'L' ? 1 : -1));
      const pose = venue.wall.pose(useHallwayStore.getState().wallS, state.wallSide);
      goal.current.position.set(...pose.position);
      goal.current.lookAt.set(...pose.lookAt);
    } else if (!orbiting) {
      goal.current.position.set(...venue.overview.position);
      goal.current.lookAt.set(...venue.overview.target);
    } else {
      return; // OrbitControls has the camera.
    }

    damp3(camera.position, goal.current.position, 0.35, step);
    damp3(look.current, goal.current.lookAt, 0.3, step);
    camera.lookAt(look.current);

    if (
      state.viewMode === 'overview' &&
      camera.position.distanceTo(goal.current.position) < ARRIVED * 10 &&
      look.current.distanceTo(goal.current.lookAt) < ARRIVED * 10
    ) {
      setOrbiting(true);
    }
  });

  if (mode !== 'overview' || !orbiting) return null;
  return (
    <OrbitControls
      makeDefault
      target={venue.overview.target}
      enabled={!drag && !pressing}
      enableDamping
      minDistance={8}
      maxDistance={venue.overview.span * 1.6}
      maxPolarAngle={1.25}
      screenSpacePanning={false}
    />
  );
}

function slide(ds: number) {
  const s = useHallwayStore.getState();
  // Held half a hall short of each end, so the view never slides off into the void.
  const { length, margin } = s.venue!.wall;
  useHallwayStore.setState({ wallS: Math.max(margin, Math.min(length - margin, s.wallS + ds)) });
}
