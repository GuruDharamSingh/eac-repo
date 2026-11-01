import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Mesh, Plane, Vector3, type Material, type MeshStandardMaterial } from 'three';
import { facePoint, type WallSide } from './layout';
import { makeFace, standOff, type Pose, type V3, type Venue } from './venue';
import { useHallwayStore } from './store';

/**
 * The loft: "Big Room" by Francesco Coldesina (Sketchfab, CC BY 4.0), an
 * industrial flat with a long white block wall and a gable wall. The model
 * served is the original with its posters taken off the gable wall, so that
 * wall can be hung (see the app's public/rooms/CREDITS.txt).
 *
 * The model is authored at about 1.75 cm to the unit (from its bicycle and
 * fridge) in a Z-up frame; everything here is converted to metres in the
 * gallery frame, the room centred on the origin. Coordinates were measured by
 * ray-casting the model at eye height, not guessed — see `toWorld`.
 */
const UNIT = 0.0175;
const MODEL_CENTRE: [number, number] = [509, 292];

/** Model floor-plan coordinates (Blender X, Y) to gallery world X, Z. */
function toWorld(bx: number, by: number): [number, number] {
  return [(bx - MODEL_CENTRE[0]) * UNIT, -(by - MODEL_CENTRE[1]) * UNIT];
}

const EYE_Y = 1.62;
/** A hair proud of the plaster, so drop targets win over the wall itself. */
const PROUD = 0.5;

/**
 * The two walls work hangs on, in walking order: the long wall from the
 * kitchen end, then round the corner up the gable wall. Ids are stored with
 * every placement — never renumber them.
 */
const FACES = [
  makeFace('S1', toWorld(718, 48 + PROUD), toWorld(210, 48 + PROUD), [0, -1]),
  makeFace('W1', toWorld(200 + PROUD, 56), toWorld(200 + PROUD, 424), [1, 0]),
];
const [LONG, GABLE] = FACES as [(typeof FACES)[number], (typeof FACES)[number]];

/** Main room and the annex beyond the kitchen, as walkable rectangles. */
const ROOMS = [
  { min: toWorld(200, 432), max: toWorld(728, 48) },
  { min: toWorld(588, 536), max: toWorld(816, 336) },
].map(({ min, max }) => ({
  x0: Math.min(min[0], max[0]),
  x1: Math.max(min[0], max[0]),
  z0: Math.min(min[1], max[1]),
  z1: Math.max(min[1], max[1]),
}));
const BODY = 0.35;

function clamp(x: number, z: number): [number, number] {
  let best: [number, number] = [x, z];
  let bestD = Infinity;
  for (const r of ROOMS) {
    const cx = Math.max(r.x0 + BODY, Math.min(r.x1 - BODY, x));
    const cz = Math.max(r.z0 + BODY, Math.min(r.z1 - BODY, z));
    const d = Math.hypot(cx - x, cz - z);
    if (d < bestD) {
      bestD = d;
      best = [cx, cz];
    }
  }
  return best;
}

/** `s` along the two walls, as a face and a position on it. */
function along(s: number) {
  if (s <= LONG.length) return { face: LONG, x: s - LONG.length / 2 };
  return { face: GABLE, x: Math.min(GABLE.length, s - LONG.length) - GABLE.length / 2 };
}

/** How far into the room the cutaway stands from each wall, and how high. */
const BACK = { S1: 6.2, W1: 7.0 } as Record<string, number>;
const CAM_Y = 2.05;
const LOOK_Y = 1.45;

function wallPose(s: number, _side: WallSide): Pose {
  const { face, x } = along(s);
  const [wx, wz] = facePoint(face, x);
  const back = BACK[face.id] ?? 5;
  const [cx, cz] = clamp(wx + face.normal[0] * back, wz + face.normal[1] * back);
  return { position: [cx, CAM_Y, cz], lookAt: [wx, LOOK_Y, wz] };
}

const CENTRE = toWorld(464, 240);
/** Looked down on from over the window side, so both hanging walls face the camera. */
const OVERVIEW = {
  target: [CENTRE[0], 0.8, CENTRE[1]] as V3,
  position: [CENTRE[0] - 2.5, 12.5, CENTRE[1] - 8.5] as V3,
  span: 14,
};

/** Floor to ceiling, for the repainted gable. */
const WALL_HEIGHT = 2.9;

/** Where the overview slices the model: under the beams and ducts. */
const CLIP_Y = 2.2;

export function createLoftVenue(modelUrl: string): Venue {
  function LoftShell() {
    const { scene } = useGLTF(modelUrl);
    const gl = useThree((s) => s.gl);
    const clipPlane = useMemo(() => new Plane(new Vector3(0, -1, 0), CLIP_Y), []);

    const { model, materials } = useMemo(() => {
      const model = scene.clone(true);
      const materials = new Set<Material>();
      model.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        // Left single-sided: the model wraps the room in an outer shell, and
        // drawn from inside both ways that shell hides everything.
        for (const m of list) materials.add(m);
      });
      return { model, materials: [...materials] };
    }, [scene]);

    // Sliced whenever the camera is above the roofline, not only in the
    // overview: flying down into the room would otherwise pass through the
    // building's outer shell on the way in.
    const clipped = useRef<boolean | null>(null);
    const panel = useRef<MeshStandardMaterial>(null);
    useEffect(() => {
      gl.localClippingEnabled = true;
    }, [gl]);
    useFrame(({ camera }) => {
      const want = camera.position.y > CLIP_Y + 0.15;
      if (clipped.current === want) return;
      clipped.current = want;
      for (const m of panel.current ? [...materials, panel.current] : materials) {
        m.clippingPlanes = want ? [clipPlane] : [];
        m.needsUpdate = true;
      }
    });

    const flyTo = (faceId: string) => (event: ThreeEvent<MouseEvent>) => {
      const state = useHallwayStore.getState();
      if (state.viewMode !== 'overview' || state.drag || event.delta > 6) return;
      event.stopPropagation();
      const face = FACES.find((f) => f.id === faceId)!;
      const x =
        (event.point.x - face.centre[0]) * face.xAxis[0] + (event.point.z - face.centre[1]) * face.xAxis[1];
      state.setWall('L', orderKey(faceId, x));
    };

    return (
      <>
        {/* Background and room lights: `lights` below, drawn by SceneLights. */}
        <primitive
          object={model}
          scale={UNIT}
          position={[-MODEL_CENTRE[0] * UNIT, 0, MODEL_CENTRE[1] * UNIT]}
        />

        {/* The gable wall freshly painted: the model's texture there still
            carries the shadows of the posters taken down. */}
        <group position={[GABLE.centre[0], 0, GABLE.centre[1]]} rotation={[0, GABLE.rotationY, 0]}>
          <mesh position={[0, WALL_HEIGHT / 2, -0.004]}>
            <planeGeometry args={[GABLE.length, WALL_HEIGHT]} />
            <meshStandardMaterial ref={panel} color="#e9e7e2" roughness={0.92} />
          </mesh>
        </group>

        {/* Invisible hanging surfaces over the two walls: what a drop lands on. */}
        {FACES.map((face) => (
          <group key={face.id} position={[face.centre[0], 0, face.centre[1]]} rotation={[0, face.rotationY, 0]}>
            <mesh
              position={[0, 1.6, 0]}
              userData={{ hangFace: face.id }}
              onClick={flyTo(face.id)}
            >
              <planeGeometry args={[face.length, 3.0]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        ))}
      </>
    );
  }

  return {
    id: 'loft',
    name: 'The loft',
    credit: '“Big Room” by Francesco Coldesina, CC BY 4.0 — adapted',
    faces: FACES,
    hang: { line: 1.55, minBottom: 0.9, maxTop: 2.2 },
    eyeY: EYE_Y,
    orderKey,
    clamp,
    walkFrom: () => {
      const [x, z] = clamp(...toWorld(470, 380));
      const [tx, tz] = toWorld(470, 48);
      return { position: [x, EYE_Y, z], lookAt: [tx, EYE_Y, tz] };
    },
    overview: OVERVIEW,
    // Centre of the long block wall, between its two lamps.
    feature: { wallId: 'S1', x: 0.3, y: 1.55 },
    overviewClip: CLIP_Y,
    wallFov: 58,
    wall: {
      length: LONG.length + GABLE.length,
      margin: 1.2,
      pose: wallPose,
      locate: (faceId, x) => {
        const k = orderKey(faceId, x);
        return Number.isFinite(k) ? { s: k, side: 'L' } : null;
      },
      // Two walls: flipping looks at the other one.
      flip: (s, side) => ({ s: s <= LONG.length ? LONG.length + GABLE.length / 2 : LONG.length / 2, side }),
    },
    viewpoint: (faceId, x, y) => {
      const face = FACES.find((f) => f.id === faceId) ?? LONG;
      return standOff(face, x, y, 2.6, EYE_Y, clamp);
    },
    lights: {
      background: '#0b0d12',
      hemisphere: { sky: '#f4f1ea', ground: '#6b5d4c', intensity: 1.1 },
      ambient: { color: '#fff6ea', intensity: 0.45 },
      // Daylight in through the factory windows on the north side.
      key: { position: [CENTRE[0] - 3, 6, CENTRE[1] - 9], color: '#f3f6ff', intensity: 1.4 },
    },
    Shell: LoftShell,
  };
}

function orderKey(faceId: string, x: number): number {
  if (faceId === 'S1') return x + LONG.length / 2;
  if (faceId === 'W1') return LONG.length + x + GABLE.length / 2;
  return Infinity;
}
