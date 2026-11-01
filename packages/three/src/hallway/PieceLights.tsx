import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Object3D, type SpotLight } from 'three';
import { facePoint, type Placement } from './layout';
import { faceById } from './venue';
import { lampLevel } from './sizing';
import { lampColour, lampRigs, placementLamp, type LampRig, type LampSettings } from './lighting';
import { useHallwayStore } from './store';

/**
 * How many picture lamps actually cast light at once. A collection can run to
 * dozens of pieces, and every real light is paid for by every lit surface in
 * the frame; a fixed pool, handed to the lamps nearest the visitor, keeps the
 * cost flat. A fixed count also means shaders never recompile as pieces are
 * hung or taken down, or as lamps are switched between fixed points, which
 * they would if the number of lights changed. A pair of lamps takes two.
 */
const POOL = 8;
const REASSIGN_EVERY = 0.25;
const LAMP_INTENSITY = 5;

interface Lamp {
  pieceId: string;
  index: number;
}

export function PieceLights({ placements, lamps }: { placements: readonly Placement[]; lamps: LampSettings }) {
  const { camera } = useThree();
  const sizes = useHallwayStore((s) => s.sizes);
  const lights = useRef<Array<SpotLight | null>>([]);
  const targets = useMemo(() => Array.from({ length: POOL }, () => new Object3D()), []);
  const assigned = useRef<Lamp[]>([]);
  const scanned = useHallwayStore((s) => Boolean(s.venue?.slots));
  const since = useRef(Infinity);
  // Read every frame without re-rendering the pool.
  const settings = useRef(lamps);
  settings.current = lamps;
  const colour = lampColour(lamps.warmth);

  useFrame((_, delta) => {
    const venue = useHallwayStore.getState().venue!;
    const { on, strength, spread } = settings.current;
    const rigsFor = (p: Placement): LampRig[] => {
      const size = sizes[p.pieceId] ?? { width: 0.8, height: 0.8 };
      return lampRigs(placementLamp(p), size, p.y, spread);
    };

    since.current += delta;
    if (since.current >= REASSIGN_EVERY) {
      since.current = 0;
      const cx = camera.position.x;
      const cz = camera.position.z;
      assigned.current = on
        ? placements
            .map((p) => {
              const f = faceById(venue, p.wallId);
              if (!f) return { p, d: Infinity };
              const [x, z] = facePoint(f, p.x);
              return { p, d: Math.hypot(x - cx, z - cz) };
            })
            .filter((e) => Number.isFinite(e.d))
            .sort((a, b) => a.d - b.d)
            .flatMap(({ p }) => rigsFor(p).map((_, index) => ({ pieceId: p.pieceId, index })))
            .slice(0, POOL)
        : [];
    }

    for (let i = 0; i < POOL; i++) {
      const light = lights.current[i];
      if (!light) continue;
      const lamp = assigned.current[i];
      const p = lamp ? placements.find((q) => q.pieceId === lamp.pieceId) : undefined;
      const f = p ? faceById(venue, p.wallId) : undefined;
      const rig = p && lamp ? rigsFor(p)[lamp.index] : undefined;
      if (!p || !f || !rig || !on) {
        light.intensity = 0;
        continue;
      }
      // Piece frame to world: u along the wall (the face's x axis), d out of it.
      const [x, z] = facePoint(f, p.x);
      const [ax, az] = f.xAxis;
      const [nx, nz] = f.normal;
      light.position.set(x + ax * rig.u + nx * rig.d, rig.v, z + az * rig.u + nz * rig.d);
      targets[i]!.position.set(x + ax * rig.tu, rig.tv, z + az * rig.tu);
      targets[i]!.updateMatrixWorld();
      light.angle = rig.angle;
      light.distance = rig.distance;
      light.intensity = LAMP_INTENSITY * strength * rig.share * lampLevel(p.pieceId);
    }
  });

  if (scanned) return null;
  return (
    <>
      {targets.map((t, i) => (
        <primitive key={`t${i}`} object={t} />
      ))}
      {targets.map((t, i) => (
        <spotLight
          key={i}
          ref={(el) => {
            lights.current[i] = el;
          }}
          target={t}
          intensity={0}
          penumbra={0.85}
          distance={4}
          decay={2}
          color={colour}
        />
      ))}
    </>
  );
}
