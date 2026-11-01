import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, FrontSide, Mesh, Plane, Vector3, type Material } from 'three';
import { MORNING_CENTRE, MORNING_FLOOR_Y, MORNING_SLOTS, MORNING_WALLS } from './morning-data';
import { makeFace, type Pose, type Slot, type V3, type Venue } from './venue';
import { useHallwayStore } from './store';
import type { WallSide } from './layout';

/**
 * The Morning Room of the Hallwyl Museum, Stockholm: a photographic scan of a
 * red-velvet Edwardian room hung with family portraits, used as-is. Work is
 * not hung freely here: each of the room's own frames is a slot, and a work
 * dropped on one takes the place of the portrait inside it, the scanned gilt
 * frame left around it.
 */

type V2 = [number, number];
const EYE_Y = MORNING_FLOOR_Y + 1.6;

const WALLS = MORNING_WALLS.map((w) => {
  const outward = w.outward as unknown as V2;
  // Facing the wall from inside, screen-right along it.
  const right: V2 = [-outward[1], outward[0]];
  return { point: w.point as unknown as V2, outward, right, width: w.width };
});

/** Walking order: wall by wall, left to right along each as you face it. */
function slotKey(slot: Slot): number {
  const w = WALLS[slot.wall]!;
  const cx = slot.corners.reduce((a, c) => a + c[0], 0) / 4;
  const cz = slot.corners.reduce((a, c) => a + c[2], 0) / 4;
  const along = (cx - w.point[0]) * w.right[0] + (cz - w.point[1]) * w.right[1];
  const offset = WALLS.slice(0, slot.wall).reduce((a, x) => a + x.width, 0);
  // Slots one above another: higher first.
  const cy = slot.corners.reduce((a, c) => a + c[1], 0) / 4;
  return offset + along + w.width / 2 + (5 - cy) * 1e-3;
}

const SLOTS: Slot[] = MORNING_SLOTS.map((s) => ({
  id: s.id,
  shape: s.shape,
  wall: s.wall,
  corners: s.corners as unknown as [V3, V3, V3, V3],
}));

/**
 * A face per slot, so the shared machinery (lamps, cutaway, standing in front
 * of a piece) has a wall to reason about: centred on the opening, facing out
 * of the picture.
 */
const FACES = SLOTS.map((s) => {
  const [tl, tr] = s.corners;
  const w = WALLS[s.wall]!;
  return makeFace(s.id, [tl[0], tl[2]], [tr[0], tr[2]], [-w.outward[0], -w.outward[1]]);
});

function clamp(x: number, z: number): V2 {
  let px = x;
  let pz = z;
  for (const w of WALLS) {
    const d = (px - w.point[0]) * w.outward[0] + (pz - w.point[1]) * w.outward[1];
    if (d > -0.4) {
      px -= w.outward[0] * (d + 0.4);
      pz -= w.outward[1] * (d + 0.4);
    }
  }
  return [px, pz];
}

/** Wall to opposite wall, for each wall. */
const DEPTH = WALLS.map((w, i) => {
  const o = WALLS[(i + 2) % 4]!;
  return (w.point[0] - o.point[0]) * w.outward[0] + (w.point[1] - o.point[1]) * w.outward[1];
});

const WALL_OFFSETS = WALLS.map((_, i) => WALLS.slice(0, i).reduce((a, w) => a + w.width, 0));
const PATH_LENGTH = WALLS.reduce((a, w) => a + w.width, 0);

function along(s: number) {
  let i = WALLS.length - 1;
  while (i > 0 && s < WALL_OFFSETS[i]!) i--;
  const w = WALLS[i]!;
  const a = Math.max(-w.width / 2, Math.min(w.width / 2, s - WALL_OFFSETS[i]! - w.width / 2));
  return { i, w, a };
}

/** Standing well back across the room, a little above eye height. */
function wallPose(s: number, _side: WallSide): Pose {
  const { i, w, a } = along(s);
  const tx = w.point[0] + w.right[0] * a;
  const tz = w.point[1] + w.right[1] * a;
  // Back across the room, but short of the far wall's furniture: a scan is
  // solid clutter there, and a camera inside it sees nothing.
  const back = DEPTH[i]! - 1.6;
  const [cx, cz] = clamp(tx - w.outward[0] * back, tz - w.outward[1] * back);
  return { position: [cx, MORNING_FLOOR_Y + 1.9, cz], lookAt: [tx, MORNING_FLOOR_Y + 2.15, tz] };
}

const CENTRE: V3 = [MORNING_CENTRE[0], MORNING_FLOOR_Y + 1.2, MORNING_CENTRE[1]];
const OVERVIEW = {
  target: CENTRE,
  position: [CENTRE[0] + 3.5, 11.5, CENTRE[1] + 7] as V3,
  span: 11,
};
/** Under the painted dome, above the tallest frame. */
const CLIP_Y = MORNING_FLOOR_Y + 3.95;

function slotCentre(s: Slot): V3 {
  const c = s.corners.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
  return c as V3;
}

export function createMorningRoomVenue(modelUrl: string): Venue {
  function MorningShell() {
    const { scene } = useGLTF(modelUrl);
    const gl = useThree((s) => s.gl);
    const clipPlane = useMemo(() => new Plane(new Vector3(0, -1, 0), CLIP_Y), []);
    // The scan carries stray surfaces beyond its walls (the window recess, the
    // outside of the shell); a plane just outside each wall cuts them away.
    const wallPlanes = useMemo(
      () =>
        WALLS.map(
          (w) =>
            new Plane(
              new Vector3(-w.outward[0], 0, -w.outward[1]),
              w.outward[0] * w.point[0] + w.outward[1] * w.point[1] + 0.55,
            ),
        ),
      [],
    );
    const { model, materials } = useMemo(() => {
      const model = scene.clone(true);
      const materials = new Set<Material>();
      model.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          // A photograph of a room, not a model to be lit: keep its colour.
          m.toneMapped = false;
          // The scan ships double-sided; one-sided, the walls nearest the
          // camera drop away when the room is seen from outside.
          m.side = FrontSide;
          materials.add(m);
        }
      });
      return { model, materials: [...materials] };
    }, [scene]);

    const clipped = useRef<boolean | null>(null);
    useEffect(() => {
      gl.localClippingEnabled = true;
    }, [gl]);
    useFrame(({ camera }) => {
      const want = camera.position.y > CLIP_Y + 0.15;
      if (clipped.current === want) return;
      clipped.current = want;
      for (const m of materials) {
        m.clippingPlanes = want ? [...wallPlanes, clipPlane] : wallPlanes;
        m.needsUpdate = true;
      }
    });

    // One invisible quad per frame opening: what a drop lands on, and what a
    // click in the overview flies to.
    const targets = useMemo(
      () =>
        SLOTS.map((s) => {
          const g = new BufferGeometry();
          const [a, b, c, d] = s.corners;
          g.setAttribute('position', new Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
          g.computeVertexNormals();
          return { slot: s, geometry: g };
        }),
      [],
    );
    useEffect(() => () => targets.forEach((t) => t.geometry.dispose()), [targets]);

    const flyTo = (s: Slot) => (event: ThreeEvent<MouseEvent>) => {
      const state = useHallwayStore.getState();
      if (state.viewMode !== 'overview' || state.drag || event.delta > 6) return;
      event.stopPropagation();
      state.setWall('L', slotPathS(s));
    };

    return (
      <>
        <primitive object={model} />
        {targets.map(({ slot, geometry }) => (
          <mesh key={slot.id} geometry={geometry} userData={{ hangFace: slot.id }} onClick={flyTo(slot)}>
            <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
          </mesh>
        ))}
      </>
    );
  }

  const fireplace = SLOTS.find((s) => s.id === 'over-mantel') ?? SLOTS[0]!;

  return {
    id: 'morning-room',
    name: 'The morning room',
    credit: '“The Morning Room” by The Hallwyl Museum, CC BY 4.0 — adapted',
    faces: FACES,
    slots: SLOTS,
    hang: { line: 1.6, minBottom: 0.9, maxTop: 3.8 },
    eyeY: EYE_Y,
    orderKey: (faceId) => {
      const s = SLOTS.find((x) => x.id === faceId);
      return s ? slotKey(s) : Infinity;
    },
    clamp,
    walkFrom: () => {
      const [x, z] = clamp(MORNING_CENTRE[0], MORNING_CENTRE[1]);
      const c = slotCentre(fireplace);
      return { position: [x, EYE_Y, z], lookAt: [c[0], EYE_Y + 0.4, c[2]] };
    },
    overview: OVERVIEW,
    overviewClip: CLIP_Y,
    wallFov: 60,
    feature: { wallId: fireplace.id, x: 0, y: 0 },
    wall: {
      length: PATH_LENGTH,
      margin: 0.8,
      pose: wallPose,
      locate: (faceId) => {
        const s = SLOTS.find((x) => x.id === faceId);
        return s ? { s: slotPathS(s), side: 'L' } : null;
      },
      // Four walls: flipping turns round to face the opposite one.
      flip: (s, side) => {
        const { i, a } = along(s);
        const j = (i + 2) % 4;
        return { s: WALL_OFFSETS[j]! + WALLS[j]!.width / 2 - a, side };
      },
    },
    viewpoint: (faceId) => {
      const s = SLOTS.find((x) => x.id === faceId) ?? fireplace;
      const c = slotCentre(s);
      const w = WALLS[s.wall]!;
      const [x, z] = clamp(c[0] - w.outward[0] * 2.4, c[2] - w.outward[1] * 2.4);
      return { position: [x, EYE_Y, z], lookAt: c };
    },
    // A photographed room drawn as captured (its materials are not tone-mapped
    // and nothing lights it), so only the background is set here.
    lights: { background: '#0b0a0a' },
    Shell: MorningShell,
  };
}

/** Where along the cutaway path a slot is: its wall, and its place along it. */
function slotPathS(s: Slot): number {
  const w = WALLS[s.wall]!;
  const c = slotCentre(s);
  const a = (c[0] - w.point[0]) * w.right[0] + (c[2] - w.point[1]) * w.right[1];
  return WALL_OFFSETS[s.wall]! + w.width / 2 + a;
}
