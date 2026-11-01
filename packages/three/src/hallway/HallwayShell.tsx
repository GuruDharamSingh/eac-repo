import { useEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, type Group, type Texture } from 'three';
import {
  HALF_WIDTH,
  HALL_HEIGHT,
  SKYLIGHTS,
  SLATE_HEIGHT,
  WALL_FACES,
  routeDistance,
  sideOf,
  stripQuads,
  type WallFace,
} from './layout';
import { useAboveRoofHidden, useCutaway } from './ViewRig';
import { useHallwayStore } from './store';
import {
  CARPET_TILE,
  PLASTER_TILE,
  SLATE_TILE,
  createHallwayTextures,
  disposeHallwayTextures,
} from './textures';

const TRIM_RED = '#7a1f1c';
const TRIM_GOLD = '#a3843f';
const CAP_COLOUR = '#1b2026';
const CORNICE = '#e6dccb';
const CEILING = '#e9e1d2';

type Quad = [[number, number], [number, number], [number, number], [number, number]];

/**
 * One flat mesh from many XZ quads at height `y`. UVs are world-aligned, so a
 * texture runs on unbroken across every turn of the hall.
 */
function quadsGeometry(quads: Quad[], y: number, tile: number, faceDown = false): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const push = (p: [number, number]) => {
    positions.push(p[0], y, p[1]);
    uvs.push(p[0] / tile, -p[1] / tile);
  };
  for (const [a, b, c, d] of quads) {
    // Winding decides which way a face points; the two sides of the hall wind
    // opposite ways, so each triangle is tested and flipped to face the way
    // it is meant to.
    for (const tri of [
      [a, b, c],
      [a, c, d],
    ] as const) {
      const [p, q, r] = tri;
      const cross = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      const up = cross < 0;
      const order = up !== faceDown ? [p, q, r] : [p, r, q];
      order.forEach(push);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function Tiled({
  texture,
  width,
  height,
  tileW,
  tileH,
  position,
  faceId,
}: {
  texture: Texture;
  width: number;
  height: number;
  tileW: number;
  tileH: number;
  position: [number, number, number];
  faceId: string;
}) {
  const map = useMemo(() => {
    const t = texture.clone();
    t.repeat.set(width / tileW, height / tileH);
    t.needsUpdate = true;
    return t;
  }, [texture, width, height, tileW, tileH]);
  return (
    <mesh position={position} userData={{ hangFace: faceId }}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={map} roughness={0.92} />
    </mesh>
  );
}

function Wall({ face, slate, plaster }: { face: WallFace; slate: Texture; plaster: Texture }) {
  const ref = useRef<Group>(null);
  useCutaway(face, ref);
  // From the overview, a click on a wall flies in to look at it.
  const onClick = (event: ThreeEvent<MouseEvent>) => {
    const state = useHallwayStore.getState();
    const side = sideOf(face.id);
    if (state.viewMode !== 'overview' || state.drag || !side || event.delta > 6) return;
    event.stopPropagation();
    state.setWall(side, routeDistance([event.point.x, event.point.z]));
  };
  const { length } = face;
  const upper = HALL_HEIGHT - SLATE_HEIGHT;
  // Rails run a little past each end: at an outside corner that closes the
  // gap where two meet, and at an inside corner the overrun is buried in the
  // neighbouring wall.
  const railLength = length + 0.08;
  return (
    <group ref={ref} position={[face.centre[0], 0, face.centre[1]]} rotation={[0, face.rotationY, 0]} onClick={onClick}>
      <Tiled
        texture={slate}
        width={length}
        height={SLATE_HEIGHT}
        tileW={SLATE_TILE.width}
        tileH={SLATE_TILE.height}
        position={[0, SLATE_HEIGHT / 2, 0]}
        faceId={face.id}
      />
      <Tiled
        texture={plaster}
        width={length}
        height={upper}
        tileW={PLASTER_TILE}
        tileH={PLASTER_TILE}
        position={[0, SLATE_HEIGHT + upper / 2, 0]}
        faceId={face.id}
      />
      {/* Slate capping along the top of the panelling. */}
      <mesh position={[0, SLATE_HEIGHT + 0.025, 0.025]}>
        <boxGeometry args={[railLength, 0.05, 0.05]} />
        <meshStandardMaterial color={CAP_COLOUR} roughness={0.5} />
      </mesh>
      {/* A shallow slate plinth, so the panelling reads as set on the floor. */}
      <mesh position={[0, 0.06, 0.012]}>
        <boxGeometry args={[railLength, 0.12, 0.024]} />
        <meshStandardMaterial color="#14181d" roughness={0.6} />
      </mesh>
      <mesh position={[0, HALL_HEIGHT - 0.06, 0.05]}>
        <boxGeometry args={[railLength, 0.12, 0.1]} />
        <meshStandardMaterial color={CORNICE} roughness={0.9} />
      </mesh>
    </group>
  );
}

/**
 * A roof light: a bright glazed pane flush with the ceiling in a deep frame,
 * and the soft pool of daylight it drops on the carpet.
 */
function SkylightWell({ position, rotationY, pool }: { position: [number, number]; rotationY: number; pool: Texture }) {
  const w = Math.min(2.2, HALF_WIDTH * 0.9);
  const l = 2.2;
  const rim = 0.07;
  const ref = useRef<Group>(null);
  useAboveRoofHidden(ref);
  return (
    <group ref={ref} position={[position[0], 0, position[1]]} rotation={[0, rotationY, 0]}>
      <mesh position={[0, HALL_HEIGHT - 0.006, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, l]} />
        <meshBasicMaterial color="#f4f8ff" toneMapped={false} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} position={[(s * (w + rim)) / 2, HALL_HEIGHT - 0.05, 0]}>
          <boxGeometry args={[rim, 0.1, l + rim * 2]} />
          <meshStandardMaterial color="#e2dacb" roughness={0.9} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} position={[0, HALL_HEIGHT - 0.05, (s * (l + rim)) / 2]}>
          <boxGeometry args={[w, 0.1, rim]} />
          <meshStandardMaterial color="#e2dacb" roughness={0.9} />
        </mesh>
      ))}
      {[-l / 6, l / 6].map((z) => (
        <mesh key={z} position={[0, HALL_HEIGHT - 0.02, z]}>
          <boxGeometry args={[w, 0.03, 0.03]} />
          <meshStandardMaterial color="#3b3a36" />
        </mesh>
      ))}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALF_WIDTH * 2 - 0.1, l * 1.7]} />
        <meshBasicMaterial map={pool} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
}

/** The corridor itself: carpet and trim, walls, ceiling and roof lights. */
export function HallwayShell() {
  const textures = useMemo(() => createHallwayTextures(), []);
  useEffect(() => () => disposeHallwayTextures(textures), [textures]);

  const geometry = useMemo(() => {
    const trimOuter = HALF_WIDTH - 0.1;
    const trimInner = HALF_WIDTH - 0.24;
    const both = (inner: number, outer: number) => [
      ...(stripQuads(inner, outer) as Quad[]),
      ...(stripQuads(-outer, -inner) as Quad[]),
    ];
    return {
      carpet: quadsGeometry(stripQuads(-HALF_WIDTH, HALF_WIDTH) as Quad[], 0.004, CARPET_TILE),
      trim: quadsGeometry(both(trimInner, trimOuter), 0.008, 1),
      fillet: quadsGeometry(both(trimInner - 0.03, trimInner - 0.015), 0.009, 1),
      ceiling: quadsGeometry(stripQuads(-HALF_WIDTH, HALF_WIDTH) as Quad[], HALL_HEIGHT, 1, true),
      // The walls' footprint: from outside, the plan still reads where the
      // cutaway has hidden a wall.
      footing: quadsGeometry(both(HALF_WIDTH, HALF_WIDTH + 0.22), 0.004, 1),
    };
  }, []);
  useEffect(
    () => () => {
      for (const g of Object.values(geometry)) g.dispose();
    },
    [geometry],
  );

  return (
    <>
      {/* Held in space: seen from outside, the hall floats in a dark field of
          stars. Background and room lights: `HALLWAY_VENUE.lights`. */}
      <Stars radius={160} depth={60} count={2400} factor={4} saturation={0} fade speed={0.3} />
      <mesh geometry={geometry.footing}>
        <meshStandardMaterial color="#1a1d22" roughness={0.9} />
      </mesh>
      <mesh geometry={geometry.carpet}>
        <meshStandardMaterial map={textures.carpet} roughness={1} />
      </mesh>
      <mesh geometry={geometry.trim}>
        <meshStandardMaterial color={TRIM_RED} roughness={1} />
      </mesh>
      <mesh geometry={geometry.fillet}>
        <meshStandardMaterial color={TRIM_GOLD} roughness={0.9} />
      </mesh>
      <mesh geometry={geometry.ceiling}>
        <meshStandardMaterial color={CEILING} roughness={1} />
      </mesh>

      {WALL_FACES.map((face) => (
        <Wall key={face.id} face={face} slate={textures.slate} plaster={textures.plaster} />
      ))}

      {SKYLIGHTS.map((s, i) => (
        <SkylightWell key={i} position={s.position} rotationY={s.rotationY} pool={textures.pool} />
      ))}
    </>
  );
}
