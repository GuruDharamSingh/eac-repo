import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three';
import { useMediaTextures } from '../hooks/useMediaTextures';
import { useHallwayStore } from './store';
import type { Slot, V3 } from './venue';
import type { HallwayPiece } from './types';

const TEXTURE_MAX_SIZE = 1600;
/** Corner cut of an octagonal opening, as a fraction of its width and height. */
const OCTAGON_CUT = 0.29;

/** Point at (s, t) across a slot, s left→right and t top→bottom. */
function at(c: Slot['corners'], s: number, t: number): V3 {
  const [tl, tr, br, bl] = c;
  const top = [0, 1, 2].map((k) => tl[k]! + (tr[k]! - tl[k]!) * s);
  const bottom = [0, 1, 2].map((k) => bl[k]! + (br[k]! - bl[k]!) * s);
  return [0, 1, 2].map((k) => top[k]! + (bottom[k]! - top[k]!) * t) as V3;
}

export function slotSize(slot: Slot) {
  const [tl, tr, , bl] = slot.corners;
  return {
    width: Math.hypot(tr[0] - tl[0], tr[1] - tl[1], tr[2] - tl[2]),
    height: Math.hypot(bl[0] - tl[0], bl[1] - tl[1], bl[2] - tl[2]),
  };
}

/** The opening's outline as (s, t) points: a rectangle, or an octagon with cut corners. */
function outline(shape: Slot['shape']): Array<[number, number]> {
  if (shape === 'rect') return [[0, 0], [1, 0], [1, 1], [0, 1]];
  const c = OCTAGON_CUT;
  return [[c, 0], [1 - c, 0], [1, c], [1, 1 - c], [1 - c, 1], [c, 1], [0, 1 - c], [0, c]];
}

/**
 * The fill of a slot, as a fan around its centre, with UVs that crop the image
 * to the opening's shape rather than stretching it — the same rule as a hung
 * piece: a photograph is never distorted to fit.
 */
export function slotGeometry(slot: Slot, imageAspect: number | null): BufferGeometry {
  const { width, height } = slotSize(slot);
  const slotAspect = width / height;
  let u0 = 0, u1 = 1, v0 = 0, v1 = 1;
  if (imageAspect) {
    if (imageAspect > slotAspect) {
      const keep = slotAspect / imageAspect;
      u0 = (1 - keep) / 2; u1 = 1 - u0;
    } else {
      const keep = imageAspect / slotAspect;
      v0 = (1 - keep) / 2; v1 = 1 - v0;
    }
  }
  const ring = outline(slot.shape);
  const positions: number[] = [];
  const uvs: number[] = [];
  const push = ([s, t]: [number, number]) => {
    positions.push(...at(slot.corners, s, t));
    uvs.push(u0 + (u1 - u0) * s, v1 - (v1 - v0) * t);
  };
  for (let i = 0; i < ring.length; i++) {
    push([0.5, 0.5]);
    push(ring[i]!);
    push(ring[(i + 1) % ring.length]!);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

/** Thin strips around a slot's edge: a selection, or a drop outline. */
export function SlotOutline({ slot, colour, width = 0.012 }: { slot: Slot; colour: string; width?: number }) {
  const geometry = useMemo(() => {
    const ring = outline(slot.shape);
    const { width: sw, height: sh } = slotSize(slot);
    const ds = width / sw;
    const dt = width / sh;
    const positions: number[] = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      // Inset copies of the edge, towards the centre.
      const inset = (p: [number, number]): [number, number] => [
        p[0] + Math.sign(0.5 - p[0]) * ds * (p[0] === 0.5 ? 0 : 1),
        p[1] + Math.sign(0.5 - p[1]) * dt * (p[1] === 0.5 ? 0 : 1),
      ];
      const ai = inset(a), bi = inset(b);
      for (const p of [a, b, bi, a, bi, ai]) positions.push(...at(slot.corners, p[0], p[1]));
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return g;
  }, [slot, width]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} renderOrder={2}>
      <meshBasicMaterial color={colour} toneMapped={false} depthTest={false} side={DoubleSide} />
    </mesh>
  );
}

export interface SlotPieceProps {
  piece: HallwayPiece;
  slot: Slot;
  editable: boolean;
  lifted: boolean;
  onPointerDown?: (event: ThreeEvent<PointerEvent>, aspect: number) => void;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}

/**
 * A work shown in one of a scanned room's own frames. Drawn unlit, like the
 * scan around it, so the two read as one photograph.
 */
export function SlotPiece({ piece, slot, editable, lifted, onPointerDown, onClick }: SlotPieceProps) {
  const urls = useMemo(() => [piece.imageUrl], [piece.imageUrl]);
  const [texture] = useMediaTextures(urls, { maxSize: TEXTURE_MAX_SIZE });
  const hovered = useHallwayStore((s) => s.hoveredId === piece.id);
  const selected = useHallwayStore((s) => s.selectedId === piece.id);
  const setHoveredId = useHallwayStore((s) => s.setHoveredId);
  useCursor(hovered, editable ? 'grab' : 'pointer');

  const aspect = useMemo(() => {
    const image = texture?.image as { width?: number; height?: number } | undefined;
    return image?.width && image?.height ? image.width / image.height : (piece.aspect ?? null);
  }, [texture, piece.aspect]);
  const geometry = useMemo(() => slotGeometry(slot, aspect), [slot, aspect]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <mesh
        geometry={geometry}
        onPointerDown={(e) => onPointerDown?.(e, aspect ?? 1)}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredId(piece.id);
        }}
        onPointerOut={() => setHoveredId(null)}
      >
        <meshBasicMaterial
          key={(texture ? texture.uuid : 'unloaded') + (lifted ? '-lifted' : '')}
          map={texture ?? null}
          color={texture ? '#ffffff' : '#3a3128'}
          toneMapped={false}
          // Winding follows the scan's corner order, which faces either way.
          side={DoubleSide}
          transparent={lifted}
          opacity={lifted ? 0.35 : 1}
        />
      </mesh>
      {editable && (hovered || selected) && <SlotOutline slot={slot} colour="#f2d08a" />}
    </group>
  );
}
