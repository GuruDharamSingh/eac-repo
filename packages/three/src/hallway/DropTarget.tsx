import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Raycaster, Vector2, type Object3D } from 'three';
import {
  HANG_GAP,
  HANG_SNAP,
  type Placement,
} from './layout';
import { getFrame, outerSize, type FrameStyle } from './frames';
import { pieceSize } from './sizing';
import { faceById } from './venue';
import { SlotOutline, slotSize } from './SlotPiece';
import { useHallwayStore, type DropTarget as Target, type SnapGuide } from './store';

/** Keeps the outline off the wall it is drawn on. */
const LIFT = 0.07;
const EDGE = 0.012;
/** Within this of a guide the carried piece snaps to it. */
const GUIDE_SNAP = 0.06;
/** The clear wall left when a piece snaps "beside" a neighbour. */
const BESIDE_GAP = 0.35;

/**
 * The lines a carried piece may snap to on this face, from the pieces already
 * hung there. Beside each neighbour at a standard gap, always; its centre and
 * matching edges only when the carried piece is clear of it vertically, since
 * lining up with a piece it would cover is never wanted. Horizontal lines
 * are in face x; vertical (centre and edge heights) in world height.
 */
function snapLines(
  placements: readonly Placement[],
  sizes: Record<string, { width: number; height: number }>,
  faceId: string,
  self: string,
  w: number,
  h: number,
  x: number,
  y: number,
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const o of placements) {
    if (o.pieceId === self || o.wallId !== faceId) continue;
    const s = sizes[o.pieceId];
    if (!s) continue;
    const clearAbove = Math.abs(y - o.y) > (s.height + h) / 2 + HANG_GAP;
    const clearBeside = Math.abs(x - o.x) > (s.width + w) / 2 + HANG_GAP;
    xs.push(o.x + s.width / 2 + BESIDE_GAP + w / 2, o.x - s.width / 2 - BESIDE_GAP - w / 2);
    if (clearAbove) xs.push(o.x, o.x - s.width / 2 + w / 2, o.x + s.width / 2 - w / 2);
    if (clearBeside) ys.push(o.y, o.y + s.height / 2 - h / 2, o.y - s.height / 2 + h / 2);
  }
  return { xs, ys };
}

function nearest(value: number, lines: number[], within: number): number | null {
  let best: number | null = null;
  let bestD = within;
  for (const l of lines) {
    const d = Math.abs(l - value);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

/**
 * Works out where a carried piece would land and draws its outline there.
 *
 * Runs in the frame loop rather than on pointer events because the camera
 * can move while a piece is held — a curator walking with a picture — and the
 * landing spot has to follow the view, not only the mouse.
 */
export function DropTarget({
  placements,
  frames,
}: {
  placements: readonly Placement[];
  frames: readonly FrameStyle[];
}) {
  const { camera, scene } = useThree();
  const drag = useHallwayStore((s) => s.drag);
  const target = useHallwayStore((s) => s.target);
  const setTarget = useHallwayStore((s) => s.setTarget);
  const raycaster = useMemo(() => new Raycaster(), []);
  const ndc = useMemo(() => new Vector2(), []);
  const walls = useRef<Object3D[]>([]);

  // The hangable surfaces, collected once per carry.
  useEffect(() => {
    if (!drag) return;
    const found: Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData?.hangFace) found.push(o);
    });
    walls.current = found;
  }, [drag, scene]);

  useFrame(() => {
    const { drag: d, pointer, sizes, target: current, snapOff } = useHallwayStore.getState();
    if (!d || !pointer) {
      if (current) setTarget(null);
      return;
    }
    ndc.set(pointer.x, pointer.y);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(walls.current, false)[0];
    const faceId = hit?.object.userData.hangFace as string | undefined;
    const venue = useHallwayStore.getState().venue!;
    const face = faceId ? faceById(venue, faceId) : undefined;
    if (!hit || !face) {
      if (current) setTarget(null);
      return;
    }

    const slot = venue.slots?.find((s) => s.id === face.id);
    if (slot) {
      // A frame holds one work; dropping on a taken one is refused, not stacked.
      const taken = placements.some((p) => p.wallId === slot.id && p.pieceId !== d.pieceId);
      const { width: sw, height: sh } = slotSize(slot);
      if (!current || current.wallId !== slot.id || current.valid === taken) {
        setTarget({ wallId: slot.id, x: 0, y: 0, width: sw, height: sh, valid: !taken, guides: [] });
      }
      return;
    }

    const frame = getFrame(d.frameId, frames);
    const base = pieceSize(
      { id: d.pieceId, title: '', imageUrl: '', heightCm: d.heightCm, widthCm: d.widthCm },
      d.aspect,
      face.length,
      venue.hang,
      d.ratio,
    );
    const { width, height } = outerSize(base.width * d.scale, base.height * d.scale, frame);

    let x = (hit.point.x - face.centre[0]) * face.xAxis[0] + (hit.point.z - face.centre[1]) * face.xAxis[1];
    let y = hit.point.y;
    const guides: SnapGuide[] = [];
    if (!snapOff) {
      const lines = snapLines(placements, sizes, face.id, d.pieceId, width, height, x, y);
      const sx = nearest(x, lines.xs, GUIDE_SNAP);
      const sy = nearest(y, [venue.hang.line, ...lines.ys], Math.max(GUIDE_SNAP, HANG_SNAP));
      if (sx != null) {
        x = sx;
        guides.push({ axis: 'x', at: sx });
      }
      if (sy != null) {
        y = sy;
        if (sy !== venue.hang.line) guides.push({ axis: 'y', at: sy });
      }
    }

    const halfSpan = face.length / 2 - width / 2 - 0.05;
    const lowest = venue.hang.minBottom + height / 2;
    const highest = venue.hang.maxTop - height / 2;
    let valid = halfSpan >= 0 && highest >= lowest;
    x = Math.max(-Math.max(0, halfSpan), Math.min(Math.max(0, halfSpan), x));
    y = Math.max(lowest, Math.min(Math.max(lowest, highest), y));

    for (const other of placements) {
      if (other.pieceId === d.pieceId || other.wallId !== face.id) continue;
      const o = sizes[other.pieceId];
      if (!o) continue;
      if (
        Math.abs(other.x - x) < (o.width + width) / 2 + HANG_GAP &&
        Math.abs(other.y - y) < (o.height + height) / 2 + HANG_GAP
      ) {
        valid = false;
        break;
      }
    }

    x = Math.round(x * 100) / 100;
    y = Math.round(y * 100) / 100;
    const next: Target = { wallId: face.id, x, y, width, height, valid, guides };
    if (
      !current ||
      current.wallId !== next.wallId ||
      current.x !== next.x ||
      current.y !== next.y ||
      current.valid !== next.valid ||
      current.guides.length !== next.guides.length ||
      Math.abs(current.width - next.width) > 1e-3 ||
      Math.abs(current.height - next.height) > 1e-3
    ) {
      setTarget(next);
    }
  });

  if (!drag || !target) return null;
  const venue = useHallwayStore.getState().venue!;
  const face = faceById(venue, target.wallId);
  // Drawn bolder from the overview, where a hairline would vanish at that distance.
  const edge = useHallwayStore.getState().viewMode === 'overview' ? EDGE * 6 : EDGE;
  if (!face) return null;
  const targetSlot = venue.slots?.find((s) => s.id === target.wallId);
  if (targetSlot) return <SlotOutline slot={targetSlot} colour={target.valid ? '#f2d08a' : '#e0564c'} width={0.02} />;
  const colour = target.valid ? '#f2d08a' : '#e0564c';
  const { width: w, height: h } = target;
  const wallHeight = venue.hang.maxTop + 0.4;

  return (
    <group position={[face.centre[0], 0, face.centre[1]]} rotation={[0, face.rotationY, 0]}>
      <group position={[target.x, target.y, LIFT]}>
        <mesh>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color={colour} transparent opacity={0.14} depthWrite={false} toneMapped={false} />
        </mesh>
        {[
          [0, h / 2, w + edge, edge],
          [0, -h / 2, w + edge, edge],
          [-w / 2, 0, edge, h + edge],
          [w / 2, 0, edge, h + edge],
        ].map(([px, py, sw, sh], i) => (
          <mesh key={i} position={[px!, py!, 0.002]}>
            <planeGeometry args={[sw!, sh!]} />
            <meshBasicMaterial color={colour} toneMapped={false} />
          </mesh>
        ))}
        {/* A tick on the hang line, so a curator can see what they snapped to. */}
        {target.y === venue.hang.line && (
          <mesh position={[0, 0, 0.002]}>
            <planeGeometry args={[w + 0.3, 0.004]} />
            <meshBasicMaterial color={colour} transparent opacity={0.6} toneMapped={false} />
          </mesh>
        )}
      </group>
      {/* Guides: the neighbour's line the piece snapped to, drawn across the wall. */}
      {target.guides.map((g, i) =>
        g.axis === 'x' ? (
          <mesh key={`g${i}`} position={[g.at, wallHeight / 2, LIFT]}>
            <planeGeometry args={[edge * 0.8, wallHeight]} />
            <meshBasicMaterial color="#7cc4ff" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
          </mesh>
        ) : (
          <mesh key={`g${i}`} position={[0, g.at, LIFT]}>
            <planeGeometry args={[face.length, edge * 0.8]} />
            <meshBasicMaterial color="#7cc4ff" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
          </mesh>
        ),
      )}
    </group>
  );
}
